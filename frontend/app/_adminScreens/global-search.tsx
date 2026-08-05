import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AdminHeader from '../../components/admin/AdminHeader';
import { useThemeColors } from '../../constants/colors';
import { useRouter } from 'expo-router';

import api from '../../services/api';
import debounce from 'lodash/debounce';
import { useTranslation } from 'react-i18next';

interface SearchResult {
  id: string;
  type: 'client' | 'invoice' | 'project' | 'appointment';
  name?: string;
  email?: string;
  phone?: string;
  client_name?: string;
  amount?: number;
  status?: string;
  scheduled_at?: string;
  description?: string;
  order_number?: string;
}

interface SearchResponse {
  query: string;
  clients: SearchResult[];
  invoices: SearchResult[];
  projects: SearchResult[];
  appointments: SearchResult[];
  total_count: number;
}

export default function GlobalSearchScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'clients' | 'invoices' | 'projects' | 'appointments'>('all');

  // Debounced search function
  const performSearch = useCallback(
    debounce(async (searchQuery: string) => {
      if (searchQuery.length < 2) {
        setResults(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await api.get(`/admin/search?q=${encodeURIComponent(searchQuery)}`);
        setResults(response.data);
      } catch (error: any) {
        console.error('Search error:', error);
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (text.length >= 2) {
      setLoading(true);
    }
    performSearch(text);
  };

  const clearSearch = () => {
    setQuery('');
    setResults(null);
    inputRef.current?.focus();
  };

  const navigateToResult = (item: SearchResult) => {
    Keyboard.dismiss();
    switch (item.type) {
      case 'client':
        router.push({ pathname: '/_adminScreens/client-details', params: { clientId: item.id } });
        break;
      case 'invoice':
        router.push({ pathname: '/_adminScreens/invoice-details', params: { invoiceId: item.id } });
        break;
      case 'project':
        router.push('/_adminScreens/service-orders');
        break;
      case 'appointment':
        router.push('/_adminScreens/appointments');
        break;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'client': return 'person';
      case 'invoice': return 'receipt';
      case 'project': return 'briefcase';
      case 'appointment': return 'calendar';
      default: return 'document';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'client': return '#3B82F6';
      case 'invoice': return '#10B981';
      case 'project': return '#8B5CF6';
      case 'appointment': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'client': return 'Cliente';
      case 'invoice': return 'Factura';
      case 'project': return 'Proyecto';
      case 'appointment': return 'Cita';
      default: return type;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const getAllResults = (): SearchResult[] => {
    if (!results) return [];
    
    switch (activeTab) {
      case 'clients':
        return results.clients || [];
      case 'invoices':
        return results.invoices || [];
      case 'projects':
        return results.projects || [];
      case 'appointments':
        return results.appointments || [];
      default:
        return [
          ...(results.clients || []),
          ...(results.invoices || []),
          ...(results.projects || []),
          ...(results.appointments || []),
        ];
    }
  };

  const getTabCount = (tab: string) => {
    if (!results) return 0;
    switch (tab) {
      case 'clients': return results.clients?.length || 0;
      case 'invoices': return results.invoices?.length || 0;
      case 'projects': return results.projects?.length || 0;
      case 'appointments': return results.appointments?.length || 0;
      default: return results.total_count || 0;
    }
  };

  const renderHeader = () => (
    <AdminHeader 
      title="Búsqueda Global" 
      subtitle="Clientes, facturas, proyectos..."
    />
  );

  const renderSearchInput = () => (
    <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Ionicons name="search" size={22} color={colors.textSecondary} />
      <TextInput
        ref={inputRef}
        style={[styles.searchInput, { color: colors.text }]}
        placeholder={t('admin.globalSearchPlaceholder', 'Buscar por nombre, email, teléfono...')}
        placeholderTextColor={colors.textSecondary}
        value={query}
        onChangeText={handleQueryChange}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {query.length > 0 && (
        <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
          <Ionicons name="close-circle" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      )}
      {loading && <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />}
    </View>
  );

  const renderTabs = () => {
    if (!results || results.total_count === 0) return null;

    const tabs = [
      { key: 'all', label: 'Todos' },
      { key: 'clients', label: 'Clientes' },
      { key: 'invoices', label: 'Facturas' },
      { key: 'projects', label: 'Proyectos' },
      { key: 'appointments', label: 'Citas' },
    ];

    return (
      <View style={styles.tabsContainer}>
        <FlatList
          horizontal
          data={tabs}
          keyExtractor={(item) => item.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
          renderItem={({ item }) => {
            const count = getTabCount(item.key);
            const isActive = activeTab === item.key;
            return (
              <TouchableOpacity
                style={[
                  styles.tab,
                  { borderColor: isActive ? colors.primary : colors.border },
                  isActive && { backgroundColor: colors.primary },
                ]}
                onPress={() => setActiveTab(item.key as any)}
              >
                <Text style={[
                  styles.tabLabel,
                  { color: isActive ? '#fff' : colors.text },
                ]}>
                  {item.label}
                </Text>
                <View style={[
                  styles.tabBadge,
                  { backgroundColor: isActive ? 'rgba(255,255,255,0.3)' : colors.background },
                ]}>
                  <Text style={[
                    styles.tabBadgeText,
                    { color: isActive ? '#fff' : colors.textSecondary },
                  ]}>
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    );
  };

  const renderResultItem = ({ item }: { item: SearchResult }) => {
    const typeColor = getTypeColor(item.type);
    
    return (
      <TouchableOpacity
        style={[styles.resultItem, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => navigateToResult(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.resultIcon, { backgroundColor: typeColor + '20' }]}>
          <Ionicons name={getTypeIcon(item.type) as any} size={24} color={typeColor} />
        </View>
        <View style={styles.resultContent}>
          <View style={styles.resultHeader}>
            <Text style={[styles.resultTitle, { color: colors.text }]} numberOfLines={1}>
              {item.name || item.client_name || item.order_number || `#${item.id.slice(0, 8)}`}
            </Text>
            <View style={[styles.typeBadge, { backgroundColor: typeColor + '20' }]}>
              <Text style={[styles.typeBadgeText, { color: typeColor }]}>
                {getTypeLabel(item.type)}
              </Text>
            </View>
          </View>
          
          {item.email && (
            <View style={styles.resultRow}>
              <Ionicons name="mail-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.resultDetail, { color: colors.textSecondary }]} numberOfLines={1}>
                {item.email}
              </Text>
            </View>
          )}
          
          {item.phone && (
            <View style={styles.resultRow}>
              <Ionicons name="call-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.resultDetail, { color: colors.textSecondary }]}>
                {item.phone}
              </Text>
            </View>
          )}
          
          {item.amount !== undefined && (
            <View style={styles.resultRow}>
              <Ionicons name="cash-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.resultDetail, { color: colors.textSecondary }]}>
                ${item.amount.toLocaleString()}
              </Text>
              {item.status && (
                <View style={[styles.statusBadge, { 
                  backgroundColor: item.status === 'paid' ? '#10B98120' : 
                                   item.status === 'overdue' ? '#EF444420' : '#F59E0B20' 
                }]}>
                  <Text style={[styles.statusText, { 
                    color: item.status === 'paid' ? '#10B981' : 
                           item.status === 'overdue' ? '#EF4444' : '#F59E0B' 
                  }]}>
                    {item.status === 'paid' ? 'Pagada' : 
                     item.status === 'overdue' ? 'Vencida' : 'Pendiente'}
                  </Text>
                </View>
              )}
            </View>
          )}
          
          {item.scheduled_at && (
            <View style={styles.resultRow}>
              <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.resultDetail, { color: colors.textSecondary }]}>
                {formatDate(item.scheduled_at)}
              </Text>
            </View>
          )}
          
          {item.description && (
            <View style={styles.resultRow}>
              <Ionicons name="document-text-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.resultDetail, { color: colors.textSecondary }]} numberOfLines={1}>
                {item.description}
              </Text>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    if (loading) return null;
    
    if (query.length < 2) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Busca lo que necesites</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Escribe al menos 2 caracteres para buscar clientes, facturas, proyectos o citas.
          </Text>
        </View>
      );
    }

    if (results && results.total_count === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="search" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Sin resultados</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            No encontramos nada para "{query}". Intenta con otros términos.
          </Text>
        </View>
      );
    }

    return null;
  };

  const allResults = getAllResults();

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {renderHeader()}
      
      <View style={styles.content}>
        {renderSearchInput()}
        {renderTabs()}
        
        {allResults.length > 0 ? (
          <FlatList
            data={allResults}
            keyExtractor={(item) => `${item.type}-${item.id}`}
            renderItem={renderResultItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          />
        ) : (
          renderEmptyState()
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
  },
  tabsContainer: {
    marginBottom: 8,
  },
  tabsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  tabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  tabBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  resultIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 8,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  resultDetail: {
    fontSize: 13,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
