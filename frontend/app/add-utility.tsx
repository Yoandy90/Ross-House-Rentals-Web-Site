import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { apiCall } from '../src/utils/api';
import { Spacing, FontSizes, BorderRadius, Shadows, useColors } from '../src/constants/theme';

interface Provider {
  id: string;
  name: string;
  type: string;
  icon: string;
  color: string;
}

export default function AddUtilityScreen() {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [amount, setAmount] = useState('');
  const [account, setAccount] = useState('');
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [paid, setPaid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      const res = await apiCall('/tenant/utilities/providers');
      if (res.success) setProviders(res.providers || []);
    } catch (err) {
      console.log('Providers fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedProvider) {
      Alert.alert('Error', 'Selecciona un proveedor de servicio.');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Ingresa un monto válido.');
      return;
    }

    setSaving(true);
    try {
      const res = await apiCall('/tenant/utilities', {
        method: 'POST',
        body: {
          provider_id: selectedProvider.id,
          provider_name: selectedProvider.name,
          provider_type: selectedProvider.type,
          account_number: account,
          amount: parseFloat(amount),
          period: period,
          due_date: dueDate,
          paid: paid,
          notes: notes,
        },
      });

      if (res.success) {
        Alert.alert('Guardado', `Registro de ${selectedProvider.name} guardado exitosamente.`, [
          { text: 'OK', onPress: () => router.replace('/services') },
        ]);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={C.brandRed} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.root}>
        <View style={styles.bgGlow1} />

        <ScrollView
          style={[styles.container, { paddingTop: insets.top }]}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color={C.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Agregar Servicio</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Provider Selection */}
          <Text style={styles.sectionLabel}>Selecciona el Proveedor</Text>
          <View style={styles.providerGrid}>
            {providers.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.providerItem,
                  selectedProvider?.id === p.id && { borderColor: p.color, borderWidth: 1.5 },
                ]}
                onPress={() => setSelectedProvider(p)}
                activeOpacity={0.7}
              >
                <View style={[styles.providerIcon, { backgroundColor: `${p.color}15` }]}>
                  <Ionicons name={p.icon as any} size={20} color={p.color} />
                </View>
                <Text style={styles.providerName} numberOfLines={1}>{p.name}</Text>
                {selectedProvider?.id === p.id && (
                  <View style={[styles.checkMark, { backgroundColor: p.color }]}>
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Amount */}
          <Text style={styles.sectionLabel}>Monto</Text>
          <View style={styles.amountWrap}>
            <Text style={styles.amountPrefix}>$</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={C.textDim}
            />
          </View>

          {/* Account Number */}
          <Text style={styles.sectionLabel}>No. de Cuenta (Opcional)</Text>
          <TextInput
            style={styles.input}
            value={account}
            onChangeText={setAccount}
            placeholder="Número de cuenta"
            placeholderTextColor={C.textDim}
          />

          {/* Period */}
          <Text style={styles.sectionLabel}>Período</Text>
          <TextInput
            style={styles.input}
            value={period}
            onChangeText={setPeriod}
            placeholder="YYYY-MM"
            placeholderTextColor={C.textDim}
          />

          {/* Due Date */}
          <Text style={styles.sectionLabel}>Fecha de Vencimiento (Opcional)</Text>
          <TextInput
            style={styles.input}
            value={dueDate}
            onChangeText={setDueDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={C.textDim}
          />

          {/* Notes */}
          <Text style={styles.sectionLabel}>Notas (Opcional)</Text>
          <TextInput
            style={[styles.input, { height: 70, textAlignVertical: 'top', paddingTop: 12 }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Agrega una nota..."
            placeholderTextColor={C.textDim}
            multiline
          />

          {/* Paid Toggle */}
          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() => setPaid(!paid)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={paid ? 'checkmark-circle' : 'ellipse-outline'}
              size={24}
              color={paid ? C.success : C.textMuted}
            />
            <Text style={styles.toggleText}>Marcar como pagado</Text>
          </TouchableOpacity>

          {/* Save Button */}
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={saving || !selectedProvider || !amount}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={[C.brandRed, '#9B1B30']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="save" size={20} color="#fff" />
                <Text style={styles.saveBtnText}>Guardar Registro</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 80 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.base },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.background },
  bgGlow1: {
    position: 'absolute', top: -60, right: -40,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: C.brandRed, opacity: 0.05,
  },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.base,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: C.glassLight,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: C.textPrimary },

  sectionLabel: {
    fontSize: FontSizes.xs, color: C.textMuted, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginTop: 20, marginBottom: 10,
  },

  providerGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  providerItem: {
    width: '31%', alignItems: 'center', paddingVertical: 14,
    backgroundColor: C.glass,
    borderRadius: BorderRadius.card,
    borderWidth: 1, borderColor: C.glassBorder,
    position: 'relative',
  },
  providerIcon: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  providerName: { fontSize: 10, color: C.textSecondary, fontWeight: '600', textAlign: 'center', paddingHorizontal: 4 },
  checkMark: {
    position: 'absolute', top: 6, right: 6,
    width: 20, height: 20, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },

  amountWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.glass,
    borderRadius: 14, borderWidth: 1,
    borderColor: C.glassBorder,
    paddingHorizontal: 16,
  },
  amountPrefix: { fontSize: 24, fontWeight: '800', color: C.brandRed, marginRight: 4 },
  amountInput: {
    flex: 1, height: 56, fontSize: 24, fontWeight: '700',
    color: C.white,
  },

  input: {
    backgroundColor: C.glass,
    borderRadius: 14, borderWidth: 1,
    borderColor: C.glassBorder,
    paddingHorizontal: 16, height: 50,
    fontSize: FontSizes.base, color: C.white,
  },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 16,
  },
  toggleText: { fontSize: FontSizes.base, color: C.textPrimary, fontWeight: '500' },

  saveBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 10, height: 56, borderRadius: 16, overflow: 'hidden',
    marginTop: 8,
    ...Shadows.button,
  },
  saveBtnText: { color: C.textPrimary, fontWeight: '700', fontSize: FontSizes.md },
});
