import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useColors } from '../../src/constants/theme';
import { Config } from '../../src/constants/config';
import { PropertyListCard, SearchHeader, FilterSheet } from '../../src/components/market';

const API = Config.API_URL;

interface Listing {
  id: string; address: string; city: string; state: string; zip_code: string;
  type: string; beds: number; baths: number; sqft: number;
  list_price: number; image_url?: string; status: string;
  days_on_market: number; is_foreclosure: number; neighborhood?: string;
  latitude?: number; longitude?: number;
  source?: 'marketplace' | 'mashvisor' | string;
}

interface Filters {
  min_price: string; max_price: string; beds: string; baths: string; property_type: string;
}

const EMPTY_FILTERS: Filters = { min_price: '', max_price: '', beds: '', baths: '', property_type: '' };

export default function MarketScreen() {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [city, setCity] = useState('Dumas');
  const [state, setState] = useState('TX');
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [searched, setSearched] = useState(false);
  const [addressFilter, setAddressFilter] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [searchingAddress, setSearchingAddress] = useState(false);

  const fetchListings = useCallback(async (p = 1, f?: Filters, append = false, overrideCity?: string, overrideState?: string, address?: string) => {
    const ff = f || filters;
    const searchCity = overrideCity || city;
    const searchState = overrideState || state;
    const searchAddress = address !== undefined ? address : addressFilter;
    
    if (p === 1) { setLoading(true); setError(null); }
    else setLoadingMore(true);

    const params = new URLSearchParams({ page: String(p), page_limit: '12' });
    if (ff.min_price) params.set('min_price', ff.min_price);
    if (ff.max_price) params.set('max_price', ff.max_price);
    if (ff.beds) params.set('beds', ff.beds);
    if (ff.baths) params.set('baths', ff.baths);
    if (ff.property_type) params.set('property_type', ff.property_type);
    if (searchAddress) params.set('address', searchAddress);

    try {
      // Fetch BOTH external (Mashvisor) and internal marketplace listings in parallel
      const externalUrl = `${API}/api/public/market/listings/${searchState}/${encodeURIComponent(searchCity)}?${params}`;
      const internalParams = new URLSearchParams({ page_limit: '24' });
      if (searchCity) internalParams.set('city', searchCity);
      if (searchState) internalParams.set('state', searchState);
      if (ff.min_price) internalParams.set('min_rent', ff.min_price);
      if (ff.max_price) internalParams.set('max_rent', ff.max_price);
      if (ff.beds) internalParams.set('beds', ff.beds);
      if (ff.baths) internalParams.set('baths', ff.baths);
      if (ff.property_type) internalParams.set('property_type', ff.property_type);
      const internalUrl = `${API}/api/public/marketplace/listings?${internalParams}`;

      const [extRes, intRes] = await Promise.allSettled([
        fetch(externalUrl),
        fetch(internalUrl),
      ]);

      let externalListings: Listing[] = [];
      let externalTotal = 0;
      if (extRes.status === 'fulfilled' && extRes.value.ok) {
        const data = await extRes.value.json();
        if (data.status === 'success') {
          externalListings = data.listings || [];
          externalTotal = data.total || 0;
        }
      }

      // Normalize internal marketplace listings to match Listing interface
      let internalListings: Listing[] = [];
      let internalTotal = 0;
      if (intRes.status === 'fulfilled' && intRes.value.ok) {
        const idata = await intRes.value.json();
        const rawList = idata.listings || [];
        internalListings = rawList.map((l: any) => ({
          id: l.id,
          address: l.address,
          city: l.city,
          state: l.state,
          zip_code: l.zip_code,
          type: l.property_type || 'house',
          beds: l.bedrooms || 0,
          baths: l.bathrooms || 0,
          sqft: l.square_feet || 0,
          list_price: l.listing_type === 'sale' ? (l.sale_price || 0) : (l.rent_amount || 0),
          image_url: l.image_url || (l.photos || [])[0],
          status: l.listing_type === 'sale' ? 'For Sale' : 'For Rent',
          days_on_market: 0,
          is_foreclosure: 0,
          source: 'marketplace',
        }));
        internalTotal = idata.total || internalListings.length;
      }

      // Merge: internal first (real listings from platform landlords), then external
      const merged = p === 1
        ? [...internalListings, ...externalListings]
        : externalListings; // pagination loads more external only

      setListings(prev => append ? [...prev, ...externalListings] : merged);
      setTotal((p === 1 ? internalTotal : 0) + externalTotal);
      setPage(p);
      setSearched(true);
    } catch (e: any) {
      console.error('Market fetch error:', e);
      if (p === 1) {
        setError('No se pudo conectar al servicio de mercado. Intenta de nuevo.');
        setSearched(true);
      }
    }
    setLoading(false);
    setLoadingMore(false);
    setRefreshing(false);
  }, [city, state, filters]);

  const handleSearch = () => fetchListings(1);
  const handleRefresh = () => { setRefreshing(true); fetchListings(1); };
  const handleLoadMore = () => {
    if (!loadingMore && listings.length < total) fetchListings(page + 1, filters, true);
  };
  const handleFilterApply = (f: Filters) => { setFilters(f); fetchListings(1, f); };

  const handleAddressSearch = async (address: string) => {
    setAddressFilter(address);
    
    if (!address.trim()) {
      // If address is cleared, do a normal search
      fetchListings(1);
      return;
    }
    
    setSearchingAddress(true);
    setLoading(true);
    setError(null);
    
    try {
      // First, try the specific address search endpoint
      const searchUrl = `${API}/api/public/market/search-by-address?address=${encodeURIComponent(address)}&city=${encodeURIComponent(city)}&state=${state}`;
      const res = await fetch(searchUrl);
      const data = await res.json();
      
      if (data.status === 'success' && data.found && data.property) {
        // Found exact property - show it as the only result
        const prop = data.property;
        const listing: Listing = {
          id: prop.id || `addr-${Date.now()}`,
          address: prop.address || address,
          city: prop.city || city,
          state: prop.state || state,
          zip_code: prop.zip || '',
          type: prop.home_type || 'single_family',
          beds: prop.beds || 0,
          baths: prop.baths || 0,
          sqft: prop.sqft || 0,
          list_price: prop.list_price || prop.last_sale_price || 0,
          image_url: prop.image,
          status: 'for_sale',
          days_on_market: 0,
          is_foreclosure: 0,
          latitude: prop.latitude,
          longitude: prop.longitude,
        };
        setListings([listing]);
        setTotal(1);
        setSearched(true);
      } else {
        // Property not found in specific search, try filtering from listings
        const params = new URLSearchParams({ page: '1', page_limit: '50', address: address.trim() });
        const listUrl = `${API}/api/public/market/listings/${state}/${encodeURIComponent(city)}?${params}`;
        const listRes = await fetch(listUrl);
        const listData = await listRes.json();
        
        if (listData.status === 'success') {
          const newListings = listData.listings || [];
          if (newListings.length > 0) {
            setListings(newListings);
            setTotal(newListings.length);
          } else {
            setListings([]);
            setTotal(0);
            setError(`No se encontró la dirección "${address}" en ${city}, ${state}`);
          }
        } else {
          setListings([]);
          setTotal(0);
          setError(`No se encontró la dirección "${address}"`);
        }
        setSearched(true);
      }
    } catch (e) {
      console.error('Address search error:', e);
      setError('Error al buscar la dirección. Intenta de nuevo.');
      setSearched(true);
    } finally {
      setLoading(false);
      setSearchingAddress(false);
    }
  };

  const openDetail = (listing: Listing) => {
    router.push({
      pathname: '/market-detail',
      params: {
        id: listing.id,
        data: JSON.stringify(listing),
      },
    });
  };

  const POPULAR_CITIES = [
    { city: 'Dumas', state: 'TX' },
    { city: 'Amarillo', state: 'TX' },
    { city: 'Dallas', state: 'TX' },
    { city: 'Houston', state: 'TX' },
    { city: 'Austin', state: 'TX' },
  ];

  const quickSearch = (c: string, s: string) => {
    setCity(c);
    setState(s);
    fetchListings(1, filters, false, c, s);
  };

  const renderItem = ({ item }: { item: Listing }) => (
    <PropertyListCard listing={item} onPress={() => openDetail(item)} />
  );

  const ListEmpty = () => {
    if (loading) return null;
    if (!searched) {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="search" size={48} color={C.brandRed} />
          </View>
          <Text style={styles.emptyTitle}>Explora el Mercado</Text>
          <Text style={styles.emptyDesc}>
            Busca propiedades en venta en cualquier ciudad de EE.UU. Encuentra tu próxima inversión o tu nuevo hogar.
          </Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={handleSearch}>
            <Ionicons name="search" size={18} color="#fff" />
            <Text style={styles.emptyBtnText}>Buscar en {city}, {state}</Text>
          </TouchableOpacity>

          {/* Quick City Picks */}
          <Text style={styles.quickLabel}>Ciudades Populares</Text>
          <View style={styles.quickRow}>
            {POPULAR_CITIES.map(c => (
              <TouchableOpacity
                key={c.city}
                style={[styles.quickChip, city === c.city && styles.quickChipActive]}
                onPress={() => quickSearch(c.city, c.state)}
              >
                <Ionicons name="location" size={12} color={city === c.city ? C.brandRed : C.textDim} />
                <Text style={[styles.quickChipText, city === c.city && styles.quickChipTextActive]}>
                  {c.city}, {c.state}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconWrap, { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)' }]}>
            <Ionicons name="cloud-offline-outline" size={48} color={C.error} />
          </View>
          <Text style={styles.emptyTitle}>Error de Conexión</Text>
          <Text style={styles.emptyDesc}>{error}</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={handleSearch}>
            <Ionicons name="refresh" size={18} color="#fff" />
            <Text style={styles.emptyBtnText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="home-outline" size={48} color={C.textDim} />
        <Text style={styles.emptyTitle}>Sin Resultados</Text>
        <Text style={styles.emptyDesc}>Intenta cambiar los filtros o busca en otra ciudad.</Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Mercado</Text>
          <Text style={styles.headerSubtitle}>Propiedades en venta</Text>
        </View>
        <View style={styles.headerBadge}>
          <Ionicons name="trending-up" size={16} color={C.brandRed} />
          <Text style={styles.headerBadgeText}>En Vivo</Text>
        </View>
      </View>

      <SearchHeader
        city={city} state={state}
        onCityChange={setCity} onStateChange={setState}
        onSearch={handleSearch} onFilterPress={() => setShowFilters(true)}
        onAddressSearch={handleAddressSearch}
        loading={loading} resultCount={searched ? total : undefined}
      />

      {loading && listings.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={C.brandRed} />
          <Text style={styles.loadingText}>Buscando propiedades...</Text>
        </View>
      ) : (
        <FlatList
          data={listings}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={ListEmpty}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh}
              tintColor={C.brandRed} colors={[C.brandRed]} />
          }
          ListFooterComponent={loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={C.brandRed} />
              <Text style={styles.footerText}>Cargando más...</Text>
            </View>
          ) : null}
        />
      )}

      <FilterSheet
        visible={showFilters}
        filters={filters}
        onApply={handleFilterApply}
        onClose={() => setShowFilters(false)}
      />
    </View>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4,
  },
  headerTitle: { color: C.textPrimary, fontSize: 28, fontWeight: '900' },
  headerSubtitle: { color: C.textDim, fontSize: 12, marginTop: 2, fontWeight: '500' },
  headerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(237,27,51,0.1)', borderWidth: 1, borderColor: 'rgba(237,27,51,0.2)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12,
  },
  headerBadgeText: { color: C.brandRed, fontSize: 11, fontWeight: '800' },
  row: { justifyContent: 'space-between', paddingHorizontal: 16 },
  listContent: { paddingTop: 4, paddingBottom: 100 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 },
  loadingText: { color: C.textDim, fontSize: 14, marginTop: 12, fontWeight: '500' },
  footerLoader: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 20 },
  footerText: { color: C.textDim, fontSize: 12 },
  emptyContainer: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: 'rgba(237,27,51,0.1)', borderWidth: 1, borderColor: 'rgba(237,27,51,0.2)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  emptyTitle: { color: C.textPrimary, fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  emptyDesc: { color: C.textDim, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.brandRed, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16,
  },
  emptyBtnText: { color: C.textPrimary, fontWeight: '800', fontSize: 15 },
  quickLabel: {
    color: C.textDim, fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1,
    marginTop: 32, marginBottom: 12,
  },
  quickRow: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8,
  },
  quickChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
    backgroundColor: C.glass,
    borderWidth: 1, borderColor: C.glassBorder,
  },
  quickChipActive: {
    backgroundColor: 'rgba(200,16,46,0.1)', borderColor: 'rgba(200,16,46,0.3)',
  },
  quickChipText: { color: C.textDim, fontSize: 12, fontWeight: '600' },
  quickChipTextActive: { color: C.brandRed },
});
