import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

interface Dependent {
  id?: string;
  first_name: string;
  last_name: string;
  relationship: string;
  date_of_birth: string;
  ssn_last4: string;
  is_student: boolean;
  is_disabled: boolean;
}

const RELATIONSHIPS = [
  { value: 'child', label: 'Hijo(a)', icon: 'person' },
  { value: 'spouse', label: 'Esposo(a)', icon: 'heart' },
  { value: 'parent', label: 'Padre/Madre', icon: 'people' },
  { value: 'sibling', label: 'Hermano(a)', icon: 'people-circle' },
  { value: 'other', label: 'Otro', icon: 'person-add' },
];

export default function DependentsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDependent, setEditingDependent] = useState<Dependent | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Dependent>({
    first_name: '',
    last_name: '',
    relationship: 'child',
    date_of_birth: '',
    ssn_last4: '',
    is_student: false,
    is_disabled: false,
  });

  useEffect(() => {
    loadDependents();
  }, []);

  const loadDependents = async () => {
    try {
      const response = await api.get('/dependents');
      setDependents(response.data?.dependents || response.data || []);
    } catch (error) {
      setDependents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      Alert.alert(t('dependents.requiredFields', 'Campos requeridos'), t('dependents.fieldsRequired', 'Por favor ingresa el nombre y apellido'));
      return;
    }
    if (!formData.date_of_birth.trim()) {
      Alert.alert(t('dependents.fieldRequired', 'Campo requerido'), t('dependents.dobRequired', 'Por favor ingresa la fecha de nacimiento'));
      return;
    }

    setSaving(true);
    try {
      if (editingDependent?.id) {
        await api.put(`/dependents/${editingDependent.id}`, formData);
      } else {
        await api.post('/dependents', formData);
      }
      await loadDependents();
      setShowAddModal(false);
      resetForm();
    } catch (error: any) {
      Alert.alert(t('common.error', 'Error'), error.response?.data?.detail || t('dependents.saveFailed', 'No se pudo guardar'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (dependent: Dependent) => {
    Alert.alert(
      t('dependents.deleteDependent', 'Eliminar Dependiente'),
      t('dependents.confirmDelete', { name: dependent.first_name, defaultValue: `¿Estás seguro de eliminar a ${dependent.first_name}?` }),
      [
        { text: t('common.cancel', 'Cancelar'), style: 'cancel' },
        {
          text: t('dependents.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/dependents/${dependent.id}`);
              await loadDependents();
            } catch (error) {
              Alert.alert(t('common.error', 'Error'), t('dependents.deleteFailed', 'No se pudo eliminar'));
            }
          },
        },
      ]
    );
  };

  const handleEdit = (dependent: Dependent) => {
    setEditingDependent(dependent);
    setFormData({ ...dependent });
    setShowAddModal(true);
  };

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      relationship: 'child',
      date_of_birth: '',
      ssn_last4: '',
      is_student: false,
      is_disabled: false,
    });
    setEditingDependent(null);
  };

  const getRelationshipInfo = (value: string) => {
    return RELATIONSHIPS.find(r => r.value === value) || RELATIONSHIPS[4];
  };

  const getAge = (dob: string) => {
    try {
      const parts = dob.split('/');
      const birthDate = parts.length === 3
        ? new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]))
        : new Date(dob);
      const diff = Date.now() - birthDate.getTime();
      return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    } catch {
      return null;
    }
  };

  const renderDependentCard = (dependent: Dependent, index: number) => {
    const rel = getRelationshipInfo(dependent.relationship);
    const age = getAge(dependent.date_of_birth);

    return (
      <View key={dependent.id || index} style={s.dependentCard}>
        <View style={s.cardLeft}>
          <LinearGradient
            colors={dependent.relationship === 'child' ? ['#10B981', '#059669'] : 
                   dependent.relationship === 'spouse' ? ['#EC4899', '#DB2777'] :
                   ['#6366F1', '#4F46E5']}
            style={s.avatarGradient}
          >
            <Ionicons name={rel.icon as any} size={22} color="#FFF" />
          </LinearGradient>
          <View style={s.cardInfo}>
            <Text style={s.cardName}>{dependent.first_name} {dependent.last_name}</Text>
            <Text style={s.cardRelation}>
              {rel.label} {age !== null ? `• ${age} años` : ''}
            </Text>
            <View style={s.cardBadges}>
              {dependent.ssn_last4 && (
                <View style={s.badge}>
                  <Ionicons name="shield-checkmark" size={10} color="#059669" />
                  <Text style={s.badgeText}>SSN •••-••-{dependent.ssn_last4.replace(/\D/g, '').slice(-4)}</Text>
                </View>
              )}
              {dependent.is_student && (
                <View style={[s.badge, { backgroundColor: '#DBEAFE' }]}>
                  <Text style={[s.badgeText, { color: '#2563EB' }]}>{t('dependents.student', 'Estudiante')}</Text>
                </View>
              )}
              {dependent.is_disabled && (
                <View style={[s.badge, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={[s.badgeText, { color: '#D97706' }]}>{t('dependents.disability', 'Discapacidad')}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
        <View style={s.cardActions}>
          <TouchableOpacity onPress={() => handleEdit(dependent)} style={s.actionBtn}>
            <Ionicons name="pencil" size={18} color="#6B7280" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(dependent)} style={s.actionBtn}>
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      {/* Header */}
      <LinearGradient
        colors={['#064E3B', '#059669']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.header, { paddingTop: insets.top + 8 }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Mis Dependientes</Text>
          <Text style={s.headerSubtitle}>{t('dependents.subtitle', 'Familiares en tu declaración')}</Text>
        </View>
        <TouchableOpacity
          onPress={() => { resetForm(); setShowAddModal(true); }}
          style={s.addBtn}
        >
          <Ionicons name="person-add" size={20} color="#FFF" />
        </TouchableOpacity>
      </LinearGradient>

      {loading ? (
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color="#059669" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.content}>
          {/* Info Banner */}
          <View style={s.infoBanner}>
            <Ionicons name="information-circle" size={20} color="#059669" />
            <Text style={s.infoText}>
              Agregar dependientes puede aumentar tu reembolso significativamente. Cada hijo menor de 17 años puede generar hasta $2,000 en crédito fiscal.
            </Text>
          </View>

          {/* Dependents List */}
          {dependents.length === 0 ? (
            <View style={s.emptyState}>
              <View style={s.emptyIcon}>
                <Ionicons name="people-outline" size={48} color="#D1D5DB" />
              </View>
              <Text style={s.emptyTitle}>{t('dependents.noDependents')}</Text>
              <Text style={s.emptyText}>
                Agrega a tus hijos, esposo(a) u otros dependientes para maximizar tu reembolso.
              </Text>
              <TouchableOpacity
                style={s.emptyBtn}
                onPress={() => { resetForm(); setShowAddModal(true); }}
              >
                <Ionicons name="add-circle" size={22} color="#FFF" />
                <Text style={s.emptyBtnText}>{t('dependents.addDependent')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Summary */}
              <View style={s.summaryCard}>
                <View style={s.summaryRow}>
                  <View style={s.summaryItem}>
                    <Text style={s.summaryNumber}>{dependents.length}</Text>
                    <Text style={s.summaryLabel}>{t('dependents.title')}</Text>
                  </View>
                  <View style={s.summaryDivider} />
                  <View style={s.summaryItem}>
                    <Text style={s.summaryNumber}>
                      {dependents.filter(d => d.relationship === 'child').length}
                    </Text>
                    <Text style={s.summaryLabel}>{t('dependents.children', 'Hijos')}</Text>
                  </View>
                  <View style={s.summaryDivider} />
                  <View style={s.summaryItem}>
                    <Text style={[s.summaryNumber, { color: '#059669' }]}>
                      ${(dependents.filter(d => d.relationship === 'child' && getAge(d.date_of_birth)! < 17).length * 2000).toLocaleString()}
                    </Text>
                    <Text style={s.summaryLabel}>Crédito Est.</Text>
                  </View>
                </View>
              </View>

              {dependents.map(renderDependentCard)}

              <TouchableOpacity
                style={s.addMoreBtn}
                onPress={() => { resetForm(); setShowAddModal(true); }}
              >
                <Ionicons name="add" size={20} color="#059669" />
                <Text style={s.addMoreText}>{t('dependents.addAnother', 'Agregar otro dependiente')}</Text>
              </TouchableOpacity>
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Add/Edit Modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.modalContainer}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            {/* Modal Header */}
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => { setShowAddModal(false); resetForm(); }}>
                <Text style={s.modalCancel}>{t('common.cancel', 'Cancelar')}</Text>
              </TouchableOpacity>
              <Text style={s.modalTitle}>
                {editingDependent ? t('dependents.editDependent', 'Editar Dependiente') : t('dependents.addDependent', 'Agregar Dependiente')}
              </Text>
              <TouchableOpacity onPress={handleSave} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color="#059669" />
                ) : (
                  <Text style={s.modalSave}>{t('dependents.save')}</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.modalContent}>
              {/* Relationship selector */}
              <Text style={s.formLabel}>{t('dependents.relationship')}</Text>
              <View style={s.relationshipRow}>
                {RELATIONSHIPS.map((rel) => (
                  <TouchableOpacity
                    key={rel.value}
                    style={[
                      s.relationshipChip,
                      formData.relationship === rel.value && s.relationshipChipActive,
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, relationship: rel.value }))}
                  >
                    <Ionicons
                      name={rel.icon as any}
                      size={16}
                      color={formData.relationship === rel.value ? '#FFF' : '#6B7280'}
                    />
                    <Text
                      style={[
                        s.relationshipChipText,
                        formData.relationship === rel.value && s.relationshipChipTextActive,
                      ]}
                    >
                      {rel.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Name fields */}
              <Text style={s.formLabel}>{t('dependents.firstName')}</Text>
              <TextInput
                style={s.input}
                placeholder={t('dependents.firstName')}
                value={formData.first_name}
                onChangeText={(v) => setFormData(prev => ({ ...prev, first_name: v }))}
                placeholderTextColor="#9CA3AF"
              />

              <Text style={s.formLabel}>{t('dependents.lastName')}</Text>
              <TextInput
                style={s.input}
                placeholder={t('dependents.lastName')}
                value={formData.last_name}
                onChangeText={(v) => setFormData(prev => ({ ...prev, last_name: v }))}
                placeholderTextColor="#9CA3AF"
              />

              {/* Date of birth */}
              <Text style={s.formLabel}>{t('dependents.dateOfBirth')}</Text>
              <TextInput
                style={s.input}
                placeholder="MM/DD/YYYY"
                value={formData.date_of_birth}
                onChangeText={(v) => setFormData(prev => ({ ...prev, date_of_birth: v }))}
                keyboardType="numeric"
                maxLength={10}
                placeholderTextColor="#9CA3AF"
              />

              {/* SSN/ITIN Full */}
              <Text style={s.formLabel}>Número de Social Security / ITIN</Text>
              <TextInput
                style={s.input}
                placeholder="XXX-XX-XXXX"
                value={formData.ssn_last4}
                onChangeText={(v) => {
                  // Auto-format as XXX-XX-XXXX
                  const digits = v.replace(/\D/g, '').slice(0, 9);
                  let formatted = digits;
                  if (digits.length > 3) formatted = digits.slice(0, 3) + '-' + digits.slice(3);
                  if (digits.length > 5) formatted = digits.slice(0, 3) + '-' + digits.slice(3, 5) + '-' + digits.slice(5);
                  setFormData(prev => ({ ...prev, ssn_last4: formatted }));
                }}
                keyboardType="numeric"
                maxLength={11}
                secureTextEntry={false}
                placeholderTextColor="#9CA3AF"
              />
              <Text style={s.ssnNote}>Requerido por el IRS para la declaración de impuestos</Text>

              {/* Toggles */}
              <View style={s.toggleRow}>
                <View style={s.toggleInfo}>
                  <Ionicons name="school" size={20} color="#6366F1" />
                  <Text style={s.toggleLabel}>Es estudiante (tiempo completo)</Text>
                </View>
                <TouchableOpacity
                  style={[s.toggle, formData.is_student && s.toggleActive]}
                  onPress={() => setFormData(prev => ({ ...prev, is_student: !prev.is_student }))}
                >
                  <View style={[s.toggleThumb, formData.is_student && s.toggleThumbActive]} />
                </TouchableOpacity>
              </View>

              <View style={s.toggleRow}>
                <View style={s.toggleInfo}>
                  <Ionicons name="accessibility" size={20} color="#D97706" />
                  <Text style={s.toggleLabel}>{t('dependents.hasDisability', 'Tiene discapacidad')}</Text>
                </View>
                <TouchableOpacity
                  style={[s.toggle, formData.is_disabled && s.toggleActive]}
                  onPress={() => setFormData(prev => ({ ...prev, is_disabled: !prev.is_disabled }))}
                >
                  <View style={[s.toggleThumb, formData.is_disabled && s.toggleThumbActive]} />
                </TouchableOpacity>
              </View>

              <View style={{ height: 40 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFB' },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16 },
  // Info banner
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: 13, color: '#047857', lineHeight: 18 },
  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20, marginBottom: 24, paddingHorizontal: 20 },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  emptyBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  // Summary
  summaryCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryNumber: { fontSize: 24, fontWeight: '900', color: '#1F2937' },
  summaryLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginTop: 2 },
  summaryDivider: { width: 1, height: 32, backgroundColor: '#E5E7EB' },
  // Dependent card
  dependentCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  avatarGradient: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 2 },
  cardRelation: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  cardBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: { fontSize: 10, color: '#059669', fontWeight: '600' },
  cardActions: { flexDirection: 'row', gap: 4 },
  actionBtn: { padding: 8, borderRadius: 8 },
  addMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#059669',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 6,
  },
  addMoreText: { fontSize: 14, color: '#059669', fontWeight: '600' },
  ssnNote: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
    fontStyle: 'italic',
  },
  // Modal
  modalContainer: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalCancel: { fontSize: 16, color: '#6B7280' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1F2937' },
  modalSave: { fontSize: 16, fontWeight: '700', color: '#059669' },
  modalContent: { padding: 20 },
  formLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#1F2937',
  },
  relationshipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  relationshipChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  relationshipChipActive: { backgroundColor: '#059669' },
  relationshipChipText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  relationshipChipTextActive: { color: '#FFF' },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    marginTop: 8,
  },
  toggleInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  toggleLabel: { fontSize: 14, color: '#374151', fontWeight: '500' },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    padding: 2,
  },
  toggleActive: { backgroundColor: '#059669' },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbActive: { alignSelf: 'flex-end' },
});
