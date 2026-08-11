import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Modal, Share, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getToken } from '../src/utils/api';
import { useColors, Spacing, FontSizes, BorderRadius } from '../src/constants/theme';
import { formatCurrency } from '../src/utils/formatters';
import SignaturePad from '../src/components/SignaturePad';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

// Consent form types
type ConsentType = 'background_check' | 'income_verification' | 'photo_video' | 'ach_authorization';

interface ConsentFormConfig {
  id: ConsentType;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  endpoint: string;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL || '';

// Configuration for consent form buttons
const CONSENT_FORMS: ConsentFormConfig[] = [
  {
    id: 'background_check',
    title: 'Background Check',
    subtitle: 'Autorización de verificación de antecedentes',
    icon: 'shield-checkmark-outline',
    color: '#8b5cf6',
    endpoint: '/api/consents/background-check',
  },
  {
    id: 'income_verification',
    title: 'Verificación de Ingresos',
    subtitle: 'Autorización para verificar empleo',
    icon: 'cash-outline',
    color: '#10b981',
    endpoint: '/api/consents/income-verification',
  },
  {
    id: 'photo_video',
    title: 'Consentimiento de Fotos',
    subtitle: 'Autorización de uso de imágenes',
    icon: 'camera-outline',
    color: '#f59e0b',
    endpoint: '/api/consents/photo-video',
  },
  {
    id: 'ach_authorization',
    title: 'Autorización ACH',
    subtitle: 'Débito automático de renta',
    icon: 'card-outline',
    color: '#3b82f6',
    endpoint: '/api/consents/ach-authorization',
  },
];

interface Contract {
  _id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_email: string;
  tenant_phone?: string;
  property_id: string;
  property_name: string;
  property_address: string;
  start_date: string;
  end_date: string;
  rent_amount: number;
  deposit: number;
  payment_due_day: number;
  late_fee: number;
  late_fee_amount?: number;
  status: string;
  terms?: string;
  admin_signature?: string;
  admin_signature_date?: string;
  tenant_signature?: string;
  tenant_signature_date?: string;
  pending_tenant_signature?: boolean;
  created_at: string;
}

export default function AdminContractDetailScreen() {
  const Colors = useColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const router = useRouter();
  const params = useLocalSearchParams();
  // Handle both string and array cases for id
  const contractId = Array.isArray(params.id) ? params.id[0] : params.id;
  // El AuthContext no expone el token: se lee del almacenamiento seguro
  const [token, setTokenState] = useState<string | null | undefined>(undefined);
  useEffect(() => { getToken().then(t => setTokenState(t)); }, []);
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [generatingConsent, setGeneratingConsent] = useState<ConsentType | null>(null);

  const fetchContract = useCallback(async () => {
    if (!contractId) {
      console.error('No contract ID provided');
      setErrorMsg('ID de contrato no proporcionado');
      setLoading(false);
      return;
    }

    if (token === undefined) {
      // token aún cargando desde almacenamiento
      return;
    }
    if (!token) {
      console.error('No auth token available');
      setErrorMsg('No hay token de autenticación');
      setLoading(false);
      return;
    }

    try {
      console.log(`Fetching contract: ${API_URL}/api/admin/rental-contracts/${contractId}`);
      const res = await fetch(`${API_URL}/api/admin/rental-contracts/${contractId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      console.log('Response status:', res.status);
      const data = await res.json();
      console.log('Response data:', JSON.stringify(data).substring(0, 200));
      
      if (res.ok && data.success) {
        setContract(data.contract || data);
      } else {
        setErrorMsg(data.detail || data.message || 'Error al cargar contrato');
      }
    } catch (e) {
      console.error('Error fetching contract:', e);
      setErrorMsg('Error de conexión al servidor');
    } finally {
      setLoading(false);
    }
  }, [contractId, token]);

  useEffect(() => {
    fetchContract();
  }, [fetchContract]);

  const handleAdminSign = async (signatureBase64: string) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/rental-contracts/${contractId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          admin_signature: signatureBase64,
          admin_signature_date: new Date().toISOString(),
        }),
      });

      if (res.ok) {
        Alert.alert('✅ Firmado', 'El contrato ha sido firmado como administrador');
        setShowSignatureModal(false);
        fetchContract();
      } else {
        Alert.alert('Error', 'No se pudo guardar la firma');
      }
    } catch (e) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const sendForTenantSignature = async () => {
    if (!contract?.admin_signature) {
      Alert.alert('Error', 'Primero debes firmar el contrato como administrador');
      return;
    }

    Alert.alert(
      '📱 Enviar para Firma',
      `El inquilino "${contract.tenant_name}" recibirá una notificación para firmar el contrato desde su app.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          onPress: async () => {
            setSaving(true);
            try {
              const res = await fetch(`${API_URL}/api/admin/rental-contracts/${contractId}/send-for-signature`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
              });

              if (res.ok) {
                Alert.alert('✅ Enviado', 'El inquilino recibirá una notificación');
                fetchContract();
              } else {
                const data = await res.json();
                Alert.alert('Error', data.detail || 'No se pudo enviar');
              }
            } catch (e) {
              Alert.alert('Error', 'Error de conexión');
            } finally {
              setSaving(false);
            }
          }
        }
      ]
    );
  };

  const generatePDF = async () => {
    if (!contract) return;
    setGeneratingPdf(true);

    try {
      // Fetch the professional PDF from backend (includes all addendums, signatures, and initials)
      console.log(`Fetching PDF from: ${API_URL}/api/admin/rental-contracts/${contractId}/pdf`);
      const res = await fetch(`${API_URL}/api/admin/rental-contracts/${contractId}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Error al generar PDF');
      }

      const data = await res.json();
      
      if (!data.pdf_base64) {
        throw new Error('No se recibió el PDF del servidor');
      }

      // Convert base64 to file URI
      const pdfBase64 = data.pdf_base64;
      const filename = data.filename || `Contrato_${contract.tenant_name.replace(/\s+/g, '_')}.pdf`;
      
      // Write the base64 PDF to cache directory
      const pdfUri = FileSystem.cacheDirectory + filename;
      await FileSystem.writeAsStringAsync(
        pdfUri,
        pdfBase64,
        { encoding: FileSystem.EncodingType.Base64 }
      );
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pdfUri, {
          mimeType: 'application/pdf',
          dialogTitle: `Contrato - ${contract.tenant_name}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Éxito', 'PDF generado correctamente');
      }
    } catch (e: any) {
      console.error('Error generating PDF:', e);
      Alert.alert('Error', e.message || 'No se pudo generar el PDF');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Generate separate consent form PDFs
  const generateConsentForm = async (formConfig: ConsentFormConfig) => {
    if (!contract) return;
    setGeneratingConsent(formConfig.id);

    try {
      // Build request body based on form type
      let requestBody: Record<string, any> = {};

      switch (formConfig.id) {
        case 'background_check':
          requestBody = {
            applicant_name: contract.tenant_name,
            applicant_email: contract.tenant_email,
            applicant_phone: contract.tenant_phone || '',
            applicant_ssn_last4: 'XXXX',
            applicant_dob: '',
            property_address: contract.property_address,
          };
          break;
        case 'income_verification':
          requestBody = {
            applicant_name: contract.tenant_name,
            employer_name: '',
            employer_phone: '',
            applicant_position: '',
          };
          break;
        case 'photo_video':
          requestBody = {
            tenant_name: contract.tenant_name,
            property_address: contract.property_address,
          };
          break;
        case 'ach_authorization':
          requestBody = {
            tenant_name: contract.tenant_name,
            bank_name: '',
            account_type: 'checking',
            routing_number: '',
            account_number_last4: 'XXXX',
            monthly_amount: contract.rent_amount || 0,
            property_address: contract.property_address,
          };
          break;
      }

      const res = await fetch(`${API_URL}${formConfig.endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Error al generar formulario');
      }

      const data = await res.json();

      if (!data.pdf_base64) {
        throw new Error('No se recibió el PDF del servidor');
      }

      // Save and share the PDF
      const pdfUri = FileSystem.cacheDirectory + data.filename;
      await FileSystem.writeAsStringAsync(
        pdfUri,
        data.pdf_base64,
        { encoding: FileSystem.EncodingType.Base64 }
      );

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pdfUri, {
          mimeType: 'application/pdf',
          dialogTitle: formConfig.title,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('✅ Éxito', `${formConfig.title} generado correctamente`);
      }
    } catch (e: any) {
      console.error('Error generating consent form:', e);
      Alert.alert('Error', e.message || 'No se pudo generar el formulario');
    } finally {
      setGeneratingConsent(null);
    }
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; color: string; bg: string }> = {
      active: { label: 'Activo', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
      pending: { label: 'Pendiente', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
      draft: { label: 'Borrador', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
      pending_signature: { label: 'Esperando Firma', color: '#ec4899', bg: 'rgba(236,72,153,0.1)' },
      signed: { label: 'Firmado', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
      expired: { label: 'Expirado', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    };
    return configs[status] || configs.pending;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.brandRed} />
      </View>
    );
  }

  if (!contract) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={60} color={Colors.brandRed} />
        <Text style={{ color: '#fff', marginTop: 16, fontSize: 16, textAlign: 'center', paddingHorizontal: 20 }}>
          {errorMsg || 'Contrato no encontrado'}
        </Text>
        <TouchableOpacity 
          style={{ marginTop: 24, padding: 12, backgroundColor: Colors.warmGold, borderRadius: 8 }}
          onPress={() => router.back()}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusConfig = getStatusConfig(contract.status);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['rgba(217,170,92,0.1)', 'transparent']}
        style={styles.bgGradient}
      />

      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Detalle de Contrato</Text>
            <Text style={styles.headerSubtitle}>{contract.property_name}</Text>
          </View>
          <TouchableOpacity onPress={generatePDF} style={styles.pdfBtn} disabled={generatingPdf}>
            {generatingPdf ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="document-text" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {/* Status Card */}
          <View style={[styles.statusCard, { borderColor: statusConfig.color }]}>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
              <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
            </View>
            <Text style={styles.contractId}>ID: {contract._id}</Text>
          </View>

          {/* Tenant Info */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="person-outline" size={20} color={Colors.warmGold} />
              <Text style={styles.cardTitle}>Inquilino</Text>
            </View>
            <Text style={styles.tenantName}>{contract.tenant_name}</Text>
            <Text style={styles.tenantDetail}>{contract.tenant_email}</Text>
            {contract.tenant_phone && <Text style={styles.tenantDetail}>{contract.tenant_phone}</Text>}
          </View>

          {/* Property Info */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="home-outline" size={20} color={Colors.warmGold} />
              <Text style={styles.cardTitle}>Propiedad</Text>
            </View>
            <Text style={styles.propertyAddress}>{contract.property_address}</Text>
          </View>

          {/* Financial Terms */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="cash-outline" size={20} color={Colors.warmGold} />
              <Text style={styles.cardTitle}>Términos Financieros</Text>
            </View>
            <View style={styles.financialGrid}>
              <View style={styles.financialItem}>
                <Text style={styles.financialLabel}>Renta Mensual</Text>
                <Text style={styles.financialValue}>{formatCurrency(contract.rent_amount || 0)}</Text>
              </View>
              <View style={styles.financialItem}>
                <Text style={styles.financialLabel}>Depósito</Text>
                <Text style={styles.financialValue}>{formatCurrency(contract.deposit || 0)}</Text>
              </View>
              <View style={styles.financialItem}>
                <Text style={styles.financialLabel}>Día de Pago</Text>
                <Text style={styles.financialValue}>Día {contract.payment_due_day || 1}</Text>
              </View>
              <View style={styles.financialItem}>
                <Text style={styles.financialLabel}>Cargo Mora</Text>
                <Text style={styles.financialValue}>{formatCurrency(contract.late_fee_amount ?? contract.late_fee ?? 0)}</Text>
              </View>
            </View>
          </View>

          {/* Contract Period */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="calendar-outline" size={20} color={Colors.warmGold} />
              <Text style={styles.cardTitle}>Período del Contrato</Text>
            </View>
            <View style={styles.periodRow}>
              <View style={styles.periodItem}>
                <Text style={styles.periodLabel}>Inicio</Text>
                <Text style={styles.periodValue}>{contract.start_date}</Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color="#666" />
              <View style={styles.periodItem}>
                <Text style={styles.periodLabel}>Fin</Text>
                <Text style={styles.periodValue}>{contract.end_date}</Text>
              </View>
            </View>
          </View>

          {/* Signatures Section */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="create-outline" size={20} color={Colors.warmGold} />
              <Text style={styles.cardTitle}>Firmas</Text>
            </View>
            
            <View style={styles.signaturesGrid}>
              {/* Admin Signature */}
              <View style={styles.signatureBox}>
                <Text style={styles.signatureLabel}>Administrador</Text>
                {contract.admin_signature ? (
                  <View style={styles.signedBox}>
                    <Ionicons name="checkmark-circle" size={24} color="#10b981" />
                    <Text style={styles.signedText}>Firmado</Text>
                    <Text style={styles.signedDate}>
                      {contract.admin_signature_date && new Date(contract.admin_signature_date).toLocaleDateString('es-MX')}
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.signBtn} onPress={() => setShowSignatureModal(true)}>
                    <Ionicons name="create" size={18} color="#fff" />
                    <Text style={styles.signBtnText}>Firmar</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Tenant Signature */}
              <View style={styles.signatureBox}>
                <Text style={styles.signatureLabel}>Inquilino</Text>
                {contract.tenant_signature ? (
                  <View style={styles.signedBox}>
                    <Ionicons name="checkmark-circle" size={24} color="#10b981" />
                    <Text style={styles.signedText}>Firmado</Text>
                    <Text style={styles.signedDate}>
                      {contract.tenant_signature_date && new Date(contract.tenant_signature_date).toLocaleDateString('es-MX')}
                    </Text>
                  </View>
                ) : contract.pending_tenant_signature ? (
                  <View style={styles.pendingBox}>
                    <Ionicons name="hourglass-outline" size={24} color="#ec4899" />
                    <Text style={styles.pendingText}>Esperando</Text>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={[styles.sendSignBtn, !contract.admin_signature && styles.disabledBtn]} 
                    onPress={sendForTenantSignature}
                    disabled={!contract.admin_signature}
                  >
                    <Ionicons name="send" size={16} color={contract.admin_signature ? '#ec4899' : '#666'} />
                    <Text style={[styles.sendSignBtnText, !contract.admin_signature && { color: '#666' }]}>
                      Enviar para Firma
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* Consent Forms Section */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="documents-outline" size={20} color={Colors.warmGold} />
              <Text style={styles.cardTitle}>Formularios de Consentimiento</Text>
            </View>
            <Text style={styles.consentSubtitle}>
              Genera documentos separados para firma del inquilino
            </Text>
            
            <View style={styles.consentGrid}>
              {CONSENT_FORMS.map((form) => (
                <TouchableOpacity
                  key={form.id}
                  style={[styles.consentFormBtn, { borderLeftColor: form.color }]}
                  onPress={() => generateConsentForm(form)}
                  disabled={generatingConsent !== null}
                >
                  <View style={[styles.consentIconBox, { backgroundColor: `${form.color}20` }]}>
                    {generatingConsent === form.id ? (
                      <ActivityIndicator size="small" color={form.color} />
                    ) : (
                      <Ionicons name={form.icon} size={22} color={form.color} />
                    )}
                  </View>
                  <View style={styles.consentTextBox}>
                    <Text style={styles.consentFormTitle}>{form.title}</Text>
                    <Text style={styles.consentFormSubtitle} numberOfLines={1}>{form.subtitle}</Text>
                  </View>
                  <Ionicons name="download-outline" size={18} color="#666" />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn} onPress={generatePDF}>
              <LinearGradient colors={['#3b82f6', '#2563eb']} style={styles.actionBtnGradient}>
                <Ionicons name="download-outline" size={20} color="#fff" />
                <Text style={styles.actionBtnText}>Descargar PDF</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>

      {/* Signature Modal */}
      <Modal visible={showSignatureModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.signatureModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Firma del Administrador</Text>
              <TouchableOpacity onPress={() => setShowSignatureModal(false)}>
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Firma en el recuadro para validar el contrato
            </Text>
            <SignaturePad 
              onSave={handleAdminSign} 
              onCancel={() => setShowSignatureModal(false)}
              signerName="Administrador"
              signerRole="admin"
            />
            {saving && (
              <View style={styles.savingOverlay}>
                <ActivityIndicator size="large" color={Colors.brandRed} />
                <Text style={styles.savingText}>Guardando firma...</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0e15' },
  bgGradient: { ...StyleSheet.absoluteFillObject },
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0e15' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.glassBorderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  headerSubtitle: { fontSize: 13, color: '#888', marginTop: 2 },
  pdfBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.warmGold,
    justifyContent: 'center',
    alignItems: 'center',
  },

  scrollView: { flex: 1 },
  content: { paddingHorizontal: 16 },

  statusCard: {
    backgroundColor: Colors.glass,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: { fontSize: 13, fontWeight: '600' },
  contractId: { fontSize: 11, color: '#666' },

  card: {
    backgroundColor: Colors.glass,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },

  tenantName: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  tenantDetail: { fontSize: 14, color: '#888' },

  propertyAddress: { fontSize: 16, color: '#ccc', lineHeight: 22 },

  financialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  financialItem: {
    width: '50%',
    paddingVertical: 8,
  },
  financialLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
  financialValue: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },

  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  periodItem: { alignItems: 'center' },
  periodLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
  periodValue: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },

  signaturesGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  signatureBox: {
    flex: 1,
    backgroundColor: Colors.glass,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  signatureLabel: { fontSize: 12, color: '#888', marginBottom: 10 },
  
  signedBox: { alignItems: 'center', gap: 4 },
  signedText: { fontSize: 13, fontWeight: '600', color: '#10b981' },
  signedDate: { fontSize: 11, color: '#666' },

  pendingBox: { alignItems: 'center', gap: 4 },
  pendingText: { fontSize: 13, fontWeight: '600', color: '#ec4899' },

  signBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.warmGold,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  signBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },

  sendSignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(236,72,153,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(236,72,153,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  sendSignBtnText: { fontSize: 12, fontWeight: '600', color: '#ec4899' },
  disabledBtn: {
    backgroundColor: Colors.glass,
    borderColor: Colors.glassBorderLight,
  },

  actions: {
    marginTop: 16,
    gap: 12,
  },
  actionBtn: { borderRadius: 14, overflow: 'hidden' },
  actionBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  actionBtnText: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  signatureModal: {
    backgroundColor: '#12161f',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  modalSubtitle: { fontSize: 14, color: '#888', marginBottom: 16 },

  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
  },
  savingText: { fontSize: 14, color: Colors.textPrimary, marginTop: 10 },

  // Consent Forms Styles
  consentSubtitle: {
    fontSize: 13,
    color: '#888',
    marginBottom: 12,
  },
  consentGrid: {
    gap: 10,
  },
  consentFormBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.glass,
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    gap: 12,
  },
  consentIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  consentTextBox: {
    flex: 1,
  },
  consentFormTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  consentFormSubtitle: {
    fontSize: 11,
    color: '#888',
  },
});
