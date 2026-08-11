import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

// Blur hash placeholder for instant display
const BLUR_HASH = '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7teleoff7fQfQj[ayj[ayf6fQfQfQfQfQfQ';

/** 
 * Force HTTPS where possible for iOS ATS.
 * For domains with ATS exceptions (listhub.net), keep original HTTP. 
 */
const secureUrl = (url?: string): string | undefined => {
  if (!url) return undefined;
  // listhub.net doesn't support HTTPS — handled by ATS exception in app.json
  if (url.includes('listhub.net')) return url;
  return url.replace(/^http:\/\//i, 'https://');
};

/** Translate Mashvisor property types to Spanish */
const PROPERTY_TYPES: Record<string, string> = {
  'single_family': 'Casa', 'Single Family Residential': 'Casa',
  'multi_family': 'Multi-Fam', 'Multi Family': 'Multi-Fam',
  'condo': 'Condo', 'Condo/Coop': 'Condo',
  'townhouse': 'Townhouse', 'Townhouse': 'Townhouse',
  'land': 'Terreno', 'Land': 'Terreno', 'Lot': 'Terreno', 'Lots/Land': 'Terreno',
  'Other': 'Casa', 'other': 'Casa',
  'apartment': 'Apto', 'Apartment': 'Apto',
  'mobile': 'Móvil', 'Mobile/Manufactured': 'Móvil',
  'commercial': 'Comercial', 'Commercial': 'Comercial',
  'farm': 'Finca', 'Farm': 'Finca',
};
const translateType = (t: string): string => PROPERTY_TYPES[t] || 'Casa';
// Types that warrant showing a badge (not standard single family homes)
const BADGE_TYPES = new Set(['multi_family', 'Multi Family', 'condo', 'Condo/Coop', 'townhouse', 'Townhouse',
  'land', 'Land', 'Lot', 'Lots/Land', 'apartment', 'Apartment', 'mobile', 'Mobile/Manufactured',
  'commercial', 'Commercial', 'farm', 'Farm']);

/** Status badge configuration */
const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  'active': { label: 'Disponible', color: '#fff', bgColor: '#10B981' },
  'Active': { label: 'Disponible', color: '#fff', bgColor: '#10B981' },
  'for sale': { label: 'En Venta', color: '#fff', bgColor: '#10B981' },
  'For Sale': { label: 'En Venta', color: '#fff', bgColor: '#10B981' },
  'pending': { label: 'Pendiente', color: '#000', bgColor: '#F59E0B' },
  'Pending': { label: 'Pendiente', color: '#000', bgColor: '#F59E0B' },
  'under contract': { label: 'Bajo Contrato', color: '#000', bgColor: '#F59E0B' },
  'Under Contract': { label: 'Bajo Contrato', color: '#000', bgColor: '#F59E0B' },
  'contingent': { label: 'Contingente', color: '#000', bgColor: '#F59E0B' },
  'Contingent': { label: 'Contingente', color: '#000', bgColor: '#F59E0B' },
  'sold': { label: 'Vendida', color: '#fff', bgColor: '#6B7280' },
  'Sold': { label: 'Vendida', color: '#fff', bgColor: '#6B7280' },
  'closed': { label: 'Vendida', color: '#fff', bgColor: '#6B7280' },
  'Closed': { label: 'Vendida', color: '#fff', bgColor: '#6B7280' },
  'off market': { label: 'Fuera del Mercado', color: '#fff', bgColor: '#6B7280' },
  'Off Market': { label: 'Fuera del Mercado', color: '#fff', bgColor: '#6B7280' },
  'foreclosure': { label: 'Foreclosure', color: '#fff', bgColor: '#EF4444' },
  'Foreclosure': { label: 'Foreclosure', color: '#fff', bgColor: '#EF4444' },
  'pre-foreclosure': { label: 'Pre-Foreclosure', color: '#fff', bgColor: '#EF4444' },
  'Pre-Foreclosure': { label: 'Pre-Foreclosure', color: '#fff', bgColor: '#EF4444' },
  'auction': { label: 'Subasta', color: '#fff', bgColor: '#8B5CF6' },
  'Auction': { label: 'Subasta', color: '#fff', bgColor: '#8B5CF6' },
  'coming soon': { label: 'Próximamente', color: '#fff', bgColor: '#3B82F6' },
  'Coming Soon': { label: 'Próximamente', color: '#fff', bgColor: '#3B82F6' },
};

const getStatusConfig = (status: string, isForeclosure: number) => {
  if (isForeclosure === 1) {
    return STATUS_CONFIG['foreclosure'];
  }
  return STATUS_CONFIG[status] || STATUS_CONFIG['active'];
};

interface Props {
  listing: {
    id: string; address: string; city: string; state: string; zip_code: string;
    type: string; beds: number; baths: number; sqft: number;
    list_price: number; image_url?: string; status: string;
    days_on_market: number; is_foreclosure: number;
    neighborhood?: string;
  };
  onPress: () => void;
}

export default function PropertyListCard({ listing, onPress }: Props) {
  const Colors = useColors();
  const styles = React.useMemo(() => create_styles(Colors), [Colors]);
  const [imgError, setImgError] = useState(false);
  const imageUri = secureUrl(listing.image_url);
  const statusConfig = getStatusConfig(listing.status, listing.is_foreclosure);

  const price = listing.list_price > 0
    ? `$${listing.list_price.toLocaleString()}`
    : 'Consultar';
  const pricePerSqft = listing.sqft > 0 && listing.list_price > 0
    ? `$${Math.round(listing.list_price / listing.sqft)}/ft²`
    : null;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Image */}
      <View style={styles.imageWrap}>
        {imageUri && !imgError ? (
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            contentFit="cover"
            transition={200}
            placeholder={BLUR_HASH}
            cachePolicy="memory-disk"
            onError={() => setImgError(true)}
            recyclingKey={listing.id}
          />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="home" size={36} color={Colors.textDim} />
            <Text style={styles.placeholderText}>Sin foto</Text>
          </View>
        )}

        {/* STATUS BADGE - Prominent top left */}
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
          <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>

        {/* Type badge - only for non-standard types */}
        {listing.type && BADGE_TYPES.has(listing.type) && (
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{translateType(listing.type)}</Text>
          </View>
        )}

        {/* Days on market */}
        {listing.days_on_market > 0 && (
          <View style={styles.daysBadge}>
            <Ionicons name="time-outline" size={10} color="#fff" />
            <Text style={styles.daysText}>{listing.days_on_market}d</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.price} numberOfLines={1}>{price}</Text>
        {pricePerSqft && <Text style={styles.pricePerSqft}>{pricePerSqft}</Text>}

        <Text style={styles.address} numberOfLines={1}>{listing.address}</Text>
        <Text style={styles.location} numberOfLines={1}>
          {listing.neighborhood || listing.city}, {listing.state}
        </Text>

        {/* Stats */}
        <View style={styles.statsRow}>
          {listing.beds > 0 && (
            <View style={styles.stat}>
              <Ionicons name="bed-outline" size={12} color={Colors.textDim} />
              <Text style={styles.statText}>{listing.beds}</Text>
            </View>
          )}
          {listing.baths > 0 && (
            <View style={styles.stat}>
              <Ionicons name="water-outline" size={12} color={Colors.textDim} />
              <Text style={styles.statText}>{listing.baths}</Text>
            </View>
          )}
          {listing.sqft > 0 && (
            <View style={styles.stat}>
              <Ionicons name="resize-outline" size={12} color={Colors.textDim} />
              <Text style={styles.statText}>{listing.sqft.toLocaleString()}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const create_styles = (Colors: any) => StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.glass,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.glassBorderLight,
    overflow: 'hidden',
    marginBottom: 12,
  },
  imageWrap: {
    width: '100%',
    height: CARD_WIDTH * 0.7,
    backgroundColor: Colors.glass,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.glass,
  },
  placeholderText: {
    color: Colors.textDim,
    fontSize: 10,
    marginTop: 4,
    fontWeight: '600',
  },
  typeBadge: {
    position: 'absolute',
    top: 36,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  typeBadgeText: {
    color: Colors.textPrimary,
    fontSize: 10,
    fontWeight: '700',
  },
  statusBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  foreclosureBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: Colors.brandRed,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  foreclosureText: {
    color: Colors.textPrimary,
    fontSize: 9,
    fontWeight: '800',
  },
  daysBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  daysText: {
    color: Colors.textPrimary,
    fontSize: 9,
    fontWeight: '700',
  },
  content: {
    padding: 12,
  },
  price: {
    color: Colors.brandRed,
    fontSize: 17,
    fontWeight: '900',
  },
  pricePerSqft: {
    color: Colors.textDim,
    fontSize: 10,
    marginTop: 1,
  },
  address: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  location: {
    color: Colors.textDim,
    fontSize: 10,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.glassBorder,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statText: {
    color: Colors.textDim,
    fontSize: 10,
    fontWeight: '600',
  },
});
