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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { apiCall } from '../src/utils/api';
import { useColors, Spacing, FontSizes, BorderRadius } from '../src/constants/theme';

interface Property {
  _id: string;
  name: string;
  address: string;
  rent_amount?: number;
}

interface Tenant {
  _id: string;
  first_name: string;
  last_name: string;
  email: string;
}

const LEASE_TERMS = [
  { value: 6, label: '6 Meses' },
  { value: 12, label: '1 Año' },
  { value: 24, label: '2 Años' },
  { value: 0, label: 'Mes a Mes' },
];

export default function AdminCreateContractScreen() {
  const Colors = useColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPropertyPicker, setShowPropertyPicker] = useState(false);
  const [showTenantPicker, setShowTenantPicker] = useState(false);

  // Form fields
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [rentAmount, setRentAmount] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [leaseTerm, setLeaseTerm] = useState(12);
  const [startDate, setStartDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchData();
    // Set default start date to first of next month
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    setStartDate(nextMonth.toISOString().split('T')[0]);
  }, []);

  const fetchData = async () => {
    try {
      const [propData, tenantData] = await Promise.all([
        apiCall('/admin/properties'),
        apiCall('/admin/tenants'),
      ]);
      setProperties(propData.properties || propData || []);
      setTenants(tenantData.tenants || tenantData || []);
    } catch (err) {
      console.log('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePropertySelect = (property: Property) => {
    setSelectedProperty(property);
    setShowPropertyPicker(false);
    if (property.rent_amount) {
      setRentAmount(property.rent_amount.toString());
      setDepositAmount(property.rent_amount.toString()); // Default deposit = 1 month rent
    }
  };

  const calculateEndDate = () => {
    if (!startDate) return '';
    const start = new Date(startDate);
    if (leaseTerm === 0) return 'Mes a Mes';
    start.setMonth(start.getMonth() + leaseTerm);
    return start.toISOString().split('T')[0];
  };

  const handleSubmit = async () => {
    if (!selectedProperty) {
      Alert.alert('Error', 'Selecciona una propiedad');
      return;
    }
    if (!selectedTenant) {
      Alert.alert('Error', 'Selecciona un inquilino');
      return;
    }
    if (!rentAmount || parseFloat(rentAmount) <= 0) {
      Alert.alert('Error', 'Ingresa un monto de renta válido');
      return;
    }
    if (!startDate) {
      Alert.alert('Error', 'Selecciona la fecha de inicio');
      return;
    }

    setSubmitting(true);
    try {
      const endDate = calculateEndDate();
      
      await apiCall('/admin/rental-contracts', {
        method: 'POST',
        body: {
          property_id: selectedProperty._id,
          tenant_id: selectedTenant._id,
          tenant_name: `${selectedTenant.first_name} ${selectedTenant.last_name}`,
          tenant_email: selectedTenant.email,
          property_name: selectedProperty.name,
          property_address: selectedProperty.address,
          rent_amount: parseFloat(rentAmount),
          deposit_amount: parseFloat(depositAmount) || parseFloat(rentAmount),
          lease_term_months: leaseTerm,
          start_date: startDate,
          end_date: leaseTerm > 0 ? endDate : null,
          notes: notes.trim() || null,
          status: 'draft',
        },
      });

      Alert.alert(
        'Éxito',
        'Contrato creado correctamente. Ahora puedes enviarlo al inquilino para firma.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo crear el contrato');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.brandRed} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={['rgba(217,170,92,0.08)', 'transparent']} style={styles.bgGradient} />
      
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={[styles.container, { paddingTop: insets.top }]}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Nuevo Contrato</Text>
              <Text style={styles.headerSubtitle}>Crear contrato de arrendamiento</Text>
            </View>
          </View>

          {/* Property Selector */}
          <Text style={styles.label}>Propiedad *</Text>
          <TouchableOpacity
            style={styles.selector}
            onPress={() => { setShowPropertyPicker(!showPropertyPicker); setShowTenantPicker(false); }}
          >
            <Ionicons name="business" size={18} color={Colors.warmGold} />
            <Text style={[styles.selectorText, !selectedProperty && { color: Colors.textMuted }]}>
              {selectedProperty?.name || 'Seleccionar propiedad'}
            </Text>
            <Ionicons name="chevron-down" size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          {showPropertyPicker && (
            <View style={styles.pickerList}>
              {properties.map((p) => (
                <TouchableOpacity
                  key={p._id}
                  style={[styles.pickerItem, selectedProperty?._id === p._id && styles.pickerItemActive]}
                  onPress={() => handlePropertySelect(p)}
                >
                  <View style={styles.pickerItemRow}>
                    <Text style={styles.pickerItemText}>{p.name}</Text>
                    {p.rent_amount && (
                      <Text style={styles.pickerItemPrice}>${p.rent_amount.toLocaleString()}/mes</Text>
                    )}
                  </View>
                  <Text style={styles.pickerItemSub}>{p.address}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Tenant Selector */}
          <Text style={styles.label}>Inquilino *</Text>
          <TouchableOpacity
            style={styles.selector}
            onPress={() => { setShowTenantPicker(!showTenantPicker); setShowPropertyPicker(false); }}
          >
            <Ionicons name="person" size={18} color="#3B82F6" />
            <Text style={[styles.selectorText, !selectedTenant && { color: Colors.textMuted }]}>
              {selectedTenant ? `${selectedTenant.first_name} ${selectedTenant.last_name}` : 'Seleccionar inquilino'}
            </Text>
            <Ionicons name="chevron-down" size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          {showTenantPicker && (
            <View style={styles.pickerList}>
              {tenants.length === 0 ? (
                <View style={styles.emptyPicker}>
                  <Text style={styles.emptyText}>No hay inquilinos registrados</Text>
                  <TouchableOpacity
                    style={styles.createUserLink}
                    onPress={() => router.push('/admin-create-user')}
                  >
                    <Ionicons name="add-circle" size={16} color={Colors.brandRed} />
                    <Text style={styles.createUserText}>Crear nuevo inquilino</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                tenants.map((t) => (
                  <TouchableOpacity
                    key={t._id}
                    style={[styles.pickerItem, selectedTenant?._id === t._id && styles.pickerItemActive]}
                    onPress={() => { setSelectedTenant(t); setShowTenantPicker(false); }}
                  >
                    <Text style={styles.pickerItemText}>{t.first_name} {t.last_name}</Text>
                    <Text style={styles.pickerItemSub}>{t.email}</Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {/* Lease Term */}
          <Text style={styles.label}>Duración del Contrato</Text>
          <View style={styles.termRow}>
            {LEASE_TERMS.map((term) => (
              <TouchableOpacity
                key={term.value}
                style={[styles.termChip, leaseTerm === term.value && styles.termChipActive]}
                onPress={() => setLeaseTerm(term.value)}
              >
                <Text style={[styles.termText, leaseTerm === term.value && styles.termTextActive]}>
                  {term.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Dates */}
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Fecha Inicio *</Text>
              <TextInput
                style={styles.input}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Fecha Fin</Text>
              <View style={[styles.input, styles.inputDisabled]}>
                <Text style={styles.inputText}>{calculateEndDate() || '-'}</Text>
              </View>
            </View>
          </View>

          {/* Amounts */}
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Renta Mensual *</Text>
              <View style={styles.inputWrap}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={rentAmount}
                  onChangeText={setRentAmount}
                  placeholder="0"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Depósito</Text>
              <View style={styles.inputWrap}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={depositAmount}
                  onChangeText={setDepositAmount}
                  placeholder="0"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          </View>

          {/* Notes */}
          <Text style={styles.label}>Notas Adicionales</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Términos especiales, mascotas, estacionamiento, etc."
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={3}
          />

          {/* Summary Card */}
          {selectedProperty && selectedTenant && rentAmount && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Resumen del Contrato</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Propiedad:</Text>
                <Text style={styles.summaryValue}>{selectedProperty.name}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Inquilino:</Text>
                <Text style={styles.summaryValue}>{selectedTenant.first_name} {selectedTenant.last_name}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Renta:</Text>
                <Text style={[styles.summaryValue, { color: Colors.success }]}>${parseFloat(rentAmount).toLocaleString()}/mes</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Duración:</Text>
                <Text style={styles.summaryValue}>{leaseTerm === 0 ? 'Mes a Mes' : `${leaseTerm} meses`}</Text>
              </View>
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Ionicons name="document-text" size={20} color={Colors.white} />
                <Text style={styles.submitText}>Crear Contrato</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.base },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  bgGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: Spacing.md },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.glassLight,
    borderWidth: 1, borderColor: Colors.glassBorderLight,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: FontSizes['2xl'], fontWeight: '800', color: Colors.textPrimary },
  headerSubtitle: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 2 },

  label: {
    fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textSecondary,
    marginTop: Spacing.md, marginBottom: 8,
  },

  selector: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.glass, padding: 14,
    borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.glassBorderLight,
  },
  selectorText: { flex: 1, fontSize: FontSizes.sm, color: Colors.textPrimary },

  pickerList: {
    backgroundColor: Colors.glassLight, borderRadius: BorderRadius.md,
    marginTop: 8, overflow: 'hidden', maxHeight: 200,
  },
  pickerItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.glassLight },
  pickerItemActive: { backgroundColor: 'rgba(200,16,46,0.15)' },
  pickerItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerItemText: { fontSize: FontSizes.sm, color: Colors.textPrimary, fontWeight: '600' },
  pickerItemPrice: { fontSize: FontSizes.xs, color: Colors.success, fontWeight: '600' },
  pickerItemSub: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 2 },

  emptyPicker: { padding: 20, alignItems: 'center' },
  emptyText: { fontSize: FontSizes.sm, color: Colors.textMuted },
  createUserLink: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12,
  },
  createUserText: { fontSize: FontSizes.sm, color: Colors.brandRed, fontWeight: '600' },

  termRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  termChip: {
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: Colors.glassLight, borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: Colors.glassBorderLight,
  },
  termChipActive: { backgroundColor: Colors.warmGold, borderColor: Colors.warmGold },
  termText: { fontSize: FontSizes.sm, color: Colors.textMuted, fontWeight: '600' },
  termTextActive: { color: '#000' },

  row: { flexDirection: 'row', gap: 12 },

  input: {
    backgroundColor: Colors.glass, padding: 14,
    borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.glassBorderLight,
    fontSize: FontSizes.sm, color: Colors.textPrimary,
  },
  inputDisabled: {
    backgroundColor: Colors.glass,
    justifyContent: 'center',
  },
  inputText: { fontSize: FontSizes.sm, color: Colors.textMuted },
  textArea: { minHeight: 80, textAlignVertical: 'top' },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.glass, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.glassBorderLight,
  },
  currencySymbol: {
    fontSize: FontSizes.lg, fontWeight: '700', color: Colors.success,
    paddingLeft: 14,
  },
  amountInput: {
    flex: 1, fontSize: FontSizes.lg, fontWeight: '700', color: Colors.textPrimary,
    padding: 14,
  },

  summaryCard: {
    backgroundColor: 'rgba(217,170,92,0.1)', padding: 16,
    borderRadius: BorderRadius.card, borderWidth: 1, borderColor: 'rgba(217,170,92,0.3)',
    marginTop: Spacing.lg,
  },
  summaryTitle: {
    fontSize: FontSizes.sm, fontWeight: '700', color: Colors.warmGold,
    marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1,
  },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryLabel: { fontSize: FontSizes.sm, color: Colors.textMuted },
  summaryValue: { fontSize: FontSizes.sm, color: Colors.textPrimary, fontWeight: '600' },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.brandRed, padding: 16, borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  submitText: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.textPrimary },
});
