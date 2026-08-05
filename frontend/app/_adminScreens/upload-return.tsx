/**
 * Upload Tax Return - Modern Design
 * Clean, intuitive interface for uploading client tax returns
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import api from '../../services/api';
import * as DocumentPicker from 'expo-document-picker';

interface Client {
  id: string;
  name: string;
  email: string;
}

export default function UploadTaxReturn() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [taxYear, setTaxYear] = useState(new Date().getFullYear().toString());
  const [federalFile, setFederalFile] = useState<any>(null);
  const [stateFile, setStateFile] = useState<any>(null);
  const [totalIncome, setTotalIncome] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [taxOwed, setTaxOwed] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingClients, setLoadingClients] = useState(true);
  const [uploadingFile, setUploadingFile] = useState<'federal' | 'state' | null>(null);
  
  // Modal states
  const [showClientModal, setShowClientModal] = useState(false);
  const [showYearModal, setShowYearModal] = useState(false);
  const [clientSearch, setClientSearch] = useState('');

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => (currentYear - 5 + i).toString()).reverse();

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const response = await api.get('/admin/clients?limit=1000');
      const clientsData = Array.isArray(response.data) 
        ? response.data 
        : (response.data?.clients || []);
      setClients(clientsData);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoadingClients(false);
    }
  };

  const filteredClients = clients.filter(client => 
    client.name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
    client.email?.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const pickFile = async (type: 'federal' | 'state') => {
    try {
      setUploadingFile(type);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0];
        
        const response = await fetch(file.uri);
        const blob = await response.blob();
        const reader = new FileReader();
        
        reader.onloadend = () => {
          const base64 = reader.result?.toString().split(',')[1];
          
          if (type === 'federal') {
            setFederalFile({ name: file.name, data: base64, size: file.size });
          } else {
            setStateFile({ name: file.name, data: base64, size: file.size });
          }
          setUploadingFile(null);
        };
        
        reader.readAsDataURL(blob);
      } else {
        setUploadingFile(null);
      }
    } catch (error) {
      console.error('Error picking file:', error);
      setUploadingFile(null);
      Alert.alert('Error', 'No se pudo seleccionar el archivo');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleUpload = async () => {
    if (!selectedClient) {
      Alert.alert('Cliente requerido', 'Por favor selecciona un cliente');
      return;
    }

    if (!federalFile && !stateFile) {
      Alert.alert('Archivo requerido', 'Debes subir al menos una declaración');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        user_id: selectedClient.id,
        tax_year: parseInt(taxYear),
        federal_return_pdf: federalFile?.data || null,
        state_return_pdf: stateFile?.data || null,
        total_income: totalIncome ? parseFloat(totalIncome) : null,
        refund_amount: refundAmount ? parseFloat(refundAmount) : null,
        tax_owed: taxOwed ? parseFloat(taxOwed) : null,
        status: 'completed',
      };

      await api.post('/admin/tax-returns/upload', payload);
      
      Alert.alert('✅ Declaración Subida', `La declaración de ${selectedClient.name} para ${taxYear} ha sido guardada correctamente.`, [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      console.error('Error uploading tax return:', error);
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo subir la declaración');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = selectedClient && (federalFile || stateFile);

  if (loadingClients) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Cargando clientes...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <LinearGradient
        colors={['#1E3A5F', '#2D5A87']}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Nueva Declaración</Text>
            <Text style={styles.headerSubtitle}>Sube documentos de impuestos</Text>
          </View>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Step 1: Client & Year */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>1</Text>
              </View>
              <Text style={styles.cardTitle}>Información Básica</Text>
            </View>

            {/* Client Selector */}
            <TouchableOpacity 
              style={styles.selectorButton}
              onPress={() => setShowClientModal(true)}
            >
              <View style={[styles.selectorIcon, selectedClient && styles.selectorIconActive]}>
                <Ionicons name="person" size={20} color={selectedClient ? '#FFF' : '#6B7280'} />
              </View>
              <View style={styles.selectorContent}>
                <Text style={styles.selectorLabel}>Cliente</Text>
                <Text style={[styles.selectorValue, !selectedClient && styles.selectorPlaceholder]}>
                  {selectedClient ? selectedClient.name : 'Seleccionar cliente'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </TouchableOpacity>

            {/* Year Selector */}
            <TouchableOpacity 
              style={styles.selectorButton}
              onPress={() => setShowYearModal(true)}
            >
              <View style={[styles.selectorIcon, styles.selectorIconActive, { backgroundColor: '#8B5CF6' }]}>
                <Ionicons name="calendar" size={20} color="#FFF" />
              </View>
              <View style={styles.selectorContent}>
                <Text style={styles.selectorLabel}>Año Fiscal</Text>
                <Text style={styles.selectorValue}>{taxYear}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </TouchableOpacity>
          </View>

          {/* Step 2: Files */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.stepBadge, { backgroundColor: '#10B981' }]}>
                <Text style={styles.stepBadgeText}>2</Text>
              </View>
              <Text style={styles.cardTitle}>Documentos PDF</Text>
            </View>

            {/* Federal Upload */}
            <TouchableOpacity 
              style={[styles.uploadArea, federalFile && styles.uploadAreaSuccess]}
              onPress={() => pickFile('federal')}
              disabled={uploadingFile === 'federal'}
            >
              {uploadingFile === 'federal' ? (
                <ActivityIndicator color="#3B82F6" />
              ) : federalFile ? (
                <>
                  <View style={styles.uploadSuccessIcon}>
                    <Ionicons name="checkmark" size={24} color="#FFF" />
                  </View>
                  <View style={styles.uploadInfo}>
                    <Text style={styles.uploadFileName} numberOfLines={1}>{federalFile.name}</Text>
                    <Text style={styles.uploadFileSize}>{formatFileSize(federalFile.size || 0)}</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.removeFileBtn}
                    onPress={(e) => { e.stopPropagation(); setFederalFile(null); }}
                  >
                    <Ionicons name="close" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.uploadIconContainer}>
                    <Ionicons name="document-text-outline" size={28} color="#3B82F6" />
                  </View>
                  <View style={styles.uploadTextContainer}>
                    <Text style={styles.uploadTitle}>Declaración Federal</Text>
                    <Text style={styles.uploadHint}>Toca para seleccionar PDF</Text>
                  </View>
                  <View style={styles.uploadBadge}>
                    <Text style={styles.uploadBadgeText}>Requerido</Text>
                  </View>
                </>
              )}
            </TouchableOpacity>

            {/* State Upload */}
            <TouchableOpacity 
              style={[styles.uploadArea, stateFile && styles.uploadAreaSuccess]}
              onPress={() => pickFile('state')}
              disabled={uploadingFile === 'state'}
            >
              {uploadingFile === 'state' ? (
                <ActivityIndicator color="#3B82F6" />
              ) : stateFile ? (
                <>
                  <View style={styles.uploadSuccessIcon}>
                    <Ionicons name="checkmark" size={24} color="#FFF" />
                  </View>
                  <View style={styles.uploadInfo}>
                    <Text style={styles.uploadFileName} numberOfLines={1}>{stateFile.name}</Text>
                    <Text style={styles.uploadFileSize}>{formatFileSize(stateFile.size || 0)}</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.removeFileBtn}
                    onPress={(e) => { e.stopPropagation(); setStateFile(null); }}
                  >
                    <Ionicons name="close" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={[styles.uploadIconContainer, { backgroundColor: '#F3E8FF' }]}>
                    <Ionicons name="document-outline" size={28} color="#8B5CF6" />
                  </View>
                  <View style={styles.uploadTextContainer}>
                    <Text style={styles.uploadTitle}>Declaración Estatal</Text>
                    <Text style={styles.uploadHint}>Toca para seleccionar PDF</Text>
                  </View>
                  <View style={[styles.uploadBadge, { backgroundColor: '#F1F5F9' }]}>
                    <Text style={[styles.uploadBadgeText, { color: '#64748B' }]}>Opcional</Text>
                  </View>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Step 3: Financial Info (Collapsible) */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.stepBadge, { backgroundColor: '#F59E0B' }]}>
                <Text style={styles.stepBadgeText}>3</Text>
              </View>
              <View style={styles.cardTitleContainer}>
                <Text style={styles.cardTitle}>Información Financiera</Text>
                <Text style={styles.cardSubtitle}>Opcional</Text>
              </View>
            </View>

            <View style={styles.financialGrid}>
              <View style={styles.financialItem}>
                <Text style={styles.financialLabel}>
                  <Ionicons name="trending-up" size={14} color="#10B981" /> Ingreso Total
                </Text>
                <View style={styles.currencyInput}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.financialInput}
                    placeholder="0.00"
                    value={totalIncome}
                    onChangeText={setTotalIncome}
                    keyboardType="decimal-pad"
                    placeholderTextColor="#CBD5E1"
                  />
                </View>
              </View>

              <View style={styles.financialItem}>
                <Text style={styles.financialLabel}>
                  <Ionicons name="arrow-down-circle" size={14} color="#3B82F6" /> Reembolso
                </Text>
                <View style={styles.currencyInput}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.financialInput}
                    placeholder="0.00"
                    value={refundAmount}
                    onChangeText={setRefundAmount}
                    keyboardType="decimal-pad"
                    placeholderTextColor="#CBD5E1"
                  />
                </View>
              </View>

              <View style={styles.financialItem}>
                <Text style={styles.financialLabel}>
                  <Ionicons name="arrow-up-circle" size={14} color="#EF4444" /> Impuesto Adeudado
                </Text>
                <View style={styles.currencyInput}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.financialInput}
                    placeholder="0.00"
                    value={taxOwed}
                    onChangeText={setTaxOwed}
                    keyboardType="decimal-pad"
                    placeholderTextColor="#CBD5E1"
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, !isFormValid && styles.submitButtonDisabled]}
            onPress={handleUpload}
            disabled={loading || !isFormValid}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <LinearGradient
                colors={isFormValid ? ['#10B981', '#059669'] : ['#CBD5E1', '#94A3B8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitGradient}
              >
                <Ionicons name="cloud-upload" size={22} color="#FFF" />
                <Text style={styles.submitButtonText}>Subir Declaración</Text>
              </LinearGradient>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Client Selection Modal */}
      <Modal
        visible={showClientModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowClientModal(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Seleccionar Cliente</Text>
            <TouchableOpacity 
              style={styles.modalCloseBtn}
              onPress={() => setShowClientModal(false)}
            >
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por nombre o email..."
              value={clientSearch}
              onChangeText={setClientSearch}
              placeholderTextColor="#9CA3AF"
              autoFocus
            />
            {clientSearch.length > 0 && (
              <TouchableOpacity onPress={() => setClientSearch('')}>
                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
          
          <FlatList
            data={filteredClients}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.clientList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.clientItem,
                  selectedClient?.id === item.id && styles.clientItemSelected
                ]}
                onPress={() => {
                  setSelectedClient(item);
                  setShowClientModal(false);
                  setClientSearch('');
                }}
              >
                <View style={[styles.clientAvatar, selectedClient?.id === item.id && styles.clientAvatarSelected]}>
                  <Text style={styles.clientAvatarText}>
                    {item.name?.charAt(0).toUpperCase() || '?'}
                  </Text>
                </View>
                <View style={styles.clientDetails}>
                  <Text style={styles.clientName}>{item.name}</Text>
                  <Text style={styles.clientEmail}>{item.email}</Text>
                </View>
                {selectedClient?.id === item.id && (
                  <View style={styles.checkIcon}>
                    <Ionicons name="checkmark" size={18} color="#FFF" />
                  </View>
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color="#CBD5E1" />
                <Text style={styles.emptyText}>No se encontraron clientes</Text>
              </View>
            }
          />
        </View>
      </Modal>

      {/* Year Selection Modal */}
      <Modal
        visible={showYearModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowYearModal(false)}
      >
        <TouchableOpacity 
          style={styles.yearModalOverlay}
          activeOpacity={1}
          onPress={() => setShowYearModal(false)}
        >
          <View style={styles.yearModalContent}>
            <View style={styles.yearModalHandle} />
            <Text style={styles.yearModalTitle}>Seleccionar Año Fiscal</Text>
            <ScrollView style={styles.yearList} showsVerticalScrollIndicator={false}>
              {years.map((year) => (
                <TouchableOpacity
                  key={year}
                  style={[styles.yearItem, taxYear === year && styles.yearItemSelected]}
                  onPress={() => {
                    setTaxYear(year);
                    setShowYearModal(false);
                  }}
                >
                  <Text style={[styles.yearText, taxYear === year && styles.yearTextSelected]}>
                    {year}
                  </Text>
                  {taxYear === year && (
                    <Ionicons name="checkmark-circle" size={22} color="#3B82F6" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 15, color: '#64748B' },

  // Header
  header: { paddingBottom: 20, paddingHorizontal: 16 },
  headerContent: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTextContainer: { marginLeft: 12 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#FFF' },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  // Content
  content: { flex: 1 },
  contentContainer: { padding: 16 },

  // Cards
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  stepBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center' },
  stepBadgeText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginLeft: 10 },
  cardTitleContainer: { marginLeft: 10 },
  cardSubtitle: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },

  // Selectors
  selectorButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, marginBottom: 10 },
  selectorIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },
  selectorIconActive: { backgroundColor: '#3B82F6' },
  selectorContent: { flex: 1, marginLeft: 12 },
  selectorLabel: { fontSize: 12, color: '#6B7280' },
  selectorValue: { fontSize: 15, fontWeight: '600', color: '#1F2937', marginTop: 2 },
  selectorPlaceholder: { color: '#9CA3AF', fontWeight: '400' },

  // Upload Areas
  uploadArea: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 2, borderColor: '#E5E7EB', borderStyle: 'dashed' },
  uploadAreaSuccess: { borderColor: '#10B981', borderStyle: 'solid', backgroundColor: '#F0FDF4' },
  uploadIconContainer: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center' },
  uploadTextContainer: { flex: 1, marginLeft: 12 },
  uploadTitle: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  uploadHint: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  uploadBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  uploadBadgeText: { fontSize: 10, fontWeight: '600', color: '#EF4444' },
  uploadSuccessIcon: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center' },
  uploadInfo: { flex: 1, marginLeft: 12 },
  uploadFileName: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  uploadFileSize: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  removeFileBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center' },

  // Financial
  financialGrid: { gap: 12 },
  financialItem: {},
  financialLabel: { fontSize: 13, fontWeight: '500', color: '#6B7280', marginBottom: 6 },
  currencyInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  currencySymbol: { fontSize: 16, fontWeight: '600', color: '#9CA3AF', paddingLeft: 14 },
  financialInput: { flex: 1, fontSize: 16, color: '#1F2937', paddingVertical: 12, paddingHorizontal: 8 },

  // Submit
  submitButton: { borderRadius: 14, overflow: 'hidden', marginTop: 8 },
  submitButtonDisabled: { opacity: 0.7 },
  submitGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 10 },
  submitButtonText: { fontSize: 17, fontWeight: '700', color: '#FFF' },

  // Client Modal
  modalContainer: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', margin: 16, borderRadius: 12, paddingHorizontal: 14, gap: 10 },
  searchInput: { flex: 1, fontSize: 15, color: '#1F2937', paddingVertical: 14 },
  clientList: { paddingHorizontal: 16 },
  clientItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  clientItemSelected: { backgroundColor: '#EFF6FF', marginHorizontal: -16, paddingHorizontal: 16, borderRadius: 12, borderBottomWidth: 0 },
  clientAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center' },
  clientAvatarSelected: { backgroundColor: '#3B82F6' },
  clientAvatarText: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  clientDetails: { flex: 1, marginLeft: 12 },
  clientName: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  clientEmail: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  checkIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 15, color: '#9CA3AF', marginTop: 12 },

  // Year Modal
  yearModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  yearModalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40, maxHeight: '60%' },
  yearModalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginTop: 12 },
  yearModalTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', textAlign: 'center', marginVertical: 16 },
  yearList: { paddingHorizontal: 16 },
  yearItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 16, marginBottom: 4, borderRadius: 12 },
  yearItemSelected: { backgroundColor: '#EFF6FF' },
  yearText: { fontSize: 17, color: '#374151' },
  yearTextSelected: { fontWeight: '700', color: '#3B82F6' },
});
