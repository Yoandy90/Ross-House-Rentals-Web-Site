import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { apiCall } from '../../src/utils/api';
import { Config } from '../../src/constants/config';
import { Badge } from '../../src/components/ui/Badge';
import { Spacing, FontSizes, BorderRadius, Shadows, useColors } from '../../src/constants/theme';
import { formatCurrency } from '../../src/utils/formatters';
import { useAuth } from '../../src/contexts/AuthContext';
import AdminPropertiesScreen from '../admin-properties';

// Placeholder blur hash for instant display
const BLUR_HASH = '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7teleoff7fQfQj[ayj[ayf6fQfQfQfQfQfQ';

// Optimized Image component with loading state
const PropertyImage = React.memo(function PropertyImage({ uri, style }: { uri: string; style: any }) {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  const [isLoading, setIsLoading] = useState(true);
  const fadeAnim = useState(new Animated.Value(0))[0];

  const handleLoad = () => {
    setIsLoading(false);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={style}>
      {/* Skeleton loading effect */}
      {isLoading && (
        <View style={[StyleSheet.absoluteFill, styles.skeleton]}>
          <ActivityIndicator size="small" color={C.brandRed} style={{ opacity: 0.5 }} />
        </View>
      )}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
          placeholder={BLUR_HASH}
          cachePolicy="memory-disk"
          onLoad={handleLoad}
          recyclingKey={uri}
        />
      </Animated.View>
    </View>
  );
});

interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  property_type: string;
  bedrooms: number;
  bathrooms: number;
  square_feet: number;
  rent_amount: number;
  deposit_amount: number;
  description: string;
  features: string[];
  photos: string[];
  status: string;
  sale_price?: number;
  listing_type?: string;
  owner_type?: string;
  owner_name?: string;
  photo_count?: number;
  section8_accepted?: boolean;
}

export default function PropertiesTab() {
  const { user, viewAsTenant } = useAuth();
  if (user?.role === 'admin' && !viewAsTenant) {
    return <AdminPropertiesScreen embedded />;
  }
  return <PropertiesScreen />;
}

function PropertiesScreen() {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'rent' | 'sale'>('rent');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterS8, setFilterS8] = useState<boolean>(false);

  // Helper to resolve photo URLs to full URLs for React Native Image component
  const resolvePhotoUrl = (url: string): string => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    if (url.startsWith('/api/')) return `${Config.API_URL}${url}`;
    if (url.startsWith('ross-rentals/')) return `${Config.API_URL}/api/public/property-file/${url.replace('ross-rentals/', '')}`;
    if (url.startsWith('properties/')) return `${Config.API_URL}/api/public/property-file/${url}`;
    return url;
  };

  const fetchProperties = useCallback(async () => {
    try {
      const data = await apiCall('/public/properties', { auth: false });
      // Resolve photo URLs to full URLs for the Image component
      const props = (data.properties || []).map((p: Property) => ({
        ...p,
        photos: (p.photos || []).map(resolvePhotoUrl),
      }));
      setProperties(props);
    } catch (err) {
      console.log('Properties fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchProperties(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchProperties(); };

  const filtered = properties.filter(p => {
    const typeMatch = filterType === 'all' || p.property_type === filterType;
    const listingMatch = tab === 'sale'
      ? (p.listing_type === 'sale' || (p.sale_price && p.sale_price > 0))
      : (p.listing_type !== 'sale');
    const s8Match = !filterS8 || !!p.section8_accepted;
    return typeMatch && listingMatch && s8Match;
  });

  const types = ['all', 'house', 'apartment', 'duplex'];

  // Check if property is "new" (added in last 7 days)
  const isNew = (item: Property): boolean => {
    if (!(item as any).created_at) return false;
    try {
      const ageDays = (Date.now() - new Date((item as any).created_at).getTime()) / (1000 * 60 * 60 * 24);
      return ageDays < 7;
    } catch { return false; }
  };

  const renderProperty = ({ item, index }: { item: Property; index: number }) => {
    const isSaleTab = tab === 'sale';
    const priceFormatted = isSaleTab && item.sale_price
      ? formatCurrency(item.sale_price)
      : formatCurrency(item.rent_amount);
    const newBadge = isNew(item);

    return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.93}
      onPress={() => router.push({
        pathname: '/property-detail',
        params: {
          id: item.id,
          address: item.address,
          city: item.city,
          state: item.state,
          zip_code: item.zip_code || '',
          bedrooms: String(item.bedrooms),
          bathrooms: String(item.bathrooms),
          square_feet: String(item.square_feet || 0),
          rent_amount: String(item.rent_amount || 0),
          sale_price: String(item.sale_price || 0),
          listing_type: item.listing_type || (tab === 'sale' ? 'sale' : 'rent'),
          property_type: item.property_type || 'house',
          description: item.description || '',
          owner_type: item.owner_type || 'ross_house',
          owner_name: item.owner_name || 'Ross House Rentals LLC',
        },
      })}
    >
      {/* Hero photo with overlay gradient + floating badges */}
      <View style={styles.photoContainer}>
        {item.photos && item.photos.length > 0 ? (
          <PropertyImage uri={item.photos[0]} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Ionicons name="home-outline" size={48} color={C.textMuted} />
          </View>
        )}

        {/* Dark gradient overlay (Airbnb-style for text legibility) */}
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Top-left floating status badges */}
        <View style={styles.topLeftBadges}>
          {item.status === 'available' && (
            <View style={styles.disponibleBadge}>
              <View style={styles.pulseDot} />
              <Text style={styles.disponibleText}>DISPONIBLE</Text>
            </View>
          )}
          {newBadge && (
            <View style={styles.newBadge}>
              <Ionicons name="sparkles" size={10} color={C.white} />
              <Text style={styles.newBadgeText}>NUEVO</Text>
            </View>
          )}
        </View>

        {/* Top-right photo count chip */}
        {item.photos && item.photos.length > 1 && (
          <View style={styles.photoChip}>
            <Ionicons name="images" size={11} color={C.white} />
            <Text style={styles.photoChipText}>{item.photos.length}</Text>
          </View>
        )}

        {/* Bottom-left price overlay (large, eye-catching) */}
        <View style={styles.priceOverlay}>
          <Text style={styles.priceOverlayValue}>{priceFormatted}</Text>
          {!isSaleTab && (
            <Text style={styles.priceOverlayUnit}>/mes</Text>
          )}
        </View>

        {/* Bottom-right listing type chip */}
        <View style={[styles.typeChip, isSaleTab && { backgroundColor: C.warmGold }]}>
          <Ionicons
            name={isSaleTab ? 'pricetag' : 'key'}
            size={11}
            color={C.white}
          />
          <Text style={styles.typeChipText}>
            {isSaleTab ? 'VENTA' : 'RENTA'}
          </Text>
        </View>

        {/* Section 8 Welcome badge (top-left) */}
        {item.section8_accepted && (
          <View style={{
            position: 'absolute', top: 8, left: 8,
            backgroundColor: 'rgba(16, 185, 129, 0.95)',
            paddingHorizontal: 8, paddingVertical: 4,
            borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 4,
          }}>
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 10 }}>
              🏛️ S8 Welcome
            </Text>
          </View>
        )}
      </View>

      {/* Body */}
      <View style={styles.cardBody}>
        {/* Address (now title since price is on photo) */}
        <Text style={styles.addressTitle} numberOfLines={1}>
          {item.address}
        </Text>
        <View style={styles.addressRow}>
          <Ionicons name="location" size={13} color={C.brandRed} />
          <Text style={styles.addressCity} numberOfLines={1}>
            {item.city}, {item.state} {item.zip_code}
          </Text>
        </View>

        {/* Specs row with subtle separators */}
        <View style={styles.specsRow}>
          <View style={styles.spec}>
            <Ionicons name="bed" size={14} color={C.brandRed} />
            <Text style={styles.specText}>{item.bedrooms}</Text>
            <Text style={styles.specLabel}>{t('properties.bedrooms')}</Text>
          </View>
          <View style={styles.specDivider} />
          <View style={styles.spec}>
            <MaterialCommunityIcons name="shower-head" size={16} color={C.brandRed} />
            <Text style={styles.specText}>{item.bathrooms}</Text>
            <Text style={styles.specLabel}>{t('properties.bathrooms')}</Text>
          </View>
          {item.square_feet > 0 && (
            <>
              <View style={styles.specDivider} />
              <View style={styles.spec}>
                <Ionicons name="resize" size={14} color={C.brandRed} />
                <Text style={styles.specText}>{item.square_feet.toLocaleString()}</Text>
                <Text style={styles.specLabel}>ft²</Text>
              </View>
            </>
          )}
        </View>
      </View>
    </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: C.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('properties.title')}</Text>
      </View>

      {/* Tabs: Rent / Sale */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tab, tab === 'rent' && styles.tabActive]}
          onPress={() => setTab('rent')}
        >
          <Ionicons name="key-outline" size={16} color={tab === 'rent' ? C.brandRed : C.textMuted} />
          <Text style={[styles.tabText, tab === 'rent' && styles.tabTextActive]}>
            {t('properties.for_rent')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'sale' && styles.tabActive]}
          onPress={() => setTab('sale')}
        >
          <Ionicons name="pricetag-outline" size={16} color={tab === 'sale' ? C.warmGold : C.textMuted} />
          <Text style={[styles.tabText, tab === 'sale' && { color: C.warmGold }]}>
            {t('properties.for_sale')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filter chips */}
      <View style={styles.filtersRow}>
        {types.map(type => (
          <TouchableOpacity
            key={type}
            style={[styles.chip, filterType === type && styles.chipActive]}
            onPress={() => setFilterType(type)}
          >
            <Text style={[styles.chipText, filterType === type && styles.chipTextActive]}>
              {t(`properties.${type === 'all' ? 'all_types' : type}`)}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.chip, filterS8 && { backgroundColor: '#10B981', borderColor: '#059669' }]}
          onPress={() => setFilterS8(!filterS8)}
        >
          <Text style={[styles.chipText, filterS8 && { color: '#FFFFFF', fontWeight: '700' }]}>
            🏛️ Section 8
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.brandRed} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderProperty}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brandRed} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="home-outline" size={64} color={C.textMuted} />
              <Text style={styles.emptyTitle}>{t('properties.no_properties')}</Text>
              <Text style={styles.emptyDesc}>{t('properties.no_properties_desc')}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.md },
  title: { fontSize: FontSizes['2xl'], fontWeight: '800', color: C.textPrimary, letterSpacing: -0.5 },
  tabsRow: {
    flexDirection: 'row', paddingHorizontal: Spacing.base, gap: Spacing.sm, marginBottom: Spacing.md,
  },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: BorderRadius.full, backgroundColor: C.glass,
    borderWidth: 1, borderColor: C.glassBorder,
  },
  tabActive: { borderColor: 'rgba(200,16,46,0.30)', backgroundColor: 'rgba(200,16,46,0.08)' },
  tabText: { fontSize: FontSizes.sm, color: C.textMuted, fontWeight: '600' },
  tabTextActive: { color: C.brandRed },
  filtersRow: {
    flexDirection: 'row', paddingHorizontal: Spacing.base, gap: 8, marginBottom: Spacing.md,
  },
  chip: {
    paddingVertical: 6, paddingHorizontal: 14, borderRadius: BorderRadius.full,
    backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorder,
  },
  chipActive: { backgroundColor: C.glassLight, borderColor: C.glassBorderLight },
  chipText: { fontSize: FontSizes.xs, color: C.textMuted, fontWeight: '500' },
  chipTextActive: { color: C.textPrimary },
  list: { paddingHorizontal: Spacing.base, paddingBottom: 100 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: C.glass, borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: C.glassBorder,
    ...Shadows.card,
  },
  photoContainer: { height: 260, position: 'relative' },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: {
    width: '100%', height: '100%', backgroundColor: C.surfaceLight,
    justifyContent: 'center', alignItems: 'center',
  },

  // Top floating badges
  topLeftBadges: {
    position: 'absolute', top: 12, left: 12,
    flexDirection: 'row', gap: 6,
  },
  disponibleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(16,185,129,0.92)',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 14,
  },
  pulseDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: C.white,
  },
  disponibleText: {
    fontSize: 10, color: C.white, fontWeight: '800', letterSpacing: 0.5,
  },
  newBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: C.brandRed,
    paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: 14,
  },
  newBadgeText: {
    fontSize: 10, color: C.white, fontWeight: '800', letterSpacing: 0.5,
  },
  photoChip: {
    position: 'absolute', top: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: 14,
  },
  photoChipText: { fontSize: 11, color: C.white, fontWeight: '700' },

  // Bottom overlays
  priceOverlay: {
    position: 'absolute', bottom: 14, left: 16,
    flexDirection: 'row', alignItems: 'baseline',
  },
  priceOverlayValue: {
    fontSize: 26, fontWeight: '900', color: C.white, letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  priceOverlayUnit: {
    fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '600',
    marginLeft: 2,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  typeChip: {
    position: 'absolute', bottom: 14, right: 14,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.brandRed,
    paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: 12,
  },
  typeChipText: { fontSize: 10, color: C.white, fontWeight: '800', letterSpacing: 0.5 },

  cardBody: { padding: Spacing.base, paddingTop: 14, paddingBottom: 16 },
  addressTitle: {
    fontSize: 16, fontWeight: '700', color: C.textPrimary,
    letterSpacing: -0.2, marginBottom: 4,
  },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 14 },
  addressCity: {
    fontSize: FontSizes.sm, color: C.textMuted, flex: 1,
  },

  // Specs row with dividers
  specsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.glass,
    borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: C.glassBorder,
  },
  spec: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  specText: { fontSize: FontSizes.sm, color: C.textPrimary, fontWeight: '700' },
  specLabel: { fontSize: 11, color: C.textMuted, marginLeft: 2 },
  specDivider: { width: 1, height: 22, backgroundColor: C.glassLight },

  // Legacy compatibility (unused but kept for safety)
  statusBadge: { position: 'absolute', top: 12, left: 12 },
  photoCountBadge: { position: 'absolute', top: 12, right: 12 },
  photoCountText: { fontSize: 10, color: C.white, fontWeight: '600' },
  price: { fontSize: FontSizes.xl, fontWeight: '800', color: C.brandRed, marginBottom: 8 },
  details: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 10 },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailText: { fontSize: FontSizes.sm, color: C.textSecondary },
  address: { fontSize: FontSizes.sm, color: C.textMuted, flex: 1 },
  emptyContainer: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: FontSizes.lg, color: C.textPrimary, fontWeight: '600', marginTop: 16 },
  emptyDesc: { fontSize: FontSizes.sm, color: C.textMuted, marginTop: 4, textAlign: 'center' },
  skeleton: {
    backgroundColor: C.glassLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
