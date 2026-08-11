import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
  TextInput,
  Modal,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, FontSizes, BorderRadius, Shadows, useColors } from '../../src/constants/theme';
import { Config } from '../../src/constants/config';
import { apiCall } from '../../src/utils/api';
import ThemeSelector from '../../src/components/ThemeSelector';

export default function ProfileScreen() {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  const { t, i18n } = useTranslation();
  const { tenant, user, logout, viewAsTenant, toggleViewAsTenant } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const isTenant = (user?.role || tenant?.role) === 'tenant';
  const displayUser = user || tenant;
  const deleteKeyword = i18n.language === 'es' ? 'ELIMINAR' : 'DELETE';

  const handleLogout = () => {
    Alert.alert(
      t('auth.logout'),
      '',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('auth.logout'),
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== deleteKeyword) return;

    setDeleting(true);
    try {
      await apiCall('/marketplace/delete-account', { method: 'DELETE' });
      setDeleteModalVisible(false);
      Alert.alert(
        '✅',
        i18n.language === 'es'
          ? 'Tu cuenta ha sido eliminada exitosamente.'
          : 'Your account has been successfully deleted.',
        [
          {
            text: 'OK',
            onPress: async () => {
              await logout();
              router.replace('/(auth)/login');
            },
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Error eliminando cuenta');
    } finally {
      setDeleting(false);
    }
  };

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'es' ? 'en' : 'es');
  };

  const handleToggleView = () => {
    const goingToTenant = !viewAsTenant;
    toggleViewAsTenant();
    router.replace(goingToTenant ? '/(tabs)' : '/(tabs)/dashboard');
  };

  const MenuItem = ({ icon, label, value, onPress, color = C.textPrimary, iconBg }: any) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.menuLeft}>
        {iconBg ? (
          <View style={[styles.menuIconBg, { backgroundColor: iconBg }]}>
            <Ionicons name={icon} size={16} color={color} />
          </View>
        ) : (
          <Ionicons name={icon} size={20} color={color} />
        )}
        <Text style={[styles.menuLabel, { color: color === C.textPrimary ? C.textPrimary : color }]}>{label}</Text>
      </View>
      {value ? (
        <Text style={styles.menuValue}>{value}</Text>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
      )}
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>{t('profile.title')}</Text>

      {/* User Info */}
      <Card accentColor={C.brandRed} style={styles.userCard}>
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <LinearGradient
              colors={['#C8102E', '#9B1B30']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.avatarText}>
              {(displayUser?.name || 'U')[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{displayUser?.name || 'Usuario'}</Text>
            <Text style={styles.userEmail}>{displayUser?.email || ''}</Text>
            {(displayUser?.role) && (
              <View style={styles.tenantBadge}>
                <Text style={styles.tenantBadgeText}>
                  {displayUser.role === 'admin' ? '🛡️ Administrador' :
                   displayUser.role === 'tenant' ? '🏠 Inquilino' :
                   displayUser.role === 'landlord' ? '🏢 Propietario' :
                   displayUser.role === 'guest' ? '👋 Invitado' :
                   displayUser.role === 'buyer' ? '🔑 Comprador' :
                   '👤 Usuario'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Card>

      {/* Admin: switch between Admin / Tenant view */}
      {user?.role === 'admin' && (
        <>
          <Text style={styles.sectionTitle}>Modo de vista</Text>
          <View style={styles.menuGroup}>
            <MenuItem
              icon={viewAsTenant ? 'shield-checkmark-outline' : 'eye-outline'}
              label={viewAsTenant ? 'Volver a vista Admin' : 'Ver como inquilino'}
              onPress={handleToggleView}
              iconBg="rgba(59,130,246,0.10)"
              color="#3B82F6"
            />
          </View>
        </>
      )}

      {/* Account Section */}
      <Text style={styles.sectionTitle}>{t('profile.account')}</Text>
      <View style={styles.menuGroup}>
        <MenuItem
          icon="person-outline"
          label={t('profile.edit_profile')}
          onPress={() => router.push('/edit-profile')}
          iconBg="rgba(200,16,46,0.10)"
          color={C.brandRed}
        />
        <MenuItem
          icon="lock-closed-outline"
          label={t('profile.change_password')}
          onPress={() => router.push('/change-password')}
          iconBg="rgba(200,16,46,0.10)"
          color={C.brandRed}
        />
        <MenuItem
          icon="card-outline"
          label={t('profile.payment_methods')}
          onPress={() => router.push('/payment-methods')}
          iconBg="rgba(200,16,46,0.10)"
          color={C.brandRed}
        />
        <MenuItem
          icon="flash-outline"
          label="Mis Servicios"
          onPress={() => router.push('/services')}
          iconBg="rgba(225,29,72,0.10)"
          color="#E11D48"
        />
        <MenuItem
          icon="document-text-outline"
          label="Mis Contratos"
          onPress={() => router.push('/contracts')}
          iconBg="rgba(99,91,255,0.10)"
          color="#635BFF"
        />
        <MenuItem
          icon="receipt-outline"
          label="Historial de Pagos"
          onPress={() => router.push('/invoices')}
          iconBg="rgba(16,185,129,0.10)"
          color="#10B981"
        />
      </View>

      {/* Theme selector */}
      <Text style={styles.sectionTitle}>Apariencia</Text>
      <View style={styles.themeGroup}>
        <ThemeSelector variant="list" />
      </View>

      {/* Language */}
      <Text style={styles.sectionTitle}>{t('profile.language')}</Text>
      <View style={styles.menuGroup}>
        <MenuItem
          icon="globe-outline"
          label={t('profile.language')}
          value={i18n.language === 'es' ? t('profile.spanish') : t('profile.english')}
          onPress={toggleLanguage}
        />
      </View>

      {/* Support */}
      <Text style={styles.sectionTitle}>{t('profile.support')}</Text>
      <View style={styles.menuGroup}>
        <MenuItem
          icon="call-outline"
          label={t('profile.call_us')}
          value={Config.SUPPORT_PHONE}
          onPress={() => Linking.openURL(`tel:${Config.SUPPORT_PHONE.replace(/[^0-9]/g, '')}`)}
        />
        <MenuItem
          icon="mail-outline"
          label={t('profile.email_us')}
          onPress={() => Linking.openURL(`mailto:${Config.SUPPORT_EMAIL}`)}
        />
        <MenuItem
          icon="help-circle-outline"
          label={t('profile.faq')}
          onPress={() => router.push('/faq')}
        />
      </View>

      {/* About */}
      <Text style={styles.sectionTitle}>{t('profile.about')}</Text>
      <View style={styles.menuGroup}>
        <MenuItem
          icon="information-circle-outline"
          label={t('profile.version')}
          value={Config.APP_VERSION}
        />
        <MenuItem
          icon="document-text-outline"
          label={t('profile.terms')}
          onPress={() => router.push('/legal/terms')}
        />
        <MenuItem
          icon="shield-checkmark-outline"
          label={t('profile.privacy')}
          onPress={() => router.push('/legal/privacy')}
        />
      </View>

      {/* Logout */}
      <View style={styles.logoutContainer}>
        <Button
          title={t('auth.logout')}
          onPress={handleLogout}
          variant="outline"
          fullWidth
          icon={<Ionicons name="log-out-outline" size={18} color={C.brandRed} />}
        />
      </View>

      {/* Danger Zone */}
      <Text style={[styles.sectionTitle, { color: '#EF4444' }]}>{t('profile.danger_zone')}</Text>
      <View style={[styles.menuGroup, styles.dangerGroup]}>
        <MenuItem
          icon="trash-outline"
          label={t('profile.delete_account')}
          onPress={() => setDeleteModalVisible(true)}
          color="#EF4444"
        />
      </View>

      {/* Branding */}
      <View style={styles.branding}>
        <Image
          source={C.background === '#F8FAFC' ? require('../../assets/images/ross_house_logo.png') : require('../../assets/images/ross_house_logo_white.png')}
          style={styles.companyLogo}
          resizeMode="contain"
        />
        <Text style={styles.brandTagline}>{t('app.tagline')}</Text>
      </View>

      <View style={{ height: 40 }} />

      {/* Delete Account Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="warning" size={40} color="#EF4444" />
            </View>
            <Text style={styles.modalTitle}>{t('profile.delete_account_title')}</Text>
            <Text style={styles.modalDesc}>{t('profile.delete_account_warning')}</Text>

            <Text style={styles.modalInputLabel}>
              {t('profile.type_delete').replace('DELETE', deleteKeyword).replace('ELIMINAR', deleteKeyword)}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder={deleteKeyword}
              placeholderTextColor={C.textDim}
              autoCapitalize="characters"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setDeleteModalVisible(false); setDeleteConfirmText(''); }}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalDeleteBtn,
                  deleteConfirmText !== deleteKeyword && styles.modalDeleteBtnDisabled,
                ]}
                onPress={handleDeleteAccount}
                disabled={deleteConfirmText !== deleteKeyword || deleting}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.modalDeleteText}>{t('common.delete')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: Spacing.base, paddingBottom: 100 },
  title: { fontSize: FontSizes['2xl'], fontWeight: '800', color: C.textPrimary, paddingVertical: Spacing.md, letterSpacing: -0.5 },
  userCard: { marginBottom: Spacing.lg },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: {
    width: 56, height: 56, borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: FontSizes.xl, fontWeight: '700', color: C.white },
  userInfo: { flex: 1 },
  userName: { fontSize: FontSizes.lg, fontWeight: '700', color: C.textPrimary },
  userEmail: { fontSize: FontSizes.sm, color: C.textMuted, marginTop: 2 },
  tenantBadge: {
    backgroundColor: 'rgba(200,16,46,0.10)',
    paddingVertical: 3, paddingHorizontal: 10, borderRadius: BorderRadius.full,
    alignSelf: 'flex-start', marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(200,16,46,0.15)',
  },
  tenantBadgeText: { fontSize: FontSizes.xs, color: C.brandRed, fontWeight: '600' },
  sectionTitle: {
    fontSize: FontSizes.xs, color: C.textMuted, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: Spacing.sm, marginTop: Spacing.base,
  },
  menuGroup: {
    backgroundColor: C.glass, borderRadius: BorderRadius.card,
    borderWidth: 1, borderColor: C.glassBorder, overflow: 'hidden',
  },
  themeGroup: {
    paddingVertical: 4,
  },
  menuItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: Spacing.base,
    borderBottomWidth: 1, borderBottomColor: C.glassBorder,
  },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuLabel: { fontSize: FontSizes.base, fontWeight: '500' },
  menuValue: { fontSize: FontSizes.sm, color: C.textMuted },
  logoutContainer: { marginTop: Spacing['2xl'] },
  dangerGroup: { borderColor: 'rgba(239,68,68,0.15)' },
  branding: { alignItems: 'center', marginTop: Spacing['2xl'], opacity: 0.7 },
  companyLogo: { width: 180, height: 60 },
  brandTagline: { fontSize: FontSizes.xs, color: C.textMuted, fontStyle: 'italic', marginTop: 8 },
  menuIconBg: {
    width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
  },

  // Delete Account Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center', alignItems: 'center', padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: '#1A1A1E', borderRadius: BorderRadius.card,
    padding: Spacing['2xl'], width: '100%', maxWidth: 360,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.15)',
  },
  modalIconWrap: { alignItems: 'center', marginBottom: Spacing.base },
  modalTitle: {
    fontSize: FontSizes.xl, fontWeight: '800', color: '#EF4444',
    textAlign: 'center', marginBottom: Spacing.sm,
  },
  modalDesc: {
    fontSize: FontSizes.sm, color: C.textSecondary,
    textAlign: 'center', lineHeight: 20, marginBottom: Spacing.lg,
  },
  modalInputLabel: {
    fontSize: FontSizes.xs, color: C.textMuted, fontWeight: '600',
    marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  modalInput: {
    backgroundColor: C.glassLight, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: C.glassBorderLight,
    padding: 14, color: C.white, fontSize: FontSizes.base,
    fontWeight: '700', letterSpacing: 2, textAlign: 'center', marginBottom: Spacing.lg,
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: BorderRadius.md,
    backgroundColor: C.glassLight, alignItems: 'center',
    borderWidth: 1, borderColor: C.glassBorder,
  },
  modalCancelText: { fontSize: FontSizes.base, color: C.textSecondary, fontWeight: '600' },
  modalDeleteBtn: {
    flex: 1, paddingVertical: 14, borderRadius: BorderRadius.md,
    backgroundColor: '#EF4444', alignItems: 'center',
  },
  modalDeleteBtnDisabled: { opacity: 0.3 },
  modalDeleteText: { fontSize: FontSizes.base, color: C.white, fontWeight: '700' },
});
