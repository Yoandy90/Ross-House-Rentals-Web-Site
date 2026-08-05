/**
 * Mi Reembolso - Dependents Screen
 * Step 4: Add dependents (children, parents, etc.)
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
  KeyboardAvoidingView,
  Platform,
  Alert,
  StatusBar,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

interface Dependent {
  id?: string;
  first_name: string;
  last_name: string;
  ssn: string;
  date_of_birth: string;
  relationship: string;
  months_lived: number;
}

const RELATIONSHIPS = [
  { id: 'child', label: 'Hijo/a' },
  { id: 'stepchild', label: 'Hijastro/a' },
  { id: 'grandchild', label: 'Nieto/a' },
  { id: 'parent', label: 'Padre/Madre' },
  { id: 'sibling', label: 'Hermano/a' },
  { id: 'other', label: 'Otro familiar' },
];

export default function DependentsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Form fields for modal
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [ssn, setSsn] = useState('');
  const [dob, setDob] = useState('');
  const [relationship, setRelationship] = useState('child');
  const [monthsLived, setMonthsLived] = useState('12');

  // TIN Matching for dependents
  const [depTinStatus, setDepTinStatus] = useState<'idle' | 'verifying' | 'match' | 'no_match' | 'error'>('idle');
  const [depTinMessage, setDepTinMessage] = useState('');

  // Live estimate
  const [liveEstimate, setLiveEstimate] = useState<any>(null);

  useEffect(() => {
    loadExistingData();
  }, []);

  const loadExistingData = async () => {
    if (!sessionId) return;
    try {
      const response = await api.get(`/tax-wizard/session/${sessionId}`);
      if (response.data.success && response.data.session.dependents) {
        setDependents(response.data.session.dependents.map((d: any) => ({
          id: d.id,
          first_name: d.first_name || '',
          last_name: d.last_name || '',
          ssn: d.ssn || '',
          date_of_birth: d.date_of_birth || '',
          relationship: d.relationship || 'child',
          months_lived: d.months_lived || 12,
        })));
      }
      // Get estimate
      const estimateResponse = await api.get(`/tax-wizard/session/${sessionId}/estimate`);
      if (estimateResponse.data.success) {
        setLiveEstimate(estimateResponse.data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatSSN = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 5) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 5)}-${numbers.slice(5, 9)}`;
  };

  const formatDate = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 4) return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
  };

  // Auto-verify dependent TIN when SSN is complete
  useEffect(() => {
    const cleanSSN = ssn.replace(/\D/g, '');
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
    if (cleanSSN.length === 9 && fullName.length >= 2 && showModal) {
      const timer = setTimeout(() => {
        verifyDepTIN(cleanSSN, fullName);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [ssn, firstName, lastName, showModal]);

  const verifyDepTIN = async (tin: string, name: string) => {
    setDepTinStatus('verifying');
    setDepTinMessage('');
    try {
      const response = await api.post('/tin-matching/verify', { tin, name, tin_type: 'SSN' });
      if (response.data.status === 'match' || response.data.response_code === '0') {
        setDepTinStatus('match');
        setDepTinMessage(t('wizard.tinMatch', 'SSN verificado con el IRS'));
      } else {
        setDepTinStatus('no_match');
        setDepTinMessage(response.data.message || t('wizard.tinNoMatch', 'SSN no coincide'));
      }
    } catch (error: any) {
      setDepTinStatus('error');
      setDepTinMessage(t('wizard.tinUnavailable', 'Verificación IRS no disponible'));
    }
  };

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setSsn('');
    setDob('');
    setRelationship('child');
    setMonthsLived('12');
    setEditingIndex(null);
    setDepTinStatus('idle');
    setDepTinMessage('');
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (index: number) => {
    const dep = dependents[index];
    setFirstName(dep.first_name);
    setLastName(dep.last_name);
    setSsn(dep.ssn);
    setDob(dep.date_of_birth);
    setRelationship(dep.relationship);
    setMonthsLived(dep.months_lived.toString());
    setEditingIndex(index);
    setShowModal(true);
  };

  const saveDependent = () => {
    if (!firstName || !lastName) {
      Alert.alert(t('common.error'), t('wizard.dependents.nameRequired'));
      return;
    }

    let formattedDob = dob;
    if (dob && dob.includes('/')) {
      const parts = dob.split('/');
      if (parts.length === 3) {
        formattedDob = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
      }
    }

    const newDep: Dependent = {
      first_name: firstName,
      last_name: lastName,
      ssn: ssn.replace(/\D/g, ''),
      date_of_birth: formattedDob,
      relationship: relationship,
      months_lived: parseInt(monthsLived) || 12,
    };

    if (editingIndex !== null) {
      const updated = [...dependents];
      updated[editingIndex] = newDep;
      setDependents(updated);
    } else {
      setDependents([...dependents, newDep]);
    }

    setShowModal(false);
    resetForm();
  };

  const removeDependent = (index: number) => {
    Alert.alert(
      t('wizard.dependents.deleteTitle'),
      '¿Estás seguro de que quieres eliminar este dependiente?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('wizard.dependents.delete'),
          style: 'destructive',
          onPress: () => setDependents(dependents.filter((_, i) => i !== index)),
        },
      ]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await api.post(`/tax-wizard/session/${sessionId}/dependents`, {
        dependents: dependents,
      });

      if (response.data.success) {
        if (response.data.live_estimate) {
          setLiveEstimate(response.data.live_estimate);
        }
        router.push({
          pathname: '/tax-wizard/deductions',
          params: { sessionId }
        });
      }
    } catch (error) {
      console.error('Error saving:', error);
      Alert.alert(t('common.error'), t('wizard.couldNotSave'));
    } finally {
      setSaving(false);
    }
  };

  const getRelationshipLabel = (id: string) => {
    return RELATIONSHIPS.find(r => r.id === id)?.label || id;
  };

  if (loading) {
    return (
      <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#065F46" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
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
          <TouchableOpacity 
            onPress={() => router.push({
              pathname: '/tax-wizard/income',
              params: { sessionId }
            })} 
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Dependientes</Text>
            <Text style={styles.headerStep}>Paso 4 de 6</Text>
          </View>
        </View>
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '66.6%' }]} />
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Live Estimate Card */}
        {liveEstimate && (
          <View style={styles.estimateCard}>
            <View style={styles.estimateHeader}>
              <Ionicons name="calculator" size={24} color="#10B981" />
              <Text style={styles.estimateLabel}>Reembolso Estimado</Text>
            </View>
            <Text style={[
              styles.estimateAmount,
              { color: liveEstimate.is_refund ? '#10B981' : '#EF4444' }
            ]}>
              {liveEstimate.is_refund ? '+' : '-'}${Math.abs(liveEstimate.estimated_refund || 0).toLocaleString()}
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>¿Tienes dependientes?</Text>
        <Text style={styles.sectionSubtitle}>
          Agregar dependientes puede aumentar tu reembolso con créditos como el Child Tax Credit ($2,000 por hijo)
        </Text>

        {/* Dependents List */}
        {dependents.map((dep, index) => (
          <View key={index} style={styles.dependentCard}>
            <View style={styles.dependentIcon}>
              <Ionicons name="person" size={24} color="#10B981" />
            </View>
            <View style={styles.dependentInfo}>
              <Text style={styles.dependentName}>
                {dep.first_name} {dep.last_name}
              </Text>
              <Text style={styles.dependentRelation}>
                {getRelationshipLabel(dep.relationship)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => openEditModal(index)}
            >
              <Ionicons name="pencil" size={20} color="#6B7280" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => removeDependent(index)}
            >
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </TouchableOpacity>
          </View>
        ))}

        {/* Add Dependent Button */}
        <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
          <Ionicons name="add-circle-outline" size={24} color="#10B981" />
          <Text style={styles.addButtonText}>Agregar Dependiente</Text>
        </TouchableOpacity>

        {dependents.length === 0 && (
          <View style={styles.noDependentsCard}>
            <Ionicons name="people-outline" size={48} color="#D1D5DB" />
            <Text style={styles.noDependentsText}>
              No tienes dependientes agregados.
            </Text>
            <Text style={styles.noDependentsSubtext}>
              Si no tienes dependientes, puedes continuar al siguiente paso.
            </Text>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomCTA}>
        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.nextButtonText}>
                {dependents.length === 0 ? t('wizard.dependents.continueWithout') : 'Continuar'}
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Add/Edit Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingIndex !== null ? t('wizard.dependents.editDependent') : t('wizard.dependents.addDependent')}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.row}>
                <View style={styles.inputHalf}>
                  <Text style={styles.label}>Nombre *</Text>
                  <TextInput
                    style={styles.input}
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="Juan"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
                <View style={styles.inputHalf}>
                  <Text style={styles.label}>Apellido *</Text>
                  <TextInput
                    style={styles.input}
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder={t('wizard.lastNamePlaceholder', 'Pérez')}
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.inputHalf}>
                  <Text style={styles.label}>SSN</Text>
                  <View style={{ position: 'relative' }}>
                    <TextInput
                      style={[
                        styles.input,
                        depTinStatus === 'match' && { borderColor: '#10B981', borderWidth: 2 },
                        depTinStatus === 'no_match' && { borderColor: '#F59E0B', borderWidth: 2 },
                      ]}
                      value={ssn}
                      onChangeText={(v) => {
                        setSsn(formatSSN(v));
                        setDepTinStatus('idle');
                        setDepTinMessage('');
                      }}
                      placeholder="XXX-XX-XXXX"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="number-pad"
                      maxLength={11}
                    />
                    {depTinStatus === 'verifying' && (
                      <View style={{ position: 'absolute', right: 12, top: 14 }}>
                        <ActivityIndicator size="small" color="#3B82F6" />
                      </View>
                    )}
                    {depTinStatus === 'match' && (
                      <View style={{ position: 'absolute', right: 12, top: 14 }}>
                        <Ionicons name="shield-checkmark" size={20} color="#10B981" />
                      </View>
                    )}
                    {depTinStatus === 'no_match' && (
                      <View style={{ position: 'absolute', right: 12, top: 14 }}>
                        <Ionicons name="warning" size={20} color="#F59E0B" />
                      </View>
                    )}
                  </View>
                  {depTinMessage !== '' && (
                    <Text style={{
                      fontSize: 11, marginTop: 4, fontWeight: '500',
                      color: depTinStatus === 'match' ? '#065F46' : depTinStatus === 'no_match' ? '#92400E' : '#6B7280',
                    }}>
                      {depTinStatus === 'match' ? '✅ ' : depTinStatus === 'no_match' ? '⚠️ ' : ''}{depTinMessage}
                    </Text>
                  )}
                  {depTinStatus === 'verifying' && (
                    <Text style={{ fontSize: 11, color: '#3B82F6', marginTop: 4, fontStyle: 'italic' }}>
                      {t('wizard.tinVerifying', 'Verificando con el IRS...')}
                    </Text>
                  )}
                </View>
                <View style={styles.inputHalf}>
                  <Text style={styles.label}>Fecha Nacimiento</Text>
                  <TextInput
                    style={styles.input}
                    value={dob}
                    onChangeText={(v) => setDob(formatDate(v))}
                    placeholder="MM/DD/YYYY"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                </View>
              </View>

              <Text style={styles.label}>Parentesco</Text>
              <View style={styles.relationshipGrid}>
                {RELATIONSHIPS.map((rel) => (
                  <TouchableOpacity
                    key={rel.id}
                    style={[
                      styles.relationshipOption,
                      relationship === rel.id && styles.relationshipSelected,
                    ]}
                    onPress={() => setRelationship(rel.id)}
                  >
                    <Text style={[
                      styles.relationshipText,
                      relationship === rel.id && styles.relationshipTextSelected,
                    ]}>
                      {rel.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Meses que vivió contigo en 2025</Text>
              <TextInput
                style={styles.input}
                value={monthsLived}
                onChangeText={setMonthsLived}
                placeholder="12"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                maxLength={2}
              />

              <TouchableOpacity style={styles.saveButton} onPress={saveDependent}>
                <Text style={styles.saveButtonText}>
                  {editingIndex !== null ? 'Actualizar' : 'Agregar'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  headerStep: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  progressContainer: {
    marginTop: 16,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 3,
  },
  content: {
    backgroundColor: '#F9FAFB',
    flex: 1,
    padding: 20,
  },
  estimateCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  estimateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  estimateLabel: {
    fontSize: 14,
    color: '#065F46',
    marginLeft: 8,
    fontWeight: '600',
  },
  estimateAmount: {
    fontSize: 36,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 20,
  },
  dependentCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dependentIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  dependentInfo: {
    flex: 1,
  },
  dependentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  dependentRelation: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  editBtn: {
    padding: 8,
    marginRight: 8,
  },
  deleteBtn: {
    padding: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#10B981',
    borderStyle: 'dashed',
    marginBottom: 20,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
    marginLeft: 8,
  },
  noDependentsCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  noDependentsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
  },
  noDependentsSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
  },
  bottomCTA: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 20,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  nextButton: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    marginRight: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  inputHalf: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#065F46',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  relationshipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  relationshipOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  relationshipSelected: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  relationshipText: {
    fontSize: 14,
    color: '#374151',
  },
  relationshipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
});
