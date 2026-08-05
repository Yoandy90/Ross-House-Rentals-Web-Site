import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import { CustomInput } from '../../components/CustomInput';
import { CustomButton } from '../../components/CustomButton';
import api from '../../services/api';
import { useRouter } from 'expo-router';
import CustomHeader from '../../components/CustomHeader';
import { useTranslation } from 'react-i18next';

export default function ChangePassword() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    // Validations
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert(t('common.error'), t('changePassword.fillAll'));
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert(t('common.error'), t('changePassword.passwordsDontMatch'));
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (newPassword === currentPassword) {
      Alert.alert('Error', 'La nueva contraseña debe ser diferente a la actual');
      return;
    }

    setLoading(true);
    try {
      await api.put('/users/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      
      Alert.alert(
        t('common.success'),
        t('changePassword.success'),
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error changing password:', error);
      Alert.alert(
        t('common.error'),
        error.response?.data?.detail || t('changePassword.error')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <CustomHeader 
        title={t('changePassword.title')}
        showBackButton={true}
        backRoute="/(tabs)/profile"
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Form */}
        <View style={styles.form}>
          <CustomInput
            label={t('changePassword.currentPassword') + ' *'}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder={t('changePassword.currentPassword')}
            isPassword
            autoCapitalize="none"
          />

          <CustomInput
            label={t('changePassword.newPassword') + ' *'}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder={t('changePassword.minLength')}
            isPassword
            autoCapitalize="none"
          />

          <CustomInput
            label={t('changePassword.confirmPassword') + ' *'}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder={t('changePassword.confirmPassword')}
            isPassword
            autoCapitalize="none"
          />

          <CustomButton
            title={t('changePassword.changeButton')}
            onPress={handleChangePassword}
            loading={loading}
            style={styles.submitButton}
          />
        </View>

        {/* Security Tips */}
        <View style={styles.tipsCard}>
          <View style={styles.tipsHeader}>
            <Ionicons name="bulb" size={20} color={colors.warning} />
            <Text style={styles.tipsTitle}>Consejos de Seguridad</Text>
          </View>
          <View style={styles.tipsList}>
            <View style={styles.tipItem}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.tipText}>Usa al menos 8 caracteres</Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.tipText}>Combina letras, números y símbolos</Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.tipText}>No uses información personal obvia</Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.tipText}>Usa una contraseña única para cada cuenta</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textGray,
    textAlign: 'center',
  },
  form: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  submitButton: {
    marginTop: 8,
  },
  tipsCard: {
    backgroundColor: colors.warning + '15',
    borderRadius: 12,
    padding: 16,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.warning,
  },
  tipsList: {
    gap: 8,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
});