import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { format } from 'date-fns';
import CustomHeader from '../../components/CustomHeader';
import { useTranslation } from 'react-i18next';

export default function Documents() {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();

  // Tax year management - dynamic based on existing documents
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-12
  const defaultTaxYear = currentMonth <= 4 ? currentYear - 1 : currentYear;
  const [selectedYear, setSelectedYear] = useState(defaultTaxYear);
  const [availableYears, setAvailableYears] = useState<number[]>([defaultTaxYear, defaultTaxYear - 1, defaultTaxYear - 2]);

  const REQUIRED_DOCUMENTS = [
    { id: 'w2_1099', name: t('documents.proofOfIncome'), description: t('documents.proofOfIncomeDesc'), category: 'w2', icon: 'document-text' },
    { id: 'social_security', name: t('documents.socialSecurityCard'), description: t('documents.socialSecurityCardDesc'), category: 'ssn_card', icon: 'card' },
    { id: 'id', name: t('documents.identificationDocument'), description: t('documents.identificationDocumentDesc'), category: 'id_document', icon: 'person' },
    { id: 'health_insurance', name: t('documents.healthInsurance'), description: t('documents.healthInsuranceDesc'), category: 'medical', icon: 'medical' },
    { id: 'receipts', name: t('documents.expenseReceipts', '🧾 Recibos de Gastos'), description: t('documents.expenseReceiptsDesc', 'Sube tus recibos para clasificación automática por AI'), category: 'receipts', icon: 'receipt' },
    { id: 'other_docs', name: t('documents.otherDocuments'), description: t('documents.otherDocumentsDesc'), category: 'other', icon: 'folder' },
  ];
  const [documents, setDocuments] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showChecklist, setShowChecklist] = useState(true);

  useEffect(() => {
    loadDocuments();
  }, [selectedYear]);

  // Load available years dynamically
  useEffect(() => {
    loadAvailableYears();
  }, []);

  const loadAvailableYears = async () => {
    try {
      const response = await api.get('/documents/years');
      if (response.data?.years?.length > 0) {
        setAvailableYears(response.data.years);
        if (response.data.default_year) {
          setSelectedYear(response.data.default_year);
        }
      }
    } catch (error) {
    }
  };

  const getUploadedCategories = () => {
    return documents.map(doc => doc.category);
  };

  const isDocumentUploaded = (category: string) => {
    const uploadedCats = getUploadedCategories();
    return uploadedCats.includes(category);
  };

  // Count how many documents of each category
  const getDocumentCountByCategory = (category: string) => {
    return documents.filter(doc => doc.category === category).length;
  };

  const getCompletionPercentage = () => {
    // Count unique categories that have been uploaded
    const uploadedCats = new Set(getUploadedCategories());
    const requiredCats = REQUIRED_DOCUMENTS.map(doc => doc.category);
    const completedCount = requiredCats.filter(cat => uploadedCats.has(cat)).length;
    return Math.round((completedCount / REQUIRED_DOCUMENTS.length) * 100);
  };

  // Also show total uploaded count
  const getTotalUploaded = () => documents.length;

  const loadDocuments = async () => {
    try {
      const response = await api.get(`/documents?tax_year=${selectedYear}`, { timeout: 10000 });
      if (Array.isArray(response.data)) {
        setDocuments(response.data);
      } else {
        setDocuments([]);
      }
    } catch (error: any) {
      // Also try without year filter as fallback for older documents
      try {
        const fallbackResponse = await api.get('/documents', { timeout: 10000 });
        if (Array.isArray(fallbackResponse.data)) {
          // Filter client-side for documents without tax_year (legacy)
          const filtered = fallbackResponse.data.filter((d: any) => 
            !d.tax_year || d.tax_year === selectedYear
          );
          setDocuments(filtered);
        } else {
          setDocuments([]);
        }
      } catch {
        setDocuments([]);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDocuments();
  };

  const pickDocument = async (category: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadDocument(result.assets[0], category);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert(t('common.error', 'Error'), t('documents.couldNotSelectDocument', 'No se pudo seleccionar el documento'));
    }
  };

  const showUploadOptions = (category?: string) => {
    // Capture category in a local variable that won't change
    const categoryForUpload = category || 'other';
    
    try {
      Alert.alert(
        t('documents.uploadDocument', 'Subir Documento'),
        category ? `${t('documents.upload', 'Subir')}: ${REQUIRED_DOCUMENTS.find(d => d.category === category)?.name || category}` : t('documents.howToUpload', '¿Cómo deseas subir el documento?'),
        [
          {
            text: t('documents.takePhoto', '📷 Tomar Foto'),
            onPress: () => {
              takePhoto(categoryForUpload);
            },
          },
          {
            text: t('documents.fromGallery', '🖼️ Desde Galería'),
            onPress: () => {
              pickFromGallery(categoryForUpload);
            },
          },
          {
            text: t('documents.fromFiles', '📄 Desde Archivos'),
            onPress: () => {
              pickDocument(categoryForUpload);
            },
          },
          {
            text: t('common.cancel', 'Cancelar'),
            style: 'cancel',
          },
        ],
        { cancelable: true }
      );
    } catch (error) {
      console.error('❌ Error en showUploadOptions:', error);
      Alert.alert(t('common.error', 'Error'), t('documents.optionsError', 'Hubo un problema al mostrar las opciones'));
    }
  };

  const pickFromGallery = async (category: string) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (!permission.granted) {
      Alert.alert('Permiso requerido', 'Se necesita acceso a la galería');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        base64: true,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets[0]) {
        const imageData = `data:image/jpeg;base64,${result.assets[0].base64}`;
        await uploadDocument({
          uri: imageData,
          name: `photo_${Date.now()}.jpg`,
          type: 'image/jpeg',
        }, category);
      }
    } catch (error) {
      console.error('Error picking from gallery:', error);
      Alert.alert(t('common.error', 'Error'), t('documents.couldNotSelectImage', 'No se pudo seleccionar la imagen'));
    }
  };

  const takePhoto = async (category: string) => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    
    if (!permission.granted) {
      Alert.alert('Permiso requerido', 'Se necesita acceso a la cámara');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadDocument(result.assets[0], category);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert(t('common.error', 'Error'), t('documents.couldNotTakePhoto', 'No se pudo tomar la foto'));
    }
  };

  const uploadDocument = async (asset: any, category: string) => {
    setUploading(true);
    
    // Use the category passed as parameter (guaranteed to be correct)
    const categoryToUpload = category;
    
    try {
      // Get base64 data
      let base64: string;
      if (asset.base64) {
        base64 = asset.base64;
      } else {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result?.toString().split(',')[1] || '');
          reader.readAsDataURL(blob);
        });
      }

      const documentName = asset.name || `document_${Date.now()}.jpg`;
      
      // Check if base64 is valid
      if (!base64 || base64.length < 100) {
        throw new Error('No se pudo procesar la imagen');
      }
      
      
      // Upload document with the selected category and tax year
      const document = {
        name: documentName,
        file_data: base64,
        file_type: asset.mimeType || 'image/jpeg',
        size: asset.size || 0,
        category: categoryToUpload,
        tax_year: selectedYear,
      };

      const uploadResponse = await api.post('/documents', document, { timeout: 60000 });
      
      
      // Verify the upload was successful
      if (!uploadResponse.data || !uploadResponse.data.document_id) {
        throw new Error('Error al guardar el documento');
      }
      
      // 🤖 AI CLASSIFICATION: If it's a receipt, classify it automatically
      const receiptCategories = ['receipts', 'receipt', 'recibo', 'other'];
      if (receiptCategories.includes(categoryToUpload.toLowerCase())) {
        try {
          const classifyResponse = await api.post('/receipts/classify', {
            image_base64: base64,
            filename: documentName
          }, { timeout: 30000 });
          
          if (classifyResponse.data?.success) {
            const classification = classifyResponse.data.data;
            
            // Show classification result to user
            const categoryName = classification.category_name_es || classification.category;
            const amount = classification.amount ? `$${classification.amount}` : 'N/A';
            const vendor = classification.vendor || 'N/A';
            
            Alert.alert(
              '🤖 Recibo Clasificado',
              `Categoría: ${categoryName}\nMonto: ${amount}\nVendedor: ${vendor}`,
              [{ text: 'OK' }]
            );
          } else {
          }
        } catch (classifyError) {
          // Don't block the upload if classification fails
        }
      }
      
      // Use server response data (more reliable) or fallback to local values
      const responseData = uploadResponse.data;
      const newDoc = {
        id: responseData.document_id,
        name: responseData.name || documentName,
        category: responseData.category || categoryToUpload,
        uploaded_at: responseData.uploaded_at || new Date().toISOString()
      };
      
      
      // Update local state FIRST to show immediate feedback
      setDocuments(prevDocs => {
        const updated = [newDoc, ...prevDocs];
        return updated;
      });
      
      Alert.alert('✅ Documento Subido', 'Tu documento se ha guardado correctamente.');
      
      // Reload from server after a delay to sync with backend
      setTimeout(async () => {
        await loadDocuments();
      }, 1500);
      
    } catch (error: any) {
      let errorMessage = t('documents.uploadFailed', 'No se pudo subir el documento');
      
      if (error.response?.status === 401) {
        errorMessage = t('documents.sessionExpired', 'Sesión expirada. Por favor, inicia sesión nuevamente.');
      } else if (error.response?.status === 413) {
        errorMessage = t('documents.fileTooLarge', 'El archivo es demasiado grande.');
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert(t('common.error', 'Error'), errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const deleteDocument = async (documentId: string) => {
    Alert.alert(
      t('common.confirm', 'Confirmar'),
      t('documents.confirmDelete', '¿Está seguro de eliminar este documento?'),
      [
        { text: t('common.cancel', 'Cancelar'), style: 'cancel' },
        {
          text: t('common.delete', 'Eliminar'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/documents/${documentId}`);
              Alert.alert(t('common.success', 'Éxito'), t('documents.documentDeleted', t('documents.deleteSuccess', 'Documento eliminado')));
              loadDocuments();
            } catch (error) {
              Alert.alert(t('common.error', 'Error'), t('documents.deleteFailed', 'No se pudo eliminar el documento'));
            }
          },
        },
      ]
    );
  };

  const renderDocument = ({ item }: { item: any }) => {
    const categoryInfo: { [key: string]: { label: string; color: string; icon: string } } = {
      'w2': { label: 'W-2', color: colors.primary, icon: 'document-text' },
      '1099': { label: '1099', color: colors.secondary, icon: 'receipt' },
      '1098': { label: '1098', color: colors.accent, icon: 'home' },
      'receipts': { label: 'Recibos', color: colors.warning, icon: 'receipt-outline' },
      'bank_statements': { label: 'Banco', color: colors.info, icon: 'card' },
      'investment': { label: 'Inversión', color: colors.success, icon: 'trending-up' },
      'medical': { label: 'Médico', color: '#E91E63', icon: 'medical' },
      'education': { label: 'Educación', color: '#9C27B0', icon: 'school' },
      'business': { label: 'Negocio', color: '#FF9800', icon: 'briefcase' },
      'id_document': { label: 'ID', color: '#2196F3', icon: 'id-card' },
      'ssn_card': { label: 'SSN', color: '#00BCD4', icon: 'card-outline' },
      'other': { label: 'Otros', color: colors.textGray, icon: 'document' },
    };

    const category = item.category || 'other';
    const catInfo = categoryInfo[category] || categoryInfo['other'];

    return (
      <View style={styles.documentCard}>
        <View style={[styles.documentIcon, { backgroundColor: catInfo.color + '15' }]}>
          <Ionicons
            name={catInfo.icon as any}
            size={28}
            color={catInfo.color}
          />
        </View>
        <View style={styles.documentInfo}>
          <Text style={styles.documentName} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.documentMeta}>
            {format(new Date(item.uploaded_at), 'dd/MM/yyyy')}
          </Text>
          <View style={[styles.categoryBadge, { backgroundColor: catInfo.color + '20' }]}>
            <Ionicons name="sparkles" size={10} color={catInfo.color} />
            <Text style={[styles.categoryText, { color: catInfo.color }]}>
              {catInfo.label}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => deleteDocument(item.id)}
          style={styles.deleteButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Custom Header */}
      <CustomHeader 
        title={t('documents.title')}
        rightIcon="cloud-upload-outline"
        onRightIconPress={showUploadOptions}
      />
      
      <FlatList
        data={documents}
        renderItem={renderDocument}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <>
            {/* Year Selector Tabs */}
            <View style={styles.yearTabsContainer}>
              {availableYears.map((year) => (
                <TouchableOpacity
                  key={year}
                  style={[
                    styles.yearTab,
                    selectedYear === year && styles.yearTabActive,
                  ]}
                  onPress={() => {
                    setSelectedYear(year);
                    setDocuments([]);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="calendar"
                    size={14}
                    color={selectedYear === year ? '#FFF' : colors.textGray}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.yearTabText,
                      selectedYear === year && styles.yearTabTextActive,
                    ]}
                  >
                    {year}
                  </Text>
                  {selectedYear === year && year === defaultTaxYear && (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>Actual</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Progress Bar - Enhanced */}
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <View style={styles.progressTitleRow}>
                  <Text style={styles.progressTitle}>{t('documents.documentsProgress')}</Text>
                  {getCompletionPercentage() === 100 && (
                    <View style={styles.completeBadge}>
                      <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                      <Text style={styles.completeText}>¡Completo!</Text>
                    </View>
                  )}
                </View>
                <Text style={[
                  styles.progressPercentage,
                  getCompletionPercentage() === 100 && { color: '#10b981' }
                ]}>{getCompletionPercentage()}%</Text>
              </View>
              <View style={styles.progressBarContainer}>
                <View style={[
                  styles.progressBar, 
                  { 
                    width: `${getCompletionPercentage()}%`,
                    backgroundColor: getCompletionPercentage() === 100 ? '#10b981' : 
                                    getCompletionPercentage() >= 60 ? '#f59e0b' : colors.primary
                  }
                ]} />
              </View>
              <View style={styles.progressStats}>
                <View style={styles.progressStat}>
                  <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                  <Text style={styles.progressStatText}>
                    {REQUIRED_DOCUMENTS.filter(doc => isDocumentUploaded(doc.category)).length} de {REQUIRED_DOCUMENTS.length} categorías
                  </Text>
                </View>
                <View style={styles.progressStat}>
                  <Ionicons name="document" size={16} color={colors.primary} />
                  <Text style={styles.progressStatText}>
                    {documents.length} documento{documents.length !== 1 ? 's' : ''} total
                  </Text>
                </View>
              </View>
            </View>

            {/* Checklist */}
            {showChecklist && (
              <View style={styles.checklistCard}>
                <View style={styles.checklistHeader}>
                  <Text style={styles.checklistTitle}>📋 {t('documents.requiredDocuments')}</Text>
                  <TouchableOpacity onPress={() => setShowChecklist(false)}>
                    <Ionicons name="chevron-up" size={24} color={colors.textGray} />
                  </TouchableOpacity>
                </View>
                
                {/* Celebration message when 100% complete */}
                {getCompletionPercentage() === 100 && (
                  <View style={styles.celebrationBanner}>
                    <View style={styles.celebrationIcon}>
                      <Ionicons name="trophy" size={28} color="#FFF" />
                    </View>
                    <View style={styles.celebrationContent}>
                      <Text style={styles.celebrationTitle}>🎉 ¡Documentos Completos!</Text>
                      <Text style={styles.celebrationText}>
                        Gracias por subir todos tus documentos. Puedes agregar más si tienes varios W-2, 1099, etc.
                      </Text>
                    </View>
                  </View>
                )}
                
                {REQUIRED_DOCUMENTS.map((doc) => {
                  const uploaded = isDocumentUploaded(doc.category);
                  const count = getDocumentCountByCategory(doc.category);
                  return (
                    <View
                      key={doc.id}
                      style={styles.checklistItem}
                    >
                      <View style={[
                        styles.checkbox,
                        uploaded && styles.checkboxChecked
                      ]}>
                        {uploaded ? (
                          count > 1 ? (
                            <Text style={styles.checkboxCount}>{count}</Text>
                          ) : (
                            <Ionicons name="checkmark" size={20} color={colors.textWhite} />
                          )
                        ) : (
                          <Ionicons name={doc.icon as any} size={20} color={colors.textGray} />
                        )}
                      </View>
                      <View style={styles.checklistContent}>
                        <View style={styles.checklistNameRow}>
                          <Text style={[
                            styles.checklistName,
                            uploaded && styles.checklistNameCompleted
                          ]}>
                            {doc.name}
                          </Text>
                          {count > 0 && (
                            <View style={styles.countBadge}>
                              <Text style={styles.countBadgeText}>{count} {count === 1 ? 'archivo' : 'archivos'}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.checklistDescription}>{doc.description}</Text>
                      </View>
                      {/* Always show add button to allow multiple documents */}
                      <TouchableOpacity
                        onPress={() => showUploadOptions(doc.category)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        activeOpacity={0.6}
                      >
                        <Ionicons 
                          name={uploaded ? "add-circle-outline" : "add-circle"} 
                          size={28} 
                          color={uploaded ? colors.success : colors.primary} 
                        />
                      </TouchableOpacity>
                    </View>
                  );
                })}
                
                {/* Tip for multiple documents */}
                <View style={styles.tipContainer}>
                  <Ionicons name="information-circle-outline" size={18} color={colors.info} />
                  <Text style={styles.tipText}>
                    💡 Puedes subir varios documentos de cada categoría si tienes más de un W-2, 1099, etc.
                  </Text>
                </View>
              </View>
            )}

            {!showChecklist && (
              <TouchableOpacity 
                style={styles.showChecklistButton}
                onPress={() => setShowChecklist(true)}
              >
                <Ionicons name="list" size={20} color={colors.primary} />
                <Text style={styles.showChecklistText}>{t('documents.requiredDocuments')}</Text>
              </TouchableOpacity>
            )}

            {/* Section Header */}
            {documents.length > 0 && (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('documents.title')} ({documents.length})</Text>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          documents.length === 0 && !refreshing ? (
            <View style={styles.emptyState}>
              <Ionicons name="cloud-upload-outline" size={64} color={colors.textLight} />
              <Text style={styles.emptyTitle}>{t('documents.noDocuments')}</Text>
              <Text style={styles.emptySubtitle}>
                {t('documents.uploadFirst')}
              </Text>
            </View>
          ) : null
        }
      />

      {/* FAB - Solo mostrar si no hay checklist visible */}
      {!showChecklist && documents.length > 0 && (
        <TouchableOpacity
          style={[styles.fab, styles.fabPrimary]}
          onPress={showUploadOptions}
          activeOpacity={0.8}
          disabled={uploading}
        >
          <Ionicons name="add" size={28} color={colors.textWhite} />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
  },
  list: {
    padding: 20,
  },
  documentCard: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  documentIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  documentInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  documentName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  documentMeta: {
    fontSize: 13,
    color: colors.textGray,
    marginBottom: 4,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
    gap: 4,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  deleteButton: {
    justifyContent: 'center',
    paddingLeft: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textGray,
    textAlign: 'center',
  },
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    gap: 12,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabPrimary: {
    backgroundColor: colors.primary,
  },
  fabSecondary: {
    backgroundColor: colors.accent,
  },
  progressCard: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  completeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b98115',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  completeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
  },
  progressPercentage: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
  },
  progressBarContainer: {
    height: 10,
    backgroundColor: colors.border,
    borderRadius: 5,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 5,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 4,
  },
  progressStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressStatText: {
    fontSize: 13,
    color: colors.textGray,
    fontWeight: '500',
  },
  progressText: {
    fontSize: 12,
    color: colors.textGray,
  },
  checklistCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  checklistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  checklistTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  checkbox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.backgroundGray,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  checkboxChecked: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  checklistContent: {
    flex: 1,
  },
  checklistNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  checklistName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  checklistNameCompleted: {
    color: colors.success,
  },
  checklistDescription: {
    fontSize: 12,
    color: colors.textGray,
  },
  countBadge: {
    backgroundColor: colors.success + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.success,
  },
  checkboxCount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textWhite,
  },
  celebrationBanner: {
    flexDirection: 'row',
    backgroundColor: '#10b98115',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#10b98130',
  },
  celebrationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  celebrationContent: {
    flex: 1,
  },
  celebrationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10b981',
    marginBottom: 4,
  },
  celebrationText: {
    fontSize: 13,
    color: colors.textGray,
    lineHeight: 18,
  },
  tipContainer: {
    flexDirection: 'row',
    backgroundColor: colors.info + '10',
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.info + '20',
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    color: colors.textGray,
    lineHeight: 18,
  },
  showChecklistButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '15',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  showChecklistText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  // Year Tabs Styles
  yearTabsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    paddingBottom: 4,
  },
  yearTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border || '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  yearTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  yearTabText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textGray,
  },
  yearTabTextActive: {
    color: '#FFF',
  },
  currentBadge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  currentBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFF',
  },
});