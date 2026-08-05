/**
 * W-2 OCR Review Screen for Admin
 * Allows reviewing and correcting OCR-extracted W-2 data
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  StatusBar,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

interface W2Data {
  id?: string;
  session_id?: string;
  employer_name: string;
  employer_ein: string;
  employer_address: string;
  employee_name: string;
  employee_ssn: string;
  employee_address: string;
  box1_wages: number;
  box2_federal_withheld: number;
  box3_ss_wages: number;
  box4_ss_withheld: number;
  box5_medicare_wages: number;
  box6_medicare_withheld: number;
  box16_state_wages: number;
  box17_state_withheld: number;
  box15_state: string;
  tax_year: number;
  confidence_score: number;
  needs_review: boolean;
  review_notes: string;
  status: 'pending' | 'approved' | 'rejected';
  image_url?: string;
}

export default function W2ReviewScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { w2Id, sessionId } = useLocalSearchParams<{ w2Id: string; sessionId: string }>();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [w2Data, setW2Data] = useState<W2Data | null>(null);
  const [editedData, setEditedData] = useState<Partial<W2Data>>({});
  const [showImage, setShowImage] = useState(false);

  useEffect(() => {
    loadW2Data();
  }, []);

  const loadW2Data = async () => {
    try {
      // For demo, we'll load from the session's income data
      // In production, this would be a separate W2 documents collection
      const response = await api.get(`/tax-wizard/admin/session/${sessionId}/details`);
      
      if (response.data.success && response.data.session.income?.w2_sources?.length > 0) {
        const w2 = response.data.session.income.w2_sources[0];
        const mockW2Data: W2Data = {
          id: w2Id || '1',
          session_id: sessionId,
          employer_name: w2.employer_name || '',
          employer_ein: w2.ein || '',
          employer_address: '',
          employee_name: `${response.data.session.personal_info?.first_name || ''} ${response.data.session.personal_info?.last_name || ''}`,
          employee_ssn: `***-**-${response.data.session.personal_info?.ssn_last_four || '****'}`,
          employee_address: response.data.session.personal_info?.address || '',
          box1_wages: w2.amount || 0,
          box2_federal_withheld: w2.federal_withheld || 0,
          box3_ss_wages: w2.amount || 0,
          box4_ss_withheld: (w2.amount || 0) * 0.062,
          box5_medicare_wages: w2.amount || 0,
          box6_medicare_withheld: (w2.amount || 0) * 0.0145,
          box16_state_wages: w2.amount || 0,
          box17_state_withheld: w2.state_withheld || 0,
          box15_state: 'TX',
          tax_year: 2025,
          confidence_score: 85,
          needs_review: true,
          review_notes: 'Verificar montos de retención federal',
          status: 'pending',
        };
        setW2Data(mockW2Data);
        setEditedData(mockW2Data);
      }
    } catch (error) {
      console.error('Error loading W2:', error);
      Alert.alert('Error', 'No se pudo cargar el W-2');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (field: keyof W2Data, value: string) => {
    setEditedData(prev => ({
      ...prev,
      [field]: field.includes('box') || field === 'tax_year' || field === 'confidence_score'
        ? parseFloat(value) || 0
        : value
    }));
  };

  const handleApprove = async () => {
    setSaving(true);
    try {
      // Update the income data in the session
      await api.post(`/tax-wizard/session/${sessionId}/income`, {
        has_w2: true,
        w2_count: 1,
        w2_sources: [{
          type: 'w2',
          employer_name: editedData.employer_name,
          ein: editedData.employer_ein,
          amount: editedData.box1_wages,
          federal_withheld: editedData.box2_federal_withheld,
          state_withheld: editedData.box17_state_withheld,
        }],
        form_1099_sources: [],
        has_unemployment: false,
        unemployment_amount: 0,
        has_self_employment: false,
        self_employment_income: 0,
        self_employment_expenses: 0,
        has_other_income: false,
        other_income_amount: 0,
      });

      Alert.alert(
        'W-2 Aprobado',
        'Los datos del W-2 han sido verificados y guardados.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Error approving W2:', error);
      Alert.alert('Error', 'No se pudo aprobar el W-2');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = () => {
    Alert.alert(
      t('wizard.w2Review.rejectTitle'),
      '¿Estás seguro? El cliente deberá subir una nueva imagen.',
      [
        { text: t('common.cancel'), style: 'cancel' },
        { 
          text: t('wizard.w2Review.reject'), 
          style: 'destructive',
          onPress: () => {
            Alert.alert(t('wizard.w2Review.rejected'), t('wizard.w2Review.rejectedDesc'));
            router.back();
          }
        }
      ]
    );
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const renderField = (
    label: string, 
    field: keyof W2Data, 
    keyboardType: 'default' | 'numeric' = 'default',
    prefix?: string
  ) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputWrapper}>
        {prefix && <Text style={styles.inputPrefix}>{prefix}</Text>}
        <TextInput
          style={[styles.fieldInput, prefix && styles.fieldInputWithPrefix]}
          value={String(editedData[field] || '')}
          onChangeText={(value) => handleFieldChange(field, value)}
          keyboardType={keyboardType}
          placeholder="-"
          placeholderTextColor="#9CA3AF"
        />
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#065F46" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Cargando W-2...</Text>
        </View>
      </View>
    );
  }

  if (!w2Data) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#065F46" />
        <View style={styles.loadingContainer}>
          <Ionicons name="document-text-outline" size={64} color="#D1D5DB" />
          <Text style={styles.emptyText}>No hay W-2 para revisar</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#065F46" />
      
      {/* Header */}
      <LinearGradient colors={['#065F46', '#10B981']} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Revisar W-2</Text>
            <Text style={styles.headerSubtitle}>
              Confianza OCR: {w2Data.confidence_score}%
            </Text>
          </View>
          {w2Data.needs_review && (
            <View style={styles.reviewBadge}>
              <Ionicons name="alert-circle" size={16} color="#F59E0B" />
            </View>
          )}
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Review Notes */}
          {w2Data.review_notes && (
            <View style={styles.reviewNotesCard}>
              <View style={styles.reviewNotesHeader}>
                <Ionicons name="warning" size={20} color="#F59E0B" />
                <Text style={styles.reviewNotesTitle}>Notas de Revisión</Text>
              </View>
              <Text style={styles.reviewNotesText}>{w2Data.review_notes}</Text>
            </View>
          )}

          {/* Employer Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="business" size={20} color="#10B981" />
              <Text style={styles.sectionTitle}>Información del Empleador</Text>
            </View>
            {renderField('Nombre del Empleador', 'employer_name')}
            {renderField('EIN (Employer ID)', 'employer_ein')}
          </View>

          {/* Employee Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="person" size={20} color="#3B82F6" />
              <Text style={styles.sectionTitle}>Información del Empleado</Text>
            </View>
            {renderField('Nombre del Empleado', 'employee_name')}
            {renderField('SSN', 'employee_ssn')}
          </View>

          {/* Income Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="cash" size={20} color="#10B981" />
              <Text style={styles.sectionTitle}>Ingresos y Retenciones</Text>
            </View>
            
            <View style={styles.boxRow}>
              <View style={styles.boxHalf}>
                <Text style={styles.boxLabel}>Box 1 - Wages</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputPrefix}>$</Text>
                  <TextInput
                    style={[styles.fieldInput, styles.fieldInputWithPrefix]}
                    value={String(editedData.box1_wages || '')}
                    onChangeText={(v) => handleFieldChange('box1_wages', v)}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <View style={styles.boxHalf}>
                <Text style={styles.boxLabel}>Box 2 - Federal Tax</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputPrefix}>$</Text>
                  <TextInput
                    style={[styles.fieldInput, styles.fieldInputWithPrefix]}
                    value={String(editedData.box2_federal_withheld || '')}
                    onChangeText={(v) => handleFieldChange('box2_federal_withheld', v)}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>

            <View style={styles.boxRow}>
              <View style={styles.boxHalf}>
                <Text style={styles.boxLabel}>Box 3 - SS Wages</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputPrefix}>$</Text>
                  <TextInput
                    style={[styles.fieldInput, styles.fieldInputWithPrefix]}
                    value={String(editedData.box3_ss_wages || '')}
                    onChangeText={(v) => handleFieldChange('box3_ss_wages', v)}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <View style={styles.boxHalf}>
                <Text style={styles.boxLabel}>Box 4 - SS Tax</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputPrefix}>$</Text>
                  <TextInput
                    style={[styles.fieldInput, styles.fieldInputWithPrefix]}
                    value={String(editedData.box4_ss_withheld || '')}
                    onChangeText={(v) => handleFieldChange('box4_ss_withheld', v)}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>

            <View style={styles.boxRow}>
              <View style={styles.boxHalf}>
                <Text style={styles.boxLabel}>Box 5 - Medicare Wages</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputPrefix}>$</Text>
                  <TextInput
                    style={[styles.fieldInput, styles.fieldInputWithPrefix]}
                    value={String(editedData.box5_medicare_wages || '')}
                    onChangeText={(v) => handleFieldChange('box5_medicare_wages', v)}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <View style={styles.boxHalf}>
                <Text style={styles.boxLabel}>Box 6 - Medicare Tax</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputPrefix}>$</Text>
                  <TextInput
                    style={[styles.fieldInput, styles.fieldInputWithPrefix]}
                    value={String(editedData.box6_medicare_withheld || '')}
                    onChangeText={(v) => handleFieldChange('box6_medicare_withheld', v)}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>
          </View>

          {/* State Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="flag" size={20} color="#8B5CF6" />
              <Text style={styles.sectionTitle}>Impuestos Estatales</Text>
            </View>
            
            <View style={styles.boxRow}>
              <View style={styles.boxThird}>
                <Text style={styles.boxLabel}>Box 15 - State</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={String(editedData.box15_state || '')}
                  onChangeText={(v) => handleFieldChange('box15_state', v)}
                  maxLength={2}
                  autoCapitalize="characters"
                />
              </View>
              <View style={styles.boxThird}>
                <Text style={styles.boxLabel}>Box 16 - State Wages</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputPrefix}>$</Text>
                  <TextInput
                    style={[styles.fieldInput, styles.fieldInputWithPrefix]}
                    value={String(editedData.box16_state_wages || '')}
                    onChangeText={(v) => handleFieldChange('box16_state_wages', v)}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <View style={styles.boxThird}>
                <Text style={styles.boxLabel}>Box 17 - State Tax</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputPrefix}>$</Text>
                  <TextInput
                    style={[styles.fieldInput, styles.fieldInputWithPrefix]}
                    value={String(editedData.box17_state_withheld || '')}
                    onChangeText={(v) => handleFieldChange('box17_state_withheld', v)}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Summary Card */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Resumen</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Ingreso Total (Box 1)</Text>
              <Text style={styles.summaryValue}>${formatCurrency(editedData.box1_wages || 0)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Retención Federal (Box 2)</Text>
              <Text style={[styles.summaryValue, { color: '#10B981' }]}>
                ${formatCurrency(editedData.box2_federal_withheld || 0)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Retención Estatal (Box 17)</Text>
              <Text style={[styles.summaryValue, { color: '#3B82F6' }]}>
                ${formatCurrency(editedData.box17_state_withheld || 0)}
              </Text>
            </View>
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.rejectButton]}
          onPress={handleReject}
          disabled={saving}
        >
          <Ionicons name="close-circle" size={22} color="#EF4444" />
          <Text style={styles.rejectButtonText}>Rechazar</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.approveButton]}
          onPress={handleApprove}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={22} color="#fff" />
              <Text style={styles.approveButtonText}>Aprobar</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#065F46',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    color: '#6B7280',
  },
  backButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#10B981',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 8,
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
  reviewBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    padding: 8,
    borderRadius: 20,
  },
  content: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 20,
  },
  reviewNotesCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  reviewNotesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewNotesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginLeft: 8,
  },
  reviewNotesText: {
    fontSize: 14,
    color: '#78350F',
    lineHeight: 20,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 10,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputPrefix: {
    paddingLeft: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  fieldInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  fieldInputWithPrefix: {
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  boxRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  boxHalf: {
    flex: 1,
  },
  boxThird: {
    flex: 1,
  },
  boxLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 6,
  },
  summaryCard: {
    backgroundColor: '#065F46',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    paddingBottom: 32,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  rejectButton: {
    backgroundColor: '#FEE2E2',
  },
  rejectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  approveButton: {
    backgroundColor: '#10B981',
  },
  approveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
