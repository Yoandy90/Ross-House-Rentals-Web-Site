import React, { useState } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, StyleSheet,
  Alert, Dimensions, TextInput, KeyboardAvoidingView, Platform,
  Linking, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../src/constants/theme';
import { Config } from '../src/constants/config';
import { useAuth } from '../src/contexts/AuthContext';
import FullscreenImageViewer from '../src/components/ui/FullscreenImageViewer';

const { width } = Dimensions.get('window');
const API = Config.API_URL;

/** Translate Mashvisor property types to Spanish */
const PROPERTY_TYPES: Record<string, string> = {
  'single_family': 'Casa Unifamiliar',
  'Single Family Residential': 'Casa Unifamiliar',
  'multi_family': 'Multi-Familiar',
  'Multi Family': 'Multi-Familiar',
  'condo': 'Condominio',
  'Condo/Coop': 'Condominio',
  'townhouse': 'Townhouse',
  'Townhouse': 'Townhouse',
  'land': 'Terreno',
  'Land': 'Terreno',
  'Lot': 'Terreno',
  'Lots/Land': 'Terreno',
  'Other': 'Casa',
  'other': 'Casa',
  'apartment': 'Apartamento',
  'Apartment': 'Apartamento',
  'mobile': 'Casa Movil',
  'Mobile/Manufactured': 'Casa Movil',
  'commercial': 'Comercial',
  'Commercial': 'Comercial',
  'farm': 'Finca',
  'Farm': 'Finca',
};
const translateType = (type: string): string => PROPERTY_TYPES[type] || 'Casa';

export default function MarketDetailScreen() {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { data } = useLocalSearchParams<{ id: string; data: string }>();
  const listing = data ? JSON.parse(data) : null;

  const [showInterest, setShowInterest] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [gallery, setGallery] = useState<string[]>([]);
  const [activePhoto, setActivePhoto] = useState(0);
  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);

  // Fetch extra images from property detail endpoint
  React.useEffect(() => {
    if (!listing) return;
    const images: string[] = [];
    const mainImg = listing.image_url;
    if (mainImg) images.push(mainImg.replace(/^http:\/\//i, 'https://'));
    setGallery(images);

    // Try to load extra images from property analysis
    (async () => {
      try {
        const params = new URLSearchParams({
          address: listing.address,
          city: listing.city,
          state: listing.state,
        });
        if (listing.zip_code) params.set('zip_code', listing.zip_code);
        const res = await fetch(`${API}/api/admin/market-data/property-analysis?${params}`);
        if (res.ok) {
          const d = await res.json();
          const prop = d.property || {};
          const extraImgs = prop.extra_images || [];
          const mainAnalysis = prop.image || '';
          const allImgs: string[] = [];
          if (mainImg) allImgs.push(mainImg.replace(/^http:\/\//i, 'https://'));
          if (mainAnalysis && !allImgs.includes(mainAnalysis.replace(/^http:\/\//i, 'https://'))) {
            allImgs.push(mainAnalysis.replace(/^http:\/\//i, 'https://'));
          }
          for (const img of extraImgs) {
            const secure = typeof img === 'string' ? img.replace(/^http:\/\//i, 'https://') : '';
            if (secure && !allImgs.includes(secure)) allImgs.push(secure);
          }
          if (allImgs.length > 0) setGallery(allImgs);
        }
      } catch {}
    })();
  }, [listing?.id]);

  if (!listing) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Propiedad no encontrada</Text>
      </View>
    );
  }

  const price = listing.list_price > 0 ? `$${listing.list_price.toLocaleString()}` : 'Consultar';
  const pricePerSqft = listing.sqft > 0 && listing.list_price > 0
    ? `$${Math.round(listing.list_price / listing.sqft)}/ft²` : null;

  const handleInterest = async () => {
    setSending(true);
    try {
      const res = await fetch(`${API}/api/public/market/interest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user?._id || '',
          user_name: user?.name || 'Visitante',
          user_phone: user?.phone || '',
          user_email: user?.email || '',
          property_id: listing.id,
          property_address: listing.address,
          property_city: listing.city,
          property_state: listing.state,
          property_price: listing.list_price,
          property_image: listing.image_url || '',
          message: message,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setShowInterest(false);
        setMessage('');
        Alert.alert(
          '¡Enviado!',
          'Tu interés ha sido registrado. Nos pondremos en contacto contigo pronto.',
          [{ text: 'OK' }],
        );
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudo enviar. Intenta de nuevo.');
    }
    setSending(false);
  };

  const StatBox = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
    <View style={styles.statBox}>
      <View style={styles.statIconWrap}>
        <Ionicons name={icon as any} size={18} color={C.brandRed} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Image Gallery */}
          <View style={styles.imageWrap}>
            {gallery.length > 0 ? (
              <FlatList
                data={gallery}
                keyExtractor={(_, idx) => `gallery-${idx}`}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                bounces={false}
                decelerationRate="fast"
                snapToInterval={width}
                getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
                onMomentumScrollEnd={(e) => {
                  const page = Math.round(e.nativeEvent.contentOffset.x / width);
                  setActivePhoto(page);
                }}
                renderItem={({ item: uri, index: idx }) => (
                  <TouchableOpacity
                    activeOpacity={0.95}
                    onPress={() => { setFullscreenIndex(idx); setFullscreenVisible(true); }}
                    style={{ width }}
                  >
                    <Image source={{ uri }} style={styles.image} resizeMode="cover" />
                    <View style={styles.expandHint}>
                      <Ionicons name="expand-outline" size={16} color="#fff" />
                    </View>
                  </TouchableOpacity>
                )}
              />
            ) : (
              <View style={styles.placeholder}>
                <Ionicons name="home" size={60} color={C.textDim} />
                <Text style={{ color: C.textDim, marginTop: 8, fontSize: 12 }}>Sin fotos</Text>
              </View>
            )}
            {/* Back button */}
            <TouchableOpacity style={[styles.backBtn, { top: 12 }]} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            {/* Photo counter */}
            {gallery.length > 1 && (
              <View style={styles.photoCounter}>
                <Ionicons name="images-outline" size={12} color="#fff" />
                <Text style={styles.photoCounterText}>{activePhoto + 1}/{gallery.length}</Text>
              </View>
            )}
            {/* Dots */}
            {gallery.length > 1 && (
              <View style={styles.dotsRow}>
                {gallery.map((_, idx) => (
                  <View key={idx} style={[styles.dot, idx === activePhoto && styles.dotActive]} />
                ))}
              </View>
            )}
            {/* Gradient overlay */}
            <View style={styles.imageGradient} />
            {/* Price overlay */}
            <View style={styles.priceOverlay}>
              <Text style={styles.priceText}>{price}</Text>
              {pricePerSqft && <Text style={styles.pricePerSqft}>{pricePerSqft}</Text>}
            </View>
            {listing.is_foreclosure === 1 && (
              <View style={styles.foreclosureBadge}>
                <Text style={styles.foreclosureText}>Foreclosure</Text>
              </View>
            )}
          </View>

          {/* Address */}
          <View style={styles.section}>
            <Text style={styles.address}>{listing.address}</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={14} color={C.brandRed} />
              <Text style={styles.locationText}>
                {listing.neighborhood ? `${listing.neighborhood}, ` : ''}{listing.city}, {listing.state} {listing.zip_code}
              </Text>
            </View>
            {listing.days_on_market > 0 && (
              <View style={styles.daysRow}>
                <Ionicons name="time-outline" size={14} color={C.textDim} />
                <Text style={styles.daysText}>{listing.days_on_market} días en el mercado</Text>
              </View>
            )}
          </View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            {listing.beds > 0 && <StatBox icon="bed-outline" label="Habitaciones" value={String(listing.beds)} />}
            {listing.baths > 0 && <StatBox icon="water-outline" label="Baños" value={String(listing.baths)} />}
            {listing.sqft > 0 && <StatBox icon="resize-outline" label="Pies²" value={listing.sqft.toLocaleString()} />}
            {listing.type && <StatBox icon="business-outline" label="Tipo" value={translateType(listing.type)} />}
          </View>

          {/* Interest Form (expanded) */}
          {showInterest && (
            <View style={styles.interestForm}>
              <Text style={styles.interestTitle}>Mensaje (opcional)</Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="Ej: Me gustaría agendar una visita..."
                placeholderTextColor={C.textDim}
                style={styles.interestInput}
                multiline
                numberOfLines={3}
              />
              <View style={styles.interestActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowInterest(false)}>
                  <Text style={styles.cancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.sendBtn} onPress={handleInterest} disabled={sending}>
                  <Ionicons name="send" size={16} color="#fff" />
                  <Text style={styles.sendText}>{sending ? 'Enviando...' : 'Enviar'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>

        {/* CTA Bar */}
        {!showInterest && (
          <View style={[styles.ctaBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity style={styles.ctaSecondary} onPress={() => {
              const phone = '18069342018';
              const msg = encodeURIComponent(`Hola, me interesa la propiedad en ${listing.address}, ${listing.city} (${price})`);
              Linking.openURL(`https://wa.me/${phone}?text=${msg}`).catch(() => {});
            }}>
              <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
              <Text style={styles.ctaSecondaryText}>WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctaPrimary} onPress={() => setShowInterest(true)}>
              <Ionicons name="heart" size={20} color="#fff" />
              <Text style={styles.ctaPrimaryText}>Me Interesa</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Fullscreen Photo Viewer */}
      <FullscreenImageViewer
        images={gallery.map(uri => ({ uri }))}
        initialIndex={fullscreenIndex}
        visible={fullscreenVisible}
        onClose={() => setFullscreenVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  errorText: { color: C.textDim, textAlign: 'center', marginTop: 100 },
  imageWrap: { width, height: width * 0.65, backgroundColor: C.glass },
  image: { width, height: width * 0.65 },
  placeholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  backBtn: {
    position: 'absolute', left: 16, width: 40, height: 40, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
  },
  expandHint: {
    position: 'absolute', bottom: 12, right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  photoCounter: {
    position: 'absolute', top: 14, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10,
  },
  photoCounterText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  dotsRow: {
    position: 'absolute', bottom: 50,
    flexDirection: 'row', alignSelf: 'center',
    left: 0, right: 0, justifyContent: 'center', gap: 5,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    backgroundColor: '#fff', width: 18, borderRadius: 3,
  },
  imageGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 100,
    backgroundColor: 'rgba(12,12,14,0.8)',
  },
  priceOverlay: {
    position: 'absolute', bottom: 16, left: 16,
  },
  priceText: { color: '#fff', fontSize: 32, fontWeight: '900' },
  pricePerSqft: { color: C.textDim, fontSize: 13, marginTop: 2 },
  foreclosureBadge: {
    position: 'absolute', top: 16, right: 16,
    backgroundColor: C.brandRed, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10,
  },
  foreclosureText: { color: C.textPrimary, fontSize: 11, fontWeight: '800' },
  section: { paddingHorizontal: 20, paddingTop: 20 },
  address: { color: C.textPrimary, fontSize: 22, fontWeight: '800' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  locationText: { color: C.textDim, fontSize: 13 },
  daysRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  daysText: { color: C.textDim, fontSize: 12 },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
    paddingHorizontal: 20, paddingTop: 24,
  },
  statBox: {
    flex: 1, minWidth: (width - 64) / 2,
    backgroundColor: C.glass, borderRadius: 18,
    borderWidth: 1, borderColor: C.glassBorder,
    padding: 16, alignItems: 'center',
  },
  statIconWrap: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: 'rgba(237,27,51,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  statValue: { color: C.textPrimary, fontSize: 20, fontWeight: '900' },
  statLabel: { color: C.textDim, fontSize: 11, marginTop: 2, fontWeight: '500' },
  interestForm: {
    marginHorizontal: 20, marginTop: 24, padding: 20,
    backgroundColor: C.glass, borderRadius: 20,
    borderWidth: 1, borderColor: C.glassBorder,
  },
  interestTitle: { color: C.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 12 },
  interestInput: {
    backgroundColor: C.glass, borderRadius: 14,
    borderWidth: 1, borderColor: C.glassBorder,
    color: C.textPrimary, padding: 14, fontSize: 14, minHeight: 80, textAlignVertical: 'top',
  },
  interestActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: C.glassLight, alignItems: 'center',
  },
  cancelText: { color: C.textDim, fontWeight: '700' },
  sendBtn: {
    flex: 2, flexDirection: 'row', paddingVertical: 14, borderRadius: 14,
    backgroundColor: C.brandRed, alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  sendText: { color: C.textPrimary, fontWeight: '800', fontSize: 15 },
  ctaBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 20, paddingTop: 16,
    backgroundColor: 'rgba(12,12,14,0.95)',
    borderTopWidth: 1, borderColor: C.glassBorder,
  },
  ctaSecondary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 16, borderRadius: 16,
    backgroundColor: C.glassLight, borderWidth: 1, borderColor: C.glassBorder,
  },
  ctaSecondaryText: { color: C.textPrimary, fontWeight: '700', fontSize: 14 },
  ctaPrimary: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 16, borderRadius: 16, backgroundColor: C.brandRed,
  },
  ctaPrimaryText: { color: C.textPrimary, fontWeight: '800', fontSize: 15 },
});
