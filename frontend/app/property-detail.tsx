import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Dimensions,
  ActivityIndicator,
  Modal,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import FullscreenImageViewer from '../src/components/ui/FullscreenImageViewer';
import { apiCall } from '../src/utils/api';
import { useAuth } from '../src/contexts/AuthContext';
import { Config } from '../src/constants/config';
import { Spacing, FontSizes, BorderRadius, Shadows, useColors } from '../src/constants/theme';
import { formatCurrency } from '../src/utils/formatters';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Blur hash placeholder for instant display
const BLUR_HASH = '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7teleoff7fQfQj[ayj[ayf6fQfQfQfQfQfQ';

// Photo categories config
const CATEGORY_LABELS: Record<string, string> = {
  all: 'Todas',
  exterior: 'Exterior',
  kitchen: 'Cocina',
  bathroom: 'Banos',
  bedroom: 'Habitaciones',
  living_room: 'Sala',
  patio: 'Patio',
  garage: 'Garaje',
  other: 'Otra',
};

const CATEGORY_ICONS: Record<string, string> = {
  all: 'images-outline',
  exterior: 'home-outline',
  kitchen: 'restaurant-outline',
  bathroom: 'water-outline',
  bedroom: 'bed-outline',
  living_room: 'tv-outline',
  patio: 'leaf-outline',
  garage: 'car-outline',
  other: 'camera-outline',
};

interface PhotoItem {
  url: string;
  caption: string;
  category: string;
}

export default function PropertyDetailScreen() {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    id: string;
    address: string;
    city: string;
    state: string;
    zip_code: string;
    bedrooms: string;
    bathrooms: string;
    square_feet: string;
    rent_amount: string;
    sale_price: string;
    listing_type: string;
    property_type: string;
    description: string;
    owner_type: string;
    owner_name: string;
  }>();

  const [allPhotos, setAllPhotos] = useState<PhotoItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [showInquiry, setShowInquiry] = useState(false);
  const [inquiryType, setInquiryType] = useState<'contact' | 'apply' | 'visit'>('contact');
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Fullscreen viewer state
  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);

  useEffect(() => {
    const fetchPhotos = async () => {
      try {
        const data = await apiCall(`/public/properties/${params.id}`, { auth: false });
        if (data.success && data.property) {
          const prop = data.property;
          const categorized = (prop.photos_categorized || []).map((p: any) => ({
            url: resolveUrl(p.url || ''),
            caption: p.caption || '',
            category: p.category || 'other',
          }));
          // Fallback: if no categorized, use plain photos array
          if (categorized.length === 0 && prop.photos) {
            const plain = (prop.photos || []).map((url: string) => ({
              url: resolveUrl(url),
              caption: '',
              category: 'other',
            }));
            setAllPhotos(plain);
          } else {
            setAllPhotos(categorized);
          }
        }
      } catch (err) {
        console.log('Property detail fetch error:', err);
      } finally {
        setLoadingPhotos(false);
      }
    };
    if (params.id) fetchPhotos();
    else setLoadingPhotos(false);
  }, [params.id]);

  const resolveUrl = (p: string): string => {
    if (!p) return '';
    if (p.startsWith('http')) return p;
    if (p.startsWith('/api/')) return `${Config.API_URL}${p}`;
    if (p.startsWith('ross-rentals/')) return `${Config.API_URL}/api/public/property-file/${p.replace('ross-rentals/', '')}`;
    if (p.startsWith('properties/')) return `${Config.API_URL}/api/public/property-file/${p}`;
    return p;
  };

  // Filtered photos by category
  const filteredPhotos = useMemo(() => {
    if (selectedCategory === 'all') return allPhotos;
    return allPhotos.filter(p => p.category === selectedCategory);
  }, [allPhotos, selectedCategory]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allPhotos.length };
    allPhotos.forEach(p => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    return counts;
  }, [allPhotos]);

  // Available categories (only show categories that have photos)
  const availableCategories = useMemo(() => {
    const cats = ['all'];
    Object.keys(categoryCounts).forEach(key => {
      if (key !== 'all' && categoryCounts[key] > 0) cats.push(key);
    });
    return cats;
  }, [categoryCounts]);

  const isRent = params.listing_type === 'rent';
  const accentColor = isRent ? C.brandRed : C.warmGold;
  const price = isRent
    ? formatCurrency(parseFloat(params.rent_amount || '0'))
    : formatCurrency(parseFloat(params.sale_price || '0'));

  const sendInquiry = async () => {
    if (!name.trim() || !email.trim()) {
      Alert.alert('Error', 'Nombre y email son requeridos');
      return;
    }
    setSending(true);
    try {
      await apiCall('/public/property-inquiry', {
        method: 'POST',
        body: {
          property_id: params.id,
          property_type: params.owner_type,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          message: message.trim(),
          inquiry_type: inquiryType,
        },
        auth: false,
      });
      Alert.alert('Enviado', t('inquiry.sent'), [{ text: 'OK', onPress: () => setShowInquiry(false) }]);
      setMessage('');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSending(false);
    }
  };

  const features = [
    { icon: 'bed-outline' as const, label: t('landlord.bedrooms'), value: params.bedrooms || '0', lib: 'ion' as const },
    { icon: 'shower-head' as const, label: t('landlord.bathrooms'), value: params.bathrooms || '0', lib: 'mci' as const },
    { icon: 'resize-outline' as const, label: t('landlord.sqft'), value: `${parseInt(params.square_feet || '0').toLocaleString()} ft²`, lib: 'ion' as const },
    { icon: 'home-outline' as const, label: t('landlord.property_type'), value: (params.property_type || 'house').charAt(0).toUpperCase() + (params.property_type || 'house').slice(1), lib: 'ion' as const },
  ];

  // Carousel scroll handler
  const onCarouselScroll = useCallback((event: any) => {
    const offset = event.nativeEvent.contentOffset.x;
    const idx = Math.round(offset / SCREEN_WIDTH);
    setActiveImageIndex(idx);
  }, []);

  // Open fullscreen at a given index
  const openFullscreen = (index: number) => {
    setFullscreenIndex(index);
    setFullscreenVisible(true);
  };

  // Images for fullscreen viewer
  const fullscreenImages = useMemo(
    () => filteredPhotos.map(p => ({ uri: p.url })),
    [filteredPhotos]
  );

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        {/* === PHOTO CAROUSEL === */}
        <View style={{ position: 'relative' }}>
          {/* Back button overlay */}
          <View style={[styles.header, { paddingTop: insets.top }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={C.textPrimary} />
            </TouchableOpacity>
          </View>

          {filteredPhotos.length > 0 ? (
            <>
              <FlatList
                data={filteredPhotos}
                keyExtractor={(_, i) => `photo-${i}`}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                bounces={false}
                decelerationRate="fast"
                snapToInterval={SCREEN_WIDTH}
                onMomentumScrollEnd={onCarouselScroll}
                getItemLayout={(_, i) => ({
                  length: SCREEN_WIDTH,
                  offset: SCREEN_WIDTH * i,
                  index: i,
                })}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    activeOpacity={0.95}
                    onPress={() => openFullscreen(index)}
                    style={{ width: SCREEN_WIDTH }}
                  >
                    <Image
                      source={{ uri: item.url }}
                      style={{ width: SCREEN_WIDTH, height: 320 }}
                      contentFit="cover"
                      transition={200}
                      placeholder={BLUR_HASH}
                      cachePolicy="memory-disk"
                      recyclingKey={item.url}
                    />
                    {/* Tap to expand hint */}
                    <View style={styles.expandHint}>
                      <Ionicons name="expand-outline" size={16} color="#fff" />
                    </View>
                  </TouchableOpacity>
                )}
              />
              {/* Counter badge */}
              {filteredPhotos.length > 1 && (
                <View style={styles.counterBadge}>
                  <Ionicons name="images-outline" size={12} color="#fff" />
                  <Text style={styles.counterText}>
                    {activeImageIndex + 1}/{filteredPhotos.length}
                  </Text>
                </View>
              )}
              {/* Dots */}
              {filteredPhotos.length > 1 && filteredPhotos.length <= 8 && (
                <View style={styles.dotsContainer}>
                  {filteredPhotos.map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        i === activeImageIndex ? styles.dotActive : styles.dotInactive,
                      ]}
                    />
                  ))}
                </View>
              )}
            </>
          ) : loadingPhotos ? (
            <View style={styles.heroPlaceholder}>
              <ActivityIndicator color={accentColor} size="large" />
            </View>
          ) : (
            <View style={styles.heroPlaceholder}>
              <View style={[styles.heroIcon, { backgroundColor: `${accentColor}14` }]}>
                <Ionicons name={isRent ? 'key' : 'pricetag'} size={40} color={accentColor} />
              </View>
            </View>
          )}
        </View>

        {/* === CATEGORY PILLS (Realtor-style) === */}
        {allPhotos.length > 0 && availableCategories.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}
          >
            {availableCategories.map(cat => {
              const isActive = selectedCategory === cat;
              const count = categoryCounts[cat] || 0;
              const label = CATEGORY_LABELS[cat] || cat;
              const icon = CATEGORY_ICONS[cat] || 'camera-outline';
              // Find thumbnail for this category
              const thumb = cat === 'all'
                ? allPhotos[0]?.url
                : allPhotos.find(p => p.category === cat)?.url;

              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => {
                    setSelectedCategory(cat);
                    setActiveImageIndex(0);
                  }}
                  activeOpacity={0.8}
                  style={[
                    styles.categoryPill,
                    isActive && styles.categoryPillActive,
                  ]}
                >
                  {thumb ? (
                    <Image
                      source={{ uri: thumb }}
                      style={styles.categoryThumb}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      placeholder={BLUR_HASH}
                    />
                  ) : (
                    <View style={[styles.categoryThumb, styles.categoryThumbPlaceholder]}>
                      <Ionicons name={icon as any} size={16} color={isActive ? C.white : C.textMuted} />
                    </View>
                  )}
                  <View style={styles.categoryTextWrap}>
                    <Text style={[styles.categoryLabel, isActive && styles.categoryLabelActive]}>
                      {label}
                    </Text>
                    <Text style={[styles.categoryCount, isActive && styles.categoryCountActive]}>
                      ({count})
                    </Text>
                  </View>
                  {isActive && <View style={styles.categoryActiveDot} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* === LISTING INFO === */}
        {/* Type Badge + Price */}
        <View style={styles.badgeRow}>
          <View style={[styles.typeBadge, { backgroundColor: `${accentColor}14` }]}>
            <Ionicons name={isRent ? 'key' : 'pricetag'} size={12} color={accentColor} />
            <Text style={[styles.typeBadgeText, { color: accentColor }]}>
              {isRent ? t('landlord.for_rent') : t('landlord.for_sale')}
            </Text>
          </View>
        </View>

        <Text style={styles.price}>{price}{isRent ? '/mo' : ''}</Text>

        {/* Address */}
        <View style={styles.addressRow}>
          <View style={styles.addressIcon}>
            <Ionicons name="location" size={18} color={C.brandRed} />
          </View>
          <View>
            <Text style={styles.address}>{params.address}</Text>
            <Text style={styles.city}>{params.city}, {params.state} {params.zip_code}</Text>
          </View>
        </View>

        {/* Features Grid */}
        <View style={styles.featuresGrid}>
          {features.map((f, i) => (
            <View key={i} style={styles.featureCard}>
              <LinearGradient
                colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.01)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              {f.lib === 'mci' ? (
                <MaterialCommunityIcons name={f.icon as any} size={22} color={accentColor} />
              ) : (
                <Ionicons name={f.icon as any} size={20} color={accentColor} />
              )}
              <Text style={styles.featureValue}>{f.value}</Text>
              <Text style={styles.featureLabel}>{f.label}</Text>
            </View>
          ))}
        </View>

        {/* Owner Card */}
        <View style={styles.ownerCard}>
          <View style={[styles.ownerAccent, { backgroundColor: C.violet }]} />
          <View style={[styles.ownerOrb, { backgroundColor: C.violet }]} />
          <View style={styles.ownerRow}>
            <View style={styles.ownerAvatar}>
              <Ionicons name="shield-checkmark" size={18} color={C.white} />
            </View>
            <View>
              <Text style={styles.ownerLabel}>{t('inquiry.owner_label')}</Text>
              <Text style={styles.ownerName}>Ross House Rentals LLC</Text>
            </View>
          </View>
        </View>

        {/* Description */}
        {params.description ? (
          <View style={styles.descSection}>
            <View style={styles.descLabelRow}>
              <Ionicons name="document-text-outline" size={14} color={C.brandRed} />
              <Text style={styles.sectionLabel}>{t('landlord.description')}</Text>
            </View>
            <Text style={styles.descText}>{params.description}</Text>
          </View>
        ) : null}

        {/* Inquiry Form */}
        {showInquiry && (
          <View style={styles.inquiryCard}>
            <View style={[styles.inquiryAccent, { backgroundColor: C.brandRed }]} />
            <View style={styles.inquiryHeader}>
              <Text style={styles.inquiryTitle}>
                {t(`inquiry.${inquiryType === 'apply' ? 'apply_now' : inquiryType === 'visit' ? 'schedule_visit' : 'contact_owner'}`)}
              </Text>
              <TouchableOpacity onPress={() => setShowInquiry(false)}>
                <Ionicons name="close" size={20} color={C.textMuted} />
              </TouchableOpacity>
            </View>
            <TextInput style={styles.input} placeholder={t('inquiry.name') || 'Nombre'} placeholderTextColor={C.textMuted} value={name} onChangeText={setName} />
            <TextInput style={styles.input} placeholder="Email" placeholderTextColor={C.textMuted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <TextInput style={styles.input} placeholder={t('auth.phone')} placeholderTextColor={C.textMuted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <TextInput style={[styles.input, styles.textArea]} placeholder={t('inquiry.message')} placeholderTextColor={C.textMuted} value={message} onChangeText={setMessage} multiline numberOfLines={3} />
            <TouchableOpacity style={styles.sendBtnWrap} onPress={sendInquiry} disabled={sending} activeOpacity={0.8}>
              <LinearGradient colors={['#E11D48', '#9B1B30']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.sendBtn}>
                <Text style={styles.sendBtnText}>{sending ? '...' : t('inquiry.send')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Fixed Bottom CTA */}
      {!showInquiry && (
        <View style={[styles.bottomCta, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity style={styles.ctaApplyWrap} onPress={() => { setInquiryType('apply'); setShowInquiry(true); }} activeOpacity={0.8}>
            <LinearGradient colors={['#E11D48', '#9B1B30']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaApply}>
              <Ionicons name="document-text" size={18} color={C.white} />
              <Text style={styles.ctaApplyText}>{t('inquiry.apply_now')}</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctaContact} onPress={() => { setInquiryType('contact'); setShowInquiry(true); }}>
            <Ionicons name="chatbubble" size={18} color={C.info} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctaVisit} onPress={() => { setInquiryType('visit'); setShowInquiry(true); }}>
            <Ionicons name="calendar" size={18} color={C.warmGold} />
          </TouchableOpacity>
        </View>
      )}

      {/* === FULLSCREEN PHOTO VIEWER === */}
      <FullscreenImageViewer
        images={fullscreenImages}
        initialIndex={fullscreenIndex}
        visible={fullscreenVisible}
        onClose={() => setFullscreenVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.background },
  container: { flex: 1, backgroundColor: C.background },

  // Header
  header: {
    paddingHorizontal: Spacing.base,
    paddingVertical: 8,
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 44, height: 44,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(12,12,14,0.6)',
    borderRadius: 14,
    borderWidth: 1, borderColor: C.glassBorderLight,
  },

  // Hero placeholder
  heroPlaceholder: {
    height: 320,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: C.surfaceLight,
  },
  heroIcon: {
    width: 88, height: 88, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: C.glassBorder,
  },

  // Carousel elements
  counterBadge: {
    position: 'absolute', top: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  counterText: { fontSize: FontSizes.xs, color: '#fff', fontWeight: '600' },
  expandHint: {
    position: 'absolute', bottom: 12, right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  dotsContainer: {
    position: 'absolute', bottom: 12, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { backgroundColor: C.brandRed, width: 20 },
  dotInactive: { backgroundColor: 'rgba(255,255,255,0.5)' },

  // Category Pills (Realtor-style)
  categoryRow: {
    paddingHorizontal: 12, paddingVertical: 12, gap: 8,
  },
  categoryPill: {
    width: 100, height: 70,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    position: 'relative',
  },
  categoryPillActive: {
    borderColor: C.brandRed,
  },
  categoryThumb: {
    width: '100%', height: 40,
    borderTopLeftRadius: 10, borderTopRightRadius: 10,
  },
  categoryThumbPlaceholder: {
    backgroundColor: C.surfaceLight,
    justifyContent: 'center', alignItems: 'center',
  },
  categoryTextWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 3,
    gap: 3,
  },
  categoryLabel: {
    fontSize: 10, fontWeight: '700',
    color: C.textMuted,
  },
  categoryLabelActive: { color: C.white },
  categoryCount: {
    fontSize: 9, fontWeight: '600',
    color: C.textMuted,
  },
  categoryCountActive: { color: C.brandRed },
  categoryActiveDot: {
    position: 'absolute', bottom: 0, left: '50%', marginLeft: -8,
    width: 16, height: 2, borderRadius: 1,
    backgroundColor: C.brandRed,
  },

  // Listing Type Badge
  badgeRow: { alignItems: 'center', marginTop: 14 },
  typeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 6, borderRadius: BorderRadius.full,
  },
  typeBadgeText: { fontSize: FontSizes.xs, fontWeight: '700' },

  // Price
  price: {
    fontSize: 36, fontWeight: '800', color: C.textPrimary,
    textAlign: 'center', marginTop: 10, letterSpacing: -1,
  },

  // Address
  addressRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingHorizontal: Spacing.xl, marginTop: 14,
  },
  addressIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(200,16,46,0.12)',
    justifyContent: 'center', alignItems: 'center', marginTop: 2,
  },
  address: { fontSize: FontSizes.md, fontWeight: '700', color: C.textPrimary },
  city: { fontSize: FontSizes.sm, color: C.textMuted, marginTop: 2, fontWeight: '500' },

  // Features Grid
  featuresGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    paddingHorizontal: Spacing.base, marginTop: 22,
  },
  featureCard: {
    flex: 1, minWidth: '20%',
    backgroundColor: C.surface,
    borderRadius: BorderRadius.card,
    padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
    overflow: 'hidden',
  },
  featureValue: { fontSize: FontSizes.md, fontWeight: '800', color: C.textPrimary, marginTop: 6, letterSpacing: -0.3 },
  featureLabel: { fontSize: 10, color: C.textMuted, marginTop: 2, fontWeight: '600' },

  // Owner Card
  ownerCard: {
    marginHorizontal: Spacing.base, marginTop: 20,
    backgroundColor: C.surface, borderRadius: BorderRadius.card,
    borderWidth: 1, borderColor: C.border,
    overflow: 'hidden', position: 'relative',
  },
  ownerAccent: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
    borderTopLeftRadius: BorderRadius.card, borderTopRightRadius: BorderRadius.card,
  },
  ownerOrb: {
    position: 'absolute', top: -20, right: -20,
    width: 64, height: 64, borderRadius: 32, opacity: 0.06,
  },
  ownerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
  },
  ownerAvatar: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(139,92,246,0.2)', justifyContent: 'center', alignItems: 'center',
  },
  ownerLabel: { fontSize: FontSizes.xs, color: C.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  ownerName: { fontSize: FontSizes.sm, color: C.textPrimary, fontWeight: '700', marginTop: 1 },

  // Description
  descSection: { paddingHorizontal: Spacing.base, marginTop: 20 },
  descLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  sectionLabel: { fontSize: FontSizes.xs, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  descText: { fontSize: FontSizes.sm, color: C.textSecondary, lineHeight: 22 },

  // Inquiry Card
  inquiryCard: {
    marginHorizontal: Spacing.base, marginTop: 20,
    backgroundColor: C.surface, borderRadius: BorderRadius.card,
    padding: Spacing.base, borderWidth: 1, borderColor: C.border,
    overflow: 'hidden', position: 'relative',
  },
  inquiryAccent: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 2.5,
    borderTopLeftRadius: BorderRadius.card, borderTopRightRadius: BorderRadius.card,
  },
  inquiryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  inquiryTitle: { fontSize: FontSizes.md, fontWeight: '800', color: C.textPrimary, letterSpacing: -0.3 },
  input: {
    backgroundColor: C.surfaceLight, borderRadius: BorderRadius.md,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: FontSizes.sm, color: C.white,
    marginBottom: 10, borderWidth: 1, borderColor: C.border,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  sendBtnWrap: { borderRadius: BorderRadius.card, overflow: 'hidden', marginTop: 4, ...Shadows.button },
  sendBtn: { paddingVertical: 14, alignItems: 'center', borderRadius: BorderRadius.card },
  sendBtnText: { color: C.white, fontSize: FontSizes.sm, fontWeight: '800' },

  // Bottom CTA
  bottomCta: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 10, paddingHorizontal: Spacing.base, paddingTop: 12,
    backgroundColor: C.background, borderTopWidth: 1, borderTopColor: C.border,
  },
  ctaApplyWrap: { flex: 1, borderRadius: BorderRadius.card, overflow: 'hidden', ...Shadows.button },
  ctaApply: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: BorderRadius.card,
  },
  ctaApplyText: { color: C.white, fontSize: FontSizes.sm, fontWeight: '800' },
  ctaContact: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: C.infoBg, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)',
  },
  ctaVisit: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: C.warningBg, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)',
  },

});
