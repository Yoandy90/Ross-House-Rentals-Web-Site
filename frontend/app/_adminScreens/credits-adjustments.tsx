import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AdminHeader from '../../components/admin/AdminHeader';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

export default function AdminCreditsAdjustments() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [searchUserId, setSearchUserId] = useState('');
  const [userBalance, setUserBalance] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    user_id: '',
    amount: '',
    reason: '',
    notes: '',
  });

  const searchUser = async () => {
    if (!searchUserId.trim()) {
      Alert.alert('Error', 'Ingresa un User ID');
      return;
    }

    try {
      setProcessing(true);
      const response = await api.get('/credits/balance', {
        headers: {
          'X-User-ID': searchUserId.trim(), // Simular como si fuera ese usuario
        },
      });
      
      setUserBalance(response.data.balance || 0);
      setFormData({ ...formData, user_id: searchUserId.trim() });
      Alert.alert('Usuario Encontrado', `Balance actual: ${response.data.balance.toFixed(0)} créditos`);
    } catch (error: any) {
      console.error('Error searching user:', error);
      Alert.alert('Error', 'No se pudo obtener el balance del usuario');
      setUserBalance(null);
    } finally {
      setProcessing(false);
    }
  };

  const handleAdjustment = async () => {
    // Validation
    if (!formData.user_id.trim()) {
      Alert.alert('Error', 'Busca primero un usuario');
      return;
    }

    if (!formData.amount || parseFloat(formData.amount) === 0) {
      Alert.alert('Error', 'Ingresa un monto válido (positivo para añadir, negativo para deducir)');
      return;
    }

    if (!formData.reason.trim()) {
      Alert.alert('Error', 'Ingresa una razón para el ajuste');
      return;
    }

    const amount = parseFloat(formData.amount);
    const actionText = amount > 0 ? 'añadir' : 'deducir';
    const newBalance = (userBalance || 0) + amount;

    if (newBalance < 0) {
      Alert.alert('Error', `No puedes deducir más créditos de los disponibles. Balance actual: ${userBalance}`);
      return;
    }

    Alert.alert(
      'Confirmar Ajuste',
      `¿Estás seguro de ${actionText} ${Math.abs(amount)} créditos?\n\nUsuario: ${formData.user_id}\nBalance actual: ${userBalance}\nNuevo balance: ${newBalance}\n\nRazón: ${formData.reason}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () => processAdjustment(),
          style: 'default',
        },
      ]
    );
  };

  const processAdjustment = async () => {
    try {
      setProcessing(true);

      const response = await api.post('/admin/credits/adjust', {
        user_id: formData.user_id,
        amount: parseFloat(formData.amount),
        reason: formData.reason.trim(),
        notes: formData.notes.trim() || undefined,
      });

      Alert.alert(
        '¡Ajuste Exitoso!',
        `Balance actualizado correctamente.\n\nBalance anterior: ${response.data.adjustment.previous_balance}\nNuevo balance: ${response.data.adjustment.new_balance}`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Reset form
              setFormData({
                user_id: '',
                amount: '',
                reason: '',
                notes: '',
              });
              setSearchUserId('');
              setUserBalance(null);
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error adjusting balance:', error);
      const errorMsg = error.response?.data?.detail || 'Error al ajustar el balance';
      Alert.alert('Error', errorMsg);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <AdminHeader title="Ajustes de Balance" subtitle="Ajustes manuales de créditos" />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color={colors.info} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Ajustes de Balance</Text>
            <Text style={styles.infoText}>
              Usa esta función para ajustar manualmente el balance de créditos de un usuario.
              {'\n\n'}• Valores positivos: Añaden créditos (bonos, compensaciones){'\n'}
              • Valores negativos: Deducen créditos (ajustes, correcciones){'\n\n'}
              Todos los ajustes quedan registrados con tu ID de admin.
            </Text>
          </View>
        </View>

        {/* Search User */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Buscar Usuario</Text>
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Ingresa User ID del cliente"
              placeholderTextColor={colors.textGray}
              value={searchUserId}
              onChangeText={setSearchUserId}
              editable={!processing}
            />
            <TouchableOpacity
              style={styles.searchButton}
              onPress={searchUser}
              disabled={processing || !searchUserId.trim()}
            >
              {processing ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Ionicons name="search" size={20} color="#FFF" />
                  <Text style={styles.searchButtonText}>Buscar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {userBalance !== null && (
            <View style={styles.balanceCard}>
              <Ionicons name="wallet" size={32} color={colors.primary} />
              <View style={styles.balanceInfo}>
                <Text style={styles.balanceLabel}>Balance Actual:</Text>
                <Text style={styles.balanceValue}>{userBalance.toFixed(0)} créditos</Text>
              </View>
            </View>
          )}
        </View>

        {/* Adjustment Form */}
        {userBalance !== null && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Configurar Ajuste</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Monto del Ajuste: *</Text>
              <Text style={styles.hint}>
                Positivo para añadir, negativo para deducir (ej: 100 o -50)
              </Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                value={formData.amount}
                onChangeText={(text) => setFormData({ ...formData, amount: text })}
                keyboardType="numeric"
                editable={!processing}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Razón: *</Text>
              <Text style={styles.hint}>Explica brevemente por qué haces este ajuste</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder={t('admin.creditAdjustPlaceholder', 'Ej: Compensación por problema técnico')}
                placeholderTextColor={colors.textGray}
                value={formData.reason}
                onChangeText={(text) => setFormData({ ...formData, reason: text })}
                multiline
                numberOfLines={3}
                editable={!processing}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Notas Adicionales:</Text>
              <Text style={styles.hint}>Información extra opcional</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Notas adicionales (opcional)"
                placeholderTextColor={colors.textGray}
                value={formData.notes}
                onChangeText={(text) => setFormData({ ...formData, notes: text })}
                multiline
                numberOfLines={2}
                editable={!processing}
              />
            </View>

            {/* Preview */}
            {formData.amount && parseFloat(formData.amount) !== 0 && (
              <View style={styles.previewCard}>
                <Text style={styles.previewTitle}>Vista Previa:</Text>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Balance actual:</Text>
                  <Text style={styles.previewValue}>{userBalance.toFixed(0)}</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Ajuste:</Text>
                  <Text
                    style={[
                      styles.previewValue,
                      {
                        color:
                          parseFloat(formData.amount) > 0 ? colors.success : colors.error,
                      },
                    ]}
                  >
                    {parseFloat(formData.amount) > 0 ? '+' : ''}
                    {parseFloat(formData.amount).toFixed(0)}
                  </Text>
                </View>
                <View style={[styles.previewRow, styles.previewRowTotal]}>
                  <Text style={styles.previewLabelTotal}>Nuevo balance:</Text>
                  <Text style={styles.previewValueTotal}>
                    {(userBalance + parseFloat(formData.amount)).toFixed(0)}
                  </Text>
                </View>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!formData.amount || !formData.reason || processing) &&
                  styles.submitButtonDisabled,
              ]}
              onPress={handleAdjustment}
              disabled={!formData.amount || !formData.reason || processing}
            >
              {processing ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={24} color="#FFF" />
                  <Text style={styles.submitButtonText}>Aplicar Ajuste</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  layout: {
    flex: 1,
    flexDirection: 'row',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: colors.info + '10',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 24,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: colors.text,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
  },
  searchButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 12,
    marginTop: 16,
    gap: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  balanceInfo: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: 14,
    color: colors.textGray,
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  hint: {
    fontSize: 13,
    color: colors.textGray,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: colors.text,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  previewCard: {
    backgroundColor: colors.primary + '10',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  previewRowTotal: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  previewLabel: {
    fontSize: 14,
    color: colors.textGray,
  },
  previewValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  previewLabelTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  previewValueTotal: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
  },
  submitButtonDisabled: {
    backgroundColor: colors.textGray,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});