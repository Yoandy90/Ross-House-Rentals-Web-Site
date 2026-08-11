import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { apiCall } from '../src/utils/api';
import { Input } from '../src/components/ui/Input';
import { Button } from '../src/components/ui/Button';
import { PhotoPicker } from '../src/components/ui/PhotoPicker';
import { useColors, Spacing, FontSizes, BorderRadius } from '../src/constants/theme';

const PROPERTY_TYPES = ['house', 'apartment', 'duplex', 'condo', 'townhouse'];
const LISTING_TYPES = ['rent', 'sale'];

export default function AddPropertyScreen() {
  const Colors = useColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ listing_id?: string }>();
  const editingId = (params?.listing_id as string) || '';
  const isEditMode = !!editingId;

  const [listingType, setListingType] = useState<'rent' | 'sale'>('rent');
  const [propertyType, setPropertyType] = useState('house');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('TX');
  const [zip, setZip] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [sqft, setSqft] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [deposit, setDeposit] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [loadingExisting, setLoadingExisting] = useState(isEditMode);

  // Load existing listing data when in edit mode
  useEffect(() => {
    if (!isEditMode) return;
    (async () => {
      try {
        const data: any = await apiCall('/landlord/my-listings');
        const list = (data?.listings || []) as any[];
        const found = list.find((l) => l.id === editingId);
        if (!found) {
          Alert.alert('Error', 'No se encontró la propiedad.');
          router.back();
          return;
        }
        setListingType((found.listing_type === 'sale' ? 'sale' : 'rent') as 'rent' | 'sale');
        setPropertyType(found.property_type || 'house');
        setAddress(found.address || '');
        setCity(found.city || '');
        setState(found.state || 'TX');
        setZip(found.zip_code || '');
        setBedrooms(String(found.bedrooms || ''));
        setBathrooms(String(found.bathrooms || ''));
        setSqft(String(found.square_feet || ''));
        setRentAmount(String(found.rent_amount || ''));
        setSalePrice(String(found.sale_price || ''));
        setDeposit(String(found.deposit_amount || ''));
        setDescription(found.description || '');
        setPhotos(found.photos || []);
      } catch (err) {
        console.log('Edit load error:', err);
        Alert.alert('Error', 'No se pudo cargar la propiedad.');
        router.back();
      } finally {
        setLoadingExisting(false);
      }
    })();
  }, [editingId, isEditMode]);

  const handleSubmit = async () => {
    if (!address.trim() || !city.trim()) {
      Alert.alert('Error', 'Dirección y ciudad son requeridas');
      return;
    }
    if (listingType === 'rent' && !rentAmount) {
      Alert.alert('Error', 'Ingresa el monto de renta mensual');
      return;
    }
    if (listingType === 'sale' && !salePrice) {
      Alert.alert('Error', 'Ingresa el precio de venta');
      return;
    }

    setLoading(true);
    try {
      // Step 1: Create or Update the listing
      setUploadProgress(isEditMode ? 'Actualizando propiedad...' : 'Creando propiedad...');
      const body: any = {
        listing_type: listingType,
        property_type: propertyType,
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        zip_code: zip.trim(),
        bedrooms: parseInt(bedrooms) || 0,
        bathrooms: parseFloat(bathrooms) || 0,
        square_feet: parseInt(sqft) || 0,
        rent_amount: parseFloat(rentAmount) || 0,
        sale_price: parseFloat(salePrice) || 0,
        deposit_amount: parseFloat(deposit) || 0,
        description: description.trim(),
      };

      let listingId = editingId;
      let requiresReview = false;

      if (isEditMode) {
        // Send only photos that are NEW (not http urls already saved) — keep existing
        // For simplicity, send photos array as-is (server will replace)
        body.photos = photos;
        const updateResult: any = await apiCall(`/landlord/listings/${editingId}`, {
          method: 'PUT',
          body,
        });
        requiresReview = !!updateResult?.requires_review;
      } else {
        body.photos = [];
        const result = await apiCall<{ success: boolean; listing_id: string }>('/landlord/listings', {
          method: 'POST',
          body,
        });
        listingId = result.listing_id;
      }

      // Step 2: Upload NEW photos (only on create — on edit, photos array already saved above)
      if (!isEditMode && photos.length > 0 && listingId) {
        setUploadProgress(`Subiendo ${photos.length} foto(s)...`);
        try {
          // Upload in batches of 2 to avoid payload limits
          const BATCH_SIZE = 2;
          for (let i = 0; i < photos.length; i += BATCH_SIZE) {
            const batch = photos.slice(i, i + BATCH_SIZE);
            setUploadProgress(`Subiendo fotos ${i + 1}-${Math.min(i + BATCH_SIZE, photos.length)} de ${photos.length}...`);
            await apiCall(`/landlord/listings/${listingId}/photos`, {
              method: 'POST',
              body: { photos: batch },
            });
          }
        } catch (photoErr: any) {
          console.log('Photo upload error:', photoErr);
          Alert.alert(
            'Propiedad creada',
            'La propiedad se creó pero hubo un problema subiendo algunas fotos. Puedes agregarlas después.',
            [{ text: 'OK', onPress: () => router.back() }]
          );
          return;
        }
      }

      Alert.alert(
        isEditMode ? '✅ Propiedad actualizada' : t('landlord.success'),
        isEditMode
          ? (requiresReview
              ? 'Los cambios materiales (precio, dirección, tamaño, etc.) requieren nueva aprobación del administrador.'
              : 'Cambios guardados.')
          : (photos.length > 0
              ? `Propiedad con ${photos.length} foto(s) enviada para aprobación`
              : t('landlord.success_desc')),
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit');
    } finally {
      setLoading(false);
      setUploadProgress('');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEditMode ? 'Editar propiedad' : t('landlord.add_listing')}</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Listing Type Toggle */}
        <Text style={styles.sectionLabel}>{t('landlord.listing_type')}</Text>
        <View style={styles.toggleRow}>
          {LISTING_TYPES.map((lt) => {
            const isActive = listingType === lt;
            const color = lt === 'rent' ? Colors.brandRed : Colors.warmGold;
            return (
              <TouchableOpacity
                key={lt}
                style={[styles.toggleBtn, isActive && { borderColor: color, backgroundColor: `${color}12` }]}
                onPress={() => setListingType(lt as 'rent' | 'sale')}
              >
                <Ionicons
                  name={lt === 'rent' ? 'key-outline' : 'pricetag-outline'}
                  size={18}
                  color={isActive ? color : Colors.textMuted}
                />
                <Text style={[styles.toggleText, isActive && { color }]}>
                  {t(`landlord.for_${lt}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Property Type Chips */}
        <Text style={styles.sectionLabel}>{t('landlord.property_type')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
          {PROPERTY_TYPES.map((pt) => {
            const isActive = propertyType === pt;
            return (
              <TouchableOpacity
                key={pt}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => setPropertyType(pt)}
              >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                  {pt.charAt(0).toUpperCase() + pt.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Form Card */}
        <View style={styles.formCard}>
          <Input
            label={t('landlord.address')}
            value={address}
            onChangeText={setAddress}
            placeholder="123 Main St"
            icon={<Ionicons name="location-outline" size={20} color={Colors.textMuted} />}
          />

          <View style={styles.row}>
            <View style={styles.flex2}>
              <Input label={t('landlord.city')} value={city} onChangeText={setCity} placeholder="Dumas" />
            </View>
            <View style={styles.flex1}>
              <Input label={t('landlord.state')} value={state} onChangeText={setState} placeholder="TX" />
            </View>
            <View style={styles.flex1}>
              <Input label={t('landlord.zip')} value={zip} onChangeText={setZip} placeholder="79029" keyboardType="number-pad" />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.flex1}>
              <Input label={t('landlord.bedrooms')} value={bedrooms} onChangeText={setBedrooms} placeholder="3" keyboardType="number-pad" />
            </View>
            <View style={styles.flex1}>
              <Input label={t('landlord.bathrooms')} value={bathrooms} onChangeText={setBathrooms} placeholder="2" keyboardType="decimal-pad" />
            </View>
            <View style={styles.flex1}>
              <Input label={t('landlord.sqft')} value={sqft} onChangeText={setSqft} placeholder="1500" keyboardType="number-pad" />
            </View>
          </View>

          {listingType === 'rent' && (
            <View style={styles.row}>
              <View style={styles.flex1}>
                <Input label={t('landlord.rent_amount')} value={rentAmount} onChangeText={setRentAmount} placeholder="1200" keyboardType="decimal-pad" icon={<Text style={styles.dollarSign}>$</Text>} />
              </View>
              <View style={styles.flex1}>
                <Input label={t('landlord.deposit')} value={deposit} onChangeText={setDeposit} placeholder="1200" keyboardType="decimal-pad" icon={<Text style={styles.dollarSign}>$</Text>} />
              </View>
            </View>
          )}

          {listingType === 'sale' && (
            <Input label={t('landlord.sale_price')} value={salePrice} onChangeText={setSalePrice} placeholder="250000" keyboardType="decimal-pad" icon={<Text style={styles.dollarSign}>$</Text>} />
          )}

          <Input
            label={t('landlord.description')}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe tu propiedad..."
            multiline
            numberOfLines={4}
          />

          {/* Photo Picker */}
          <PhotoPicker
            photos={photos}
            onPhotosChange={setPhotos}
            maxPhotos={10}
          />

          {/* Upload progress */}
          {uploadProgress ? (
            <View style={styles.progressRow}>
              <Text style={styles.progressText}>{uploadProgress}</Text>
            </View>
          ) : null}

          <Button
            title={loading ? (uploadProgress || t('landlord.submitting')) : t('landlord.submit')}
            onPress={handleSubmit}
            loading={loading}
            fullWidth
            size="lg"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  container: {
    paddingHorizontal: Spacing.base,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  sectionLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 10,
    marginLeft: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: Spacing.lg,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: BorderRadius.card,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  toggleText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  chipsScroll: {
    flexGrow: 0, flexShrink: 0,
    marginBottom: Spacing.lg,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: Colors.charcoal,
    borderColor: Colors.warmCharcoal,
  },
  chipText: {
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  chipTextActive: {
    color: Colors.textPrimary,
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.card,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  dollarSign: {
    color: Colors.textMuted,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  progressRow: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  progressText: {
    fontSize: FontSizes.sm,
    color: Colors.warmGold,
    fontWeight: '600',
  },
});
