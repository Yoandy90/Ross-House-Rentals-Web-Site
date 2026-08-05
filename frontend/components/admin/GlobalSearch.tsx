/**
 * Global Search Component for Admin
 * Allows searching clients from anywhere in the admin panel
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  Keyboard,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';

interface SearchResult {
  id: string;
  type: 'client' | 'invoice' | 'appointment';
  name: string;
  subtitle: string;
  icon: string;
  color: string;
}

interface GlobalSearchProps {
  visible: boolean;
  onClose: () => void;
}

export default function GlobalSearch({ visible, onClose }: GlobalSearchProps) {
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [visible]);

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (query.length >= 2) {
        performSearch();
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(delaySearch);
  }, [query]);

  const performSearch = async () => {
    setLoading(true);
    try {
      // Search clients
      const clientsResponse = await api.get('/admin/clients', {
        params: { search: query, limit: 10 }
      });
      
      const clients = (clientsResponse.data.clients || []).map((client: any) => ({
        id: client.id || client._id,
        type: 'client' as const,
        name: client.name || client.full_name || 'Sin nombre',
        subtitle: client.email || client.phone || '',
        icon: 'person',
        color: '#6C1110',
      }));

      // Combine results
      setResults([...clients]);
      
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectResult = (result: SearchResult) => {
    // Save to recent searches
    const newRecent = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
    setRecentSearches(newRecent);
    
    // Navigate based on type
    Keyboard.dismiss();
    onClose();
    
    setTimeout(() => {
      switch (result.type) {
        case 'client':
          router.push(`/_adminScreens/client-details?id=${result.id}`);
          break;
        case 'invoice':
          router.push(`/_adminScreens/invoice-details?id=${result.id}`);
          break;
        case 'appointment':
          router.push(`/_adminScreens/appointments-calendar`);
          break;
      }
    }, 100);
  };

  const renderResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => handleSelectResult(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.resultIcon, { backgroundColor: item.color + '15' }]}>
        <Ionicons name={item.icon as any} size={24} color={item.color} />
      </View>
      <View style={styles.resultContent}>
        <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.resultSubtitle} numberOfLines={1}>{item.subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#999" />
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay} 
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity 
          activeOpacity={1} 
          style={styles.container}
          onPress={e => e.stopPropagation()}
        >
          {/* Search Header */}
          <View style={styles.searchHeader}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color="#999" />
              <TextInput
                ref={inputRef}
                style={styles.searchInput}
                placeholder="Buscar clientes, facturas..."
                placeholderTextColor="#999"
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery('')}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>

          {/* Results */}
          <View style={styles.resultsContainer}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#1e3a5f" />
                <Text style={styles.loadingText}>Buscando...</Text>
              </View>
            ) : results.length > 0 ? (
              <FlatList
                data={results}
                renderItem={renderResult}
                keyExtractor={(item) => `${item.type}-${item.id}`}
                contentContainerStyle={styles.resultsList}
                keyboardShouldPersistTaps="handled"
              />
            ) : query.length >= 2 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={48} color="#ddd" />
                <Text style={styles.emptyText}>No se encontraron resultados</Text>
                <Text style={styles.emptySubtext}>Intenta con otro término de búsqueda</Text>
              </View>
            ) : (
              <View style={styles.hintsContainer}>
                <Text style={styles.hintsTitle}>💡 Consejos de búsqueda</Text>
                <View style={styles.hintItem}>
                  <Ionicons name="person" size={18} color="#1e3a5f" />
                  <Text style={styles.hintText}>Busca por nombre, email o teléfono</Text>
                </View>
                <View style={styles.hintItem}>
                  <Ionicons name="receipt" size={18} color="#1e3a5f" />
                  <Text style={styles.hintText}>Escribe al menos 2 caracteres</Text>
                </View>
                {recentSearches.length > 0 && (
                  <>
                    <Text style={[styles.hintsTitle, { marginTop: 20 }]}>🕐 Búsquedas recientes</Text>
                    {recentSearches.map((search, index) => (
                      <TouchableOpacity 
                        key={index}
                        style={styles.recentItem}
                        onPress={() => setQuery(search)}
                      >
                        <Ionicons name="time-outline" size={18} color="#999" />
                        <Text style={styles.recentText}>{search}</Text>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
              </View>
            )}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: Platform.OS === 'ios' ? 50 : 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    gap: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  cancelText: {
    fontSize: 16,
    color: '#1e3a5f',
    fontWeight: '500',
  },
  resultsContainer: {
    flex: 1,
  },
  resultsList: {
    padding: 16,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
    gap: 12,
  },
  resultIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultContent: {
    flex: 1,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  resultSubtitle: {
    fontSize: 13,
    color: '#999',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
  hintsContainer: {
    padding: 20,
  },
  hintsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  hintItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  hintText: {
    fontSize: 14,
    color: '#666',
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  recentText: {
    fontSize: 14,
    color: '#333',
  },
});
