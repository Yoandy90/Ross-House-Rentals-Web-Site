/**
 * Documents Management - Client Folders View
 * Shows clients as folders, tap to see their documents
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
  TextInput,
  Platform,
  Dimensions,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import api from '../../services/api';

const SCREEN_HEIGHT = Dimensions.get('window').height;

// Static colors
const colors = {
  primary: '#6C1110',
  background: '#FFFFFF',
  backgroundGray: '#F5F5F7',
  text: '#1A1A1A',
  textGray: '#6B7280',
  textWhite: '#FFFFFF',
  border: '#E5E5E5',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
};

interface Document {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  name: string;
  category: string;
  file_type: string;
  file_data?: string;
  size: number;
  uploaded_at: string;
  reviewed: boolean;
}

interface ClientFolder {
  id: string;
  name: string;
  email: string;
  documentsCount: number;
  pendingCount: number;
  lastUpload?: string;
}

export default function DocumentsManagement() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Client folders
  const [clientFolders, setClientFolders] = useState<ClientFolder[]>([]);
  const [filteredFolders, setFilteredFolders] = useState<ClientFolder[]>([]);
  
  // Selected client documents
  const [selectedClient, setSelectedClient] = useState<ClientFolder | null>(null);
  const [clientDocuments, setClientDocuments] = useState<Document[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  
  // Document preview
  const [previewModal, setPreviewModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  
  // Stats
  const [totalDocs, setTotalDocs] = useState(0);
  const [pendingDocs, setPendingDocs] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterFolders();
  }, [searchQuery, clientFolders]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Get all documents
      const docsResponse = await api.get('/admin/documents?limit=500');
      const allDocs: Document[] = docsResponse.data || [];
      
      // Group by client
      const clientsMap = new Map<string, ClientFolder>();
      let total = 0;
      let pending = 0;
      
      allDocs.forEach(doc => {
        total++;
        if (!doc.reviewed) pending++;
        
        const clientId = doc.user_id || 'unknown';
        if (clientsMap.has(clientId)) {
          const client = clientsMap.get(clientId)!;
          client.documentsCount++;
          if (!doc.reviewed) client.pendingCount++;
          if (!client.lastUpload || new Date(doc.uploaded_at) > new Date(client.lastUpload)) {
            client.lastUpload = doc.uploaded_at;
          }
        } else {
          clientsMap.set(clientId, {
            id: clientId,
            name: doc.user_name || 'Cliente',
            email: doc.user_email || '',
            documentsCount: 1,
            pendingCount: doc.reviewed ? 0 : 1,
            lastUpload: doc.uploaded_at,
          });
        }
      });
      
      // Convert to array and sort
      const folders = Array.from(clientsMap.values()).sort((a, b) => {
        if (!a.lastUpload) return 1;
        if (!b.lastUpload) return -1;
        return new Date(b.lastUpload).getTime() - new Date(a.lastUpload).getTime();
      });
      
      setClientFolders(folders);
      setFilteredFolders(folders);
      setTotalDocs(total);
      setPendingDocs(pending);
    } catch (error) {
      console.error('Error loading documents:', error);
      Alert.alert('Error', 'No se pudieron cargar los documentos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterFolders = () => {
    if (!searchQuery.trim()) {
      setFilteredFolders(clientFolders);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = clientFolders.filter(client =>
      client.name.toLowerCase().includes(query) ||
      client.email.toLowerCase().includes(query)
    );
    setFilteredFolders(filtered);
  };

  const openClientFolder = async (client: ClientFolder) => {
    try {
      setSelectedClient(client);
      setLoadingDocuments(true);
      
      const response = await api.get(`/admin/documents?user_id=${client.id}&limit=100`);
      setClientDocuments(response.data || []);
    } catch (error) {
      console.error('Error loading client documents:', error);
      Alert.alert('Error', 'No se pudieron cargar los documentos');
    } finally {
      setLoadingDocuments(false);
    }
  };

  const closeClientFolder = () => {
    setSelectedClient(null);
    setClientDocuments([]);
  };

  const handleViewDocument = async (doc: Document) => {
    try {
      setPreviewLoading(true);
      setPreviewModal(true);
      
      const response = await api.get(`/admin/documents/${doc.id}`);
      setSelectedDocument(response.data);
    } catch (error) {
      console.error('Error loading document:', error);
      Alert.alert('Error', 'No se pudo cargar el documento');
      setPreviewModal(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownloadDocument = async (doc: Document) => {
    try {
      console.log('Downloading document:', doc.id, doc.name);
      const response = await api.get(`/admin/documents/${doc.id}`);
      const fileData = response.data.file_data;
      
      if (!fileData) {
        Alert.alert('Error', 'El documento no tiene contenido');
        return;
      }

      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = `data:${doc.file_type};base64,${fileData}`;
        link.download = doc.name;
        link.click();
        Alert.alert('Éxito', 'Documento descargado');
      } else {
        // Mobile: Use FileSystem and Sharing
        const fileName = doc.name || 'documento';
        const fileUri = FileSystem.cacheDirectory + fileName;
        
        console.log('Writing to:', fileUri);
        
        // Use string 'base64' instead of EncodingType
        await FileSystem.writeAsStringAsync(fileUri, fileData, {
          encoding: 'base64',
        });
        
        const canShare = await Sharing.isAvailableAsync();
        console.log('Can share:', canShare);
        
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: doc.file_type || 'application/octet-stream',
            dialogTitle: 'Compartir documento',
          });
        } else {
          Alert.alert('Éxito', 'Documento guardado en: ' + fileUri);
        }
      }
    } catch (error: any) {
      console.error('Error downloading document:', error);
      Alert.alert('Error', 'No se pudo descargar: ' + (error.message || 'Error desconocido'));
    }
  };

  const handleMarkReviewed = async (docId: string, reviewed: boolean) => {
    try {
      console.log('Marking document as reviewed:', docId, reviewed);
      const response = await api.patch(`/admin/documents/${docId}/mark-reviewed?reviewed=${reviewed}`);
      console.log('Mark reviewed response:', response.status);
      
      Alert.alert('Éxito', `Documento marcado como ${reviewed ? 'revisado' : 'pendiente'}`);
      
      // Refresh data
      if (selectedClient) {
        await openClientFolder(selectedClient);
      }
      await loadData();
      setPreviewModal(false);
    } catch (error: any) {
      console.error('Error marking document:', error);
      console.error('Error details:', error.response?.data);
      Alert.alert('Error', 'No se pudo actualizar: ' + (error.response?.data?.detail || error.message || 'Error desconocido'));
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'CL';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      return format(new Date(dateStr), 'dd MMM', { locale: es });
    } catch {
      return '';
    }
  };

  const renderClientFolder = ({ item }: { item: ClientFolder }) => (
    <TouchableOpacity
      style={styles.folderCard}
      onPress={() => openClientFolder(item)}
      activeOpacity={0.7}
    >
      <View style={styles.folderIcon}>
        <Text style={styles.folderInitials}>{getInitials(item.name)}</Text>
      </View>
      <View style={styles.folderInfo}>
        <Text style={styles.folderName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.folderEmail} numberOfLines={1}>{item.email}</Text>
      </View>
      <View style={styles.folderMeta}>
        <View style={styles.docCountBadge}>
          <Ionicons name="document" size={14} color={colors.primary} />
          <Text style={styles.docCountText}>{item.documentsCount}</Text>
        </View>
        {item.pendingCount > 0 && (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingText}>{item.pendingCount} nuevo{item.pendingCount > 1 ? 's' : ''}</Text>
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textGray} />
    </TouchableOpacity>
  );

  const renderDocument = ({ item }: { item: Document }) => {
    const isImage = item.file_type?.startsWith('image/');
    const isPdf = item.file_type?.includes('pdf');
    
    return (
      <TouchableOpacity
        style={styles.documentCard}
        onPress={() => handleViewDocument(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.docIcon, { backgroundColor: isPdf ? '#FFE5E5' : isImage ? '#E5F3FF' : '#F0F0F0' }]}>
          <Ionicons 
            name={isPdf ? 'document-text' : isImage ? 'image' : 'document'} 
            size={22} 
            color={isPdf ? colors.primary : isImage ? '#2196F3' : colors.textGray} 
          />
        </View>
        <View style={styles.docInfo}>
          <Text style={styles.docName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.docDate}>{formatDate(item.uploaded_at)}</Text>
        </View>
        {!item.reviewed && <View style={styles.newDot} />}
      </TouchableOpacity>
    );
  };

  // Main view - Client folders
  if (!selectedClient) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[colors.primary, '#8B1A19']} style={styles.header}>
          <SafeAreaView edges={['top']} style={styles.headerSafe}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={24} color="#FFF" />
              </TouchableOpacity>
              <View style={styles.headerCenter}>
                <Text style={styles.headerTitle}>Documentos</Text>
                <Text style={styles.headerSubtitle}>{clientFolders.length} clientes</Text>
              </View>
              <TouchableOpacity onPress={loadData} style={styles.refreshBtn}>
                <Ionicons name="refresh" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{totalDocs}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: colors.warning }]}>{pendingDocs}</Text>
            <Text style={styles.statLabel}>Pendientes</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: colors.success }]}>{totalDocs - pendingDocs}</Text>
            <Text style={styles.statLabel}>Revisados</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.textGray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nombre de cliente..."
            placeholderTextColor={colors.textGray}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.textGray} />
            </TouchableOpacity>
          )}
        </View>

        {/* Client Folders List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Cargando clientes...</Text>
          </View>
        ) : filteredFolders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open-outline" size={64} color={colors.textGray} />
            <Text style={styles.emptyText}>
              {searchQuery ? 'No se encontraron clientes' : 'No hay documentos'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredFolders}
            renderItem={renderClientFolder}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    );
  }

  // Client Documents View
  return (
    <View style={styles.container}>
      <LinearGradient colors={[colors.primary, '#8B1A19']} style={styles.header}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={closeClientFolder} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle} numberOfLines={1}>{selectedClient.name}</Text>
              <Text style={styles.headerSubtitle}>{clientDocuments.length} documentos</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Client Info Card */}
      <View style={styles.clientInfoCard}>
        <View style={styles.clientAvatar}>
          <Text style={styles.clientInitials}>{getInitials(selectedClient.name)}</Text>
        </View>
        <View style={styles.clientDetails}>
          <Text style={styles.clientName}>{selectedClient.name}</Text>
          <Text style={styles.clientEmail}>{selectedClient.email}</Text>
        </View>
        {selectedClient.pendingCount > 0 && (
          <View style={styles.clientStats}>
            <Text style={styles.clientStatNumber}>{selectedClient.pendingCount}</Text>
            <Text style={styles.clientStatLabel}>Pendientes</Text>
          </View>
        )}
      </View>

      {/* Documents List */}
      {loadingDocuments ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : clientDocuments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-outline" size={64} color={colors.textGray} />
          <Text style={styles.emptyText}>No hay documentos</Text>
        </View>
      ) : (
        <FlatList
          data={clientDocuments}
          renderItem={renderDocument}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          numColumns={2}
          columnWrapperStyle={styles.documentRow}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Document Preview Modal */}
      <Modal
        visible={previewModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setPreviewModal(false)}
      >
        <View style={styles.previewModalContainer}>
          {/* Red Header with Gradient */}
          <LinearGradient colors={[colors.primary, '#8B1A19']} style={styles.previewHeaderGradient}>
            <SafeAreaView edges={['top']} style={styles.previewHeaderSafeArea}>
              <View style={styles.previewHeaderRow}>
                <TouchableOpacity onPress={() => setPreviewModal(false)} style={styles.previewCloseBtn}>
                  <Ionicons name="close" size={26} color="#FFF" />
                </TouchableOpacity>
                <View style={styles.previewHeaderCenter}>
                  <Text style={styles.previewTitleWhite}>Vista Previa</Text>
                  {selectedDocument && (
                    <View style={[styles.previewBadgeWhite, { backgroundColor: selectedDocument.reviewed ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)' }]}>
                      <Ionicons 
                        name={selectedDocument.reviewed ? 'checkmark-circle' : 'time'} 
                        size={12} 
                        color="#FFF" 
                      />
                      <Text style={styles.previewBadgeTextWhite}>
                        {selectedDocument.reviewed ? 'Revisado' : 'Pendiente'}
                      </Text>
                    </View>
                  )}
                </View>
                {selectedDocument && (
                  <TouchableOpacity 
                    onPress={() => handleDownloadDocument(selectedDocument)} 
                    style={styles.previewDownloadBtn}
                  >
                    <Ionicons name="download-outline" size={24} color="#FFF" />
                  </TouchableOpacity>
                )}
              </View>
            </SafeAreaView>
          </LinearGradient>

          {/* Content */}
          <View style={styles.previewContent}>
            {previewLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Cargando documento...</Text>
              </View>
            ) : selectedDocument ? (
              <ScrollView 
                style={styles.previewScroll} 
                contentContainerStyle={styles.previewScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Document Info Card */}
                <View style={styles.previewInfoCard}>
                  <Text style={styles.previewDocName} numberOfLines={2}>{selectedDocument.name}</Text>
                  <Text style={styles.previewDocMeta}>{formatDate(selectedDocument.uploaded_at)}</Text>
                </View>

                {/* Preview Area */}
                {selectedDocument.file_type?.startsWith('image/') && selectedDocument.file_data ? (
                  <View style={styles.imageContainer}>
                    <Image
                      source={{ uri: `data:${selectedDocument.file_type};base64,${selectedDocument.file_data}` }}
                      style={styles.previewImage}
                      resizeMode="contain"
                    />
                  </View>
                ) : (
                  <View style={styles.pdfPreview}>
                    <View style={styles.pdfIconWrapper}>
                      <Ionicons name="document-text" size={56} color={colors.primary} />
                    </View>
                    <Text style={styles.pdfText}>Documento PDF</Text>
                    <Text style={styles.pdfSubtext}>Descarga para ver el contenido</Text>
                  </View>
                )}
              </ScrollView>
            ) : null}
          </View>

          {/* Fixed Bottom Actions */}
          {selectedDocument && !previewLoading && (
            <SafeAreaView edges={['bottom']} style={styles.previewBottomSafe}>
              <View style={styles.previewActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnPrimary]}
                  onPress={() => handleDownloadDocument(selectedDocument)}
                >
                  <Ionicons name="download-outline" size={22} color="#FFF" />
                  <Text style={styles.actionBtnText}>Descargar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionBtn, selectedDocument.reviewed ? styles.actionBtnWarning : styles.actionBtnSuccess]}
                  onPress={() => handleMarkReviewed(selectedDocument.id, !selectedDocument.reviewed)}
                >
                  <Ionicons
                    name={selectedDocument.reviewed ? 'time-outline' : 'checkmark-circle-outline'}
                    size={22}
                    color="#FFF"
                  />
                  <Text style={styles.actionBtnText}>
                    {selectedDocument.reviewed ? 'Pendiente' : 'Revisado'}
                  </Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
  },
  // Header
  header: {
    paddingBottom: 16,
  },
  headerSafe: {
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  // Stats Row
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textGray,
    marginTop: 2,
  },
  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    margin: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    marginLeft: 10,
  },
  // Loading & Empty
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textGray,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textGray,
    textAlign: 'center',
  },
  // Folder List
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  folderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  folderIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderInitials: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  folderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  folderName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  folderEmail: {
    fontSize: 13,
    color: colors.textGray,
    marginTop: 2,
  },
  folderMeta: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  docCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  docCountText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  pendingBadge: {
    backgroundColor: colors.warning + '20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  pendingText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.warning,
  },
  // Client Info Card
  clientInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 14,
  },
  clientAvatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientInitials: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  clientDetails: {
    flex: 1,
    marginLeft: 14,
  },
  clientName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  clientEmail: {
    fontSize: 13,
    color: colors.textGray,
    marginTop: 2,
  },
  clientStats: {
    alignItems: 'center',
    backgroundColor: colors.warning + '15',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  clientStatNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.warning,
  },
  clientStatLabel: {
    fontSize: 11,
    color: colors.warning,
  },
  // Document Cards
  documentRow: {
    justifyContent: 'space-between',
  },
  documentCard: {
    width: '48%',
    backgroundColor: colors.background,
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    alignItems: 'center',
  },
  docIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  docInfo: {
    alignItems: 'center',
  },
  docName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  docDate: {
    fontSize: 11,
    color: colors.textGray,
    marginTop: 4,
  },
  newDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.warning,
  },
  // Preview Modal with Red Header
  previewModalContainer: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
  },
  previewHeaderGradient: {
    paddingBottom: 16,
  },
  previewHeaderSafeArea: {
    width: '100%',
  },
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  previewCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewDownloadBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewHeaderCenter: {
    flex: 1,
    alignItems: 'center',
  },
  previewTitleWhite: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  previewBadgeWhite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  previewBadgeTextWhite: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  previewContent: {
    flex: 1,
  },
  previewScroll: {
    flex: 1,
  },
  previewScrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  previewInfoCard: {
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  previewDocName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 22,
  },
  previewDocMeta: {
    fontSize: 13,
    color: colors.textGray,
    marginTop: 6,
  },
  imageContainer: {
    backgroundColor: colors.background,
    borderRadius: 14,
    overflow: 'hidden',
    minHeight: 300,
  },
  previewImage: {
    width: '100%',
    height: 400,
  },
  pdfPreview: {
    backgroundColor: colors.backgroundGray,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 70,
  },
  pdfIconWrapper: {
    width: 100,
    height: 100,
    borderRadius: 24,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  pdfText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  pdfSubtext: {
    fontSize: 13,
    color: colors.textGray,
    marginTop: 4,
  },
  // Fixed Bottom Actions
  previewBottomSafe: {
    backgroundColor: colors.background,
  },
  previewActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  actionBtnPrimary: {
    backgroundColor: colors.primary,
  },
  actionBtnSuccess: {
    backgroundColor: colors.success,
  },
  actionBtnWarning: {
    backgroundColor: colors.warning,
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
});
