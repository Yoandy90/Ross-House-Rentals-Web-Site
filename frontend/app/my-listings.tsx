import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { apiCall } from '../src/utils/api';
import { Badge } from '../src/components/ui/Badge';
import { Spacing, FontSizes, BorderRadius, Shadows, useColors } from '../src/constants/theme';
import { formatCurrency } from '../src/utils/formatters';

interface Listing {
  id: string;
  address: string;
  city: string;
  state: string;
  property_type: string;
  listing_type: string;
  bedrooms: number;
  bathrooms: number;
  rent_amount: number;
  sale_price: number;
  status: string;
  photos: string[];
  created_at: string;
}

const STATUS_MAP: Record<string, { variant: 'success' | 'warning' | 'error' | 'default' }> = {
  pending: { variant: 'warning' },
  approved: { variant: 'success' },
  rejected: { variant: 'error' },
};

export default function MyListingsScreen() {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchListings = useCallback(async () => {
    try {
      const data = await apiCall('/landlord/my-listings');
      setListings(data.listings || []);
    } catch (err) {
      console.log('Listings fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchListings(); }, []);
  const onRefresh = () => { setRefreshing(true); fetchListings(); };

  const handleCardPress = (item: Listing) => {
    Alert.alert(
      item.address,
      `${item.city}, ${item.state} · ${item.bedrooms} hab · ${item.bathrooms} baños\nEstado: ${item.status}`,
      [
        {
          text: '✏️  Editar',
          onPress: () => router.push({ pathname: '/add-property', params: { listing_id: item.id } }),
        },
        {
          text: '🗑️  Eliminar',
          style: 'destructive',
          onPress: () => confirmDelete(item),
        },
        { text: 'Cancelar', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const confirmDelete = (item: Listing) => {
    Alert.alert(
      '¿Eliminar propiedad?',
      `Vas a eliminar "${item.address}". Esta acción no se puede deshacer.\n\nSi tiene contratos activos, contacta al administrador antes.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiCall(`/landlord/listings/${item.id}`, { method: 'DELETE' });
              // Optimistic UI: remove from local state
              setListings((prev) => prev.filter((l) => l.id !== item.id));
              Alert.alert('✅', 'Propiedad eliminada');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'No se pudo eliminar. Inténtalo de nuevo.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const renderListing = ({ item }: { item: Listing }) => {
    const st = STATUS_MAP[item.status] || STATUS_MAP.pending;
    const isRent = item.listing_type !== 'sale';
    const accentColor = isRent ? C.brandRed : C.warmGold;

    return (
      <TouchableOpacity activeOpacity={0.85} onPress={() => handleCardPress(item)} onLongPress={() => confirmDelete(item)} style={styles.card}>
        {/* Top accent bar */}
        <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />
        {/* Corner orb */}
        <View style={[styles.cornerOrb, { backgroundColor: accentColor }]} />

        <View style={styles.cardInner}>
          <View style={styles.cardTop}>
            <View style={[styles.typeChip, { backgroundColor: `${accentColor}14` }]}>
              <Ionicons
                name={isRent ? 'key' : 'pricetag'}
                size={12}
                color={accentColor}
              />
              <Text style={[styles.typeText, { color: accentColor }]}>
                {isRent ? t('landlord.for_rent') : t('landlord.for_sale')}
              </Text>
            </View>
            <Badge label={t(`landlord.${item.status}`)} variant={st.variant} />
          </View>

          <Text style={styles.cardAddress}>{item.address}</Text>
          <Text style={styles.cardCity}>{item.city}, {item.state}</Text>

          <View style={styles.cardDetails}>
            <View style={styles.detailsRow}>
              <View style={styles.detail}>
                <Ionicons name="bed-outline" size={14} color={C.textSecondary} />
                <Text style={styles.detailText}>{item.bedrooms}</Text>
              </View>
              <View style={styles.detail}>
                <Ionicons name="water-outline" size={14} color={C.textSecondary} />
                <Text style={styles.detailText}>{item.bathrooms}</Text>
              </View>
            </View>
            <Text style={[styles.cardPrice, { color: accentColor }]}>
              {isRent
                ? `${formatCurrency(item.rent_amount)}/mo`
                : formatCurrency(item.sale_price)
              }
            </Text>
          </View>

          {/* Action row */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => router.push({ pathname: '/add-property', params: { listing_id: item.id } })}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="create-outline" size={16} color={C.textSecondary} />
              <Text style={styles.actionBtnText}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnDelete]}
              onPress={() => confirmDelete(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={16} color="#ef4444" />
              <Text style={[styles.actionBtnText, { color: '#ef4444' }]}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('landlord.my_listings')}</Text>
        <TouchableOpacity onPress={() => router.push('/add-property')} style={styles.addBtn}>
          <LinearGradient
            colors={['#E11D48', '#9B1B30']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.addBtnGrad}
          >
            <Ionicons name="add" size={22} color={C.white} />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Header glow */}
      <LinearGradient
        colors={['rgba(200,16,46,0.05)', 'transparent']}
        style={styles.headerGlow}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.brandRed} />
        </View>
      ) : (
        <FlatList
          data={listings}
          renderItem={renderListing}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brandRed} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="business-outline" size={48} color={C.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>{t('landlord.no_listings')}</Text>
              <Text style={styles.emptyDesc}>{t('landlord.no_listings_desc')}</Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push('/add-property')}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#E11D48', '#9B1B30']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.emptyBtnGrad}
                >
                  <Ionicons name="add-circle" size={20} color={C.white} />
                  <Text style={styles.emptyBtnText}>{t('landlord.add_listing')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  title: { fontSize: FontSizes.xl, fontWeight: '800', color: C.textPrimary, letterSpacing: -0.3 },
  addBtn: {
    borderRadius: 14, overflow: 'hidden',
    ...Shadows.button,
  },
  addBtnGrad: {
    width: 44, height: 44, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  headerGlow: { height: 30 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: Spacing.base, paddingBottom: 40, gap: 12 },

  // Card
  card: {
    backgroundColor: C.surface,
    borderRadius: BorderRadius.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    position: 'relative',
    ...Shadows.subtle,
  },
  cardAccent: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 2.5,
    borderTopLeftRadius: BorderRadius.card, borderTopRightRadius: BorderRadius.card,
  },
  cornerOrb: {
    position: 'absolute', top: -20, right: -20,
    width: 72, height: 72, borderRadius: 36, opacity: 0.08,
  },
  cardInner: { padding: Spacing.base },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  typeText: { fontSize: FontSizes.xs, fontWeight: '700' },
  cardAddress: { fontSize: FontSizes.md, fontWeight: '700', color: C.textPrimary },
  cardCity: { fontSize: FontSizes.sm, color: C.textMuted, marginTop: 2, marginBottom: 10, fontWeight: '500' },
  cardDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailsRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailText: { fontSize: FontSizes.sm, color: C.textSecondary, fontWeight: '500' },
  cardPrice: { fontSize: FontSizes.lg, fontWeight: '800', letterSpacing: -0.3 },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.glass,
  },
  actionBtnDelete: {
    borderColor: 'rgba(239,68,68,0.25)',
    backgroundColor: 'rgba(239,68,68,0.06)',
  },
  actionBtnText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: C.textSecondary,
  },

  // Empty State
  emptyContainer: { alignItems: 'center', paddingTop: 80 },
  emptyIconWrap: {
    width: 88, height: 88, borderRadius: 24,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: FontSizes.lg, color: C.textPrimary, fontWeight: '700' },
  emptyDesc: { fontSize: FontSizes.sm, color: C.textMuted, marginTop: 4, textAlign: 'center' },
  emptyBtn: {
    borderRadius: BorderRadius.full, overflow: 'hidden', marginTop: 24,
    ...Shadows.button,
  },
  emptyBtnGrad: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 24, paddingVertical: 14,
    borderRadius: BorderRadius.full,
  },
  emptyBtnText: { color: C.white, fontSize: FontSizes.sm, fontWeight: '800' },
});
