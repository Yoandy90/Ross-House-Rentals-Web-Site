import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking, TextInput, ActivityIndicator, Switch, Image, ActionSheetIOS, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, Gradients, API_URL } from '../../src/constants/theme';
import { router } from 'expo-router';
import { useBiometricAuth } from '../../src/hooks/useBiometricAuth';
import NMLSFooter from '../../src/components/NMLSFooter';
import * as ImagePicker from 'expo-image-picker';

type IoniconsName = keyof typeof Ionicons.glyphMap;

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { user, logout, token } = useAuth();
  const biometric = useBiometricAuth();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [uploadingPic, setUploadingPic] = useState(false);

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }), [token]);

  // Load profile picture on mount
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/users/profile-picture`, { headers: headers() });
        if (res.ok) {
          const data = await res.json();
          if (data.profile_picture) setProfilePic(data.profile_picture);
        }
      } catch (e) { console.log('Error loading profile pic:', e); }
    })();
  }, [token]);

  const pickImage = async (source: 'camera' | 'gallery') => {
    let result;
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { Alert.alert(t('profile.permissionRequired'), t('common.needCameraAccess', 'We need camera access.')); return; }
      result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true });
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert(t('profile.permissionRequired'), t('common.needGalleryAccess', 'We need gallery access.')); return; }
      result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true });
    }
    if (result.canceled || !result.assets?.[0]?.base64) return;

    const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
    setUploadingPic(true);
    try {
      const res = await fetch(`${API_URL}/api/users/profile-picture`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ profile_picture: base64 }),
      });
      if (res.ok) {
        setProfilePic(base64);
      } else {
        Alert.alert('Error', t('profile.couldNotUpload'));
      }
    } catch (e) { Alert.alert('Error', t('common.connectionError', 'Connection error')); }
    setUploadingPic(false);
  };

  const deleteProfilePic = async () => {
    setUploadingPic(true);
    try {
      const res = await fetch(`${API_URL}/api/users/profile-picture`, {
        method: 'DELETE',
        headers: headers(),
      });
      if (res.ok) setProfilePic(null);
    } catch (e) { console.log('Error deleting pic:', e); }
    setUploadingPic(false);
  };

  const showPhotoOptions = () => {
    const options = [
      t('profile.takePhoto', '📷 Tomar Foto'),
      t('profile.chooseGallery', '🖼️ Elegir de Galería'),
      ...(profilePic ? [t('profile.removePhoto', '🗑️ Eliminar Foto')] : []),
      t('common.cancel', 'Cancelar'),
    ];
    const cancelIndex = options.length - 1;
    const destructiveIndex = profilePic ? options.length - 2 : -1;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIndex, destructiveButtonIndex: destructiveIndex },
        (idx) => {
          if (idx === 0) pickImage('camera');
          else if (idx === 1) pickImage('gallery');
          else if (profilePic && idx === 2) deleteProfilePic();
        }
      );
    } else {
      Alert.alert(t('profile.changePhoto', 'Cambiar Foto'), '', [
        { text: t('profile.takePhoto', '📷 Tomar Foto'), onPress: () => pickImage('camera') },
        { text: t('profile.chooseGallery', '🖼️ Elegir de Galería'), onPress: () => pickImage('gallery') },
        ...(profilePic ? [{ text: t('profile.removePhoto', '🗑️ Eliminar Foto'), style: 'destructive' as const, onPress: deleteProfilePic }] : []),
        { text: t('common.cancel', 'Cancelar'), style: 'cancel' as const },
      ]);
    }
  };

  const handleLogout = () => {
    Alert.alert(t('profile.logout'), t('profile.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.exit'), style: 'destructive', onPress: async () => { await logout(); router.replace('/(auth)/login'); } },
    ]);
  };

  const handleDeleteAccount = () => {
    setShowDeleteModal(true);
    setDeleteConfirmText('');
  };

  const confirmDeleteAccount = async () => {
    if (deleteConfirmText !== 'ELIMINAR') return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/delete-account`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        setShowDeleteModal(false);
        Alert.alert(
          t('profile.accountDeleted', 'Account Deleted'),
          t('profile.accountDeletedMsg', 'Your account and all your data have been permanently deleted.'),
          [{ text: 'OK', onPress: async () => { await logout(); router.replace('/(auth)/login'); } }]
        );
      } else {
        const err = await res.json();
        Alert.alert('Error', err.detail || t('profile.couldNotDeleteAccount'));
      }
    } catch {
      Alert.alert(t('common.error', 'Error'), t('common.connectionError'));
    }
    setDeleting(false);
  };

  const callOffice = () => Linking.openURL('tel:+18069342018');
  const emailOffice = () => Linking.openURL('mailto:info@rosslending.com');
  const openMaps = () => Linking.openURL('https://maps.google.com/?q=305+Bruce+Ave+Dumas+TX');

  const userName = user?.name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || t('profile.user');
  const displayPhone = user?.phone ? (user.phone.startsWith('+1') ? user.phone : `+1 ${user.phone}`) : '';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <TouchableOpacity onPress={showPhotoOptions} activeOpacity={0.8} style={styles.avatarContainer}>
            {profilePic ? (
              <Image source={{ uri: profilePic }} style={styles.avatarImage} />
            ) : (
              <LinearGradient colors={Gradients.primary} style={styles.avatar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Text style={styles.avatarText}>
                  {userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </Text>
              </LinearGradient>
            )}
            {/* Camera badge */}
            <View style={styles.cameraBadge}>
              {uploadingPic ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={14} color="#fff" />
              )}
            </View>
          </TouchableOpacity>
          <Text style={styles.userName}>{userName}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          {user?.phone && <Text style={styles.userPhone}>{displayPhone}</Text>}
        </View>

        {/* Admin Dashboard — Only for admin users */}
        {user?.role === 'admin' && (
          <TouchableOpacity 
            style={styles.adminDashboardBtn} 
            onPress={() => router.push('/(admin)/dashboard')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#059669', '#047857']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.adminDashboardGradient}
            >
              <View style={styles.adminDashboardIcon}>
                <Ionicons name="stats-chart" size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.adminDashboardTitle}>Admin Dashboard</Text>
                <Text style={styles.adminDashboardSub}>KPIs, Reportes, Alertas</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Mi Cuenta */}
        <View style={styles.menuSection}>
          <Text style={styles.menuTitle}>{t('profile.myAccount')}</Text>
          <MenuItem icon="person-outline" label={t('profile.personalData')} onPress={() => router.push('/profile/personal-data')} />
          <MenuItem icon="notifications-outline" label={t('profile.notifications')} onPress={() => router.push('/profile/notifications')} />
          <MenuItem icon="lock-closed-outline" label={t('profile.changePassword')} onPress={() => router.push('/profile/change-password')} />
          {biometric.isAvailable && (
            <View style={styles.menuItem}>
              <View style={styles.menuIconWrap}>
                <Ionicons name={biometric.biometricType === 'face' ? 'scan-outline' : 'finger-print-outline'} size={20} color={Colors.primaryLight} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuLabel}>{biometric.biometricType === 'face' ? 'Face ID' : 'Touch ID'}</Text>
                <Text style={styles.menuSub}>
                  {biometric.isEnabled ? t('profile.biometricEnabled') : t('profile.biometricDisabled')}
                </Text>
              </View>
              <Switch
                value={biometric.isEnabled}
                onValueChange={async (val) => {
                  if (val) {
                    const email = user?.email || '';
                    const sessionToken = token || '';
                    const ok = await biometric.promptAndEnable(email, sessionToken);
                    if (ok) {
                      Alert.alert(
                        t('common.success'),
                        t('profile.biometricConfigured', { type: biometric.biometricType === 'face' ? 'Face ID' : 'Touch ID' })
                      );
                    } else {
                      Alert.alert(t('common.error', 'Error'), t('profile.biometricError', 'Could not enable biometric access.'));
                    }
                  } else {
                    await biometric.disable();
                    Alert.alert(
                      t('profile.biometricDeactivated'),
                      t('profile.biometricDeactivatedMsg', { type: biometric.biometricType === 'face' ? 'Face ID' : 'Touch ID' })
                    );
                  }
                }}
                trackColor={{ false: '#374151', true: 'rgba(52,211,153,0.3)' }}
                thumbColor={biometric.isEnabled ? '#34D399' : '#9CA3AF'}
              />
            </View>
          )}
        </View>

        {/* Pagos y Finanzas */}
        <View style={styles.menuSection}>
          <Text style={styles.menuTitle}>{t('profile.paymentsFinance')}</Text>
          <MenuItem icon="document-text-outline" label={t('profile.loanHistory')} onPress={() => router.push('/profile/loan-history')} />
          <MenuItem icon="card-outline" label={t('profile.paymentMethods')} onPress={() => router.push('/profile/payment-methods')} />
          <MenuItem icon="calculator-outline" label={t('profile.calculator')} onPress={() => router.push('/profile/calculator')} />
          <MenuItem icon="cloud-upload-outline" label={t('profile.myDocuments')} sub={t('profile.myDocumentsSub')} onPress={() => router.push('/profile/documents')} />
        </View>

        {/* Soporte */}
        <View style={styles.menuSection}>
          <Text style={styles.menuTitle}>{t('profile.support')}</Text>
          <MenuItem icon="call-outline" label={t('profile.callOffice')} sub="(806) 934-2018" onPress={callOffice} />
          <MenuItem icon="mail-outline" label={t('profile.sendEmail')} sub="info@rosslending.com" onPress={emailOffice} />
          <MenuItem icon="location-outline" label={t('profile.address')} sub="305 Bruce Ave, Dumas, TX" onPress={openMaps} />
        </View>

        {/* Documents */}
        <View style={styles.menuSection}>
          <Text style={styles.menuTitle}>{t('profile.documents', 'DOCUMENTS')}</Text>
          <MenuItem icon="sync-circle-outline" label={t('profile.achAgreements', 'ACH & Auto-Pay Agreements')} onPress={() => router.push('/profile/ach-agreements')} />
          <MenuItem icon="alert-circle-outline" label={t('profile.legalNotices', 'Legal Notices')} onPress={() => router.push('/profile/license')} />
        </View>

        {/* Policies, Terms & Disclosures */}
        <View style={styles.menuSection}>
          <Text style={styles.menuTitle}>{t('profile.policiesTerms', 'POLICIES, TERMS & DISCLOSURES')}</Text>
          <MenuItem icon="document-text-outline" label={t('profile.terms')} onPress={() => router.push('/profile/terms')} />
          <MenuItem icon="shield-checkmark-outline" label={t('profile.privacy')} onPress={() => router.push('/profile/privacy')} />
          <MenuItem icon="create-outline" label={t('profile.esignDisclosure', 'E-Sign Disclosure')} onPress={() => router.push('/profile/esign-disclosure')} />
          <MenuItem icon="flag-outline" label={t('profile.stateDisclosures', 'State Disclosures')} onPress={() => router.push('/profile/state-disclosures')} />
          <MenuItem icon="language-outline" label={t('profile.language')} onPress={() => router.push('/profile/language')} />
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <Text style={styles.logoutText}>{t('profile.logout')}</Text>
        </TouchableOpacity>

        {/* Delete Account */}
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={18} color="#9CA3AF" />
          <Text style={styles.deleteText}>{t('profile.deleteAccount')}</Text>
        </TouchableOpacity>

        {/* App Info with NMLS Footer */}
        <NMLSFooter compact />
      </ScrollView>

      {/* Delete Account Overlay — no Modal (crash-safe) */}
      {showDeleteModal && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalIconWrap}>
                <Ionicons name="warning" size={36} color="#EF4444" />
              </View>
              <Text style={styles.modalTitle}>{t('profile.deleteAccount')}</Text>
              <Text style={styles.modalDesc}>
                {t('profile.deleteWarning')}{'\n\n'}
                • {t('profile.deleteItem1')}{'\n'}
                • {t('profile.deleteItem2')}{'\n'}
                • {t('profile.deleteItem3')}{'\n'}
                • {t('profile.deleteItem4')}
              </Text>
              <Text style={styles.modalConfirmLabel}>{t('profile.deleteConfirmLabel')}</Text>
              <TextInput
                style={styles.modalInput}
                value={deleteConfirmText}
                onChangeText={setDeleteConfirmText}
                placeholder={t('profile.deleteConfirmWord')}
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="characters"
              />
              <View style={styles.modalBtnRow}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowDeleteModal(false)}>
                  <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalDeleteBtn, deleteConfirmText !== t('profile.deleteConfirmWord') && { opacity: 0.4 }]}
                  onPress={confirmDeleteAccount}
                  disabled={deleteConfirmText !== t('profile.deleteConfirmWord') || deleting}
                >
                  {deleting ? <ActivityIndicator color="#fff" size="small" /> : (
                    <Text style={styles.modalDeleteText}>{t('profile.deleteAccount')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      )}

    </SafeAreaView>
  );
}

function MenuItem({ icon, label, sub, onPress }: { icon: IoniconsName; label: string; sub?: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.menuIconWrap}>
        <Ionicons name={icon} size={20} color={Colors.primaryLight} />
      </View>
      <View style={styles.menuContent}>
        <Text style={styles.menuLabel}>{label}</Text>
        {sub && <Text style={styles.menuSub}>{sub}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textDim} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  profileHeader: { alignItems: 'center', marginBottom: 32, paddingTop: 10 },
  avatar: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  avatarContainer: { position: 'relative' as const, marginBottom: 12 },
  avatarImage: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)' },
  cameraBadge: {
    position: 'absolute' as const, bottom: 0, right: -4,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#059669',
    justifyContent: 'center' as const, alignItems: 'center' as const,
    borderWidth: 2, borderColor: Colors.bg,
  },
  avatarText: { fontSize: 28, fontWeight: '800' as const, color: Colors.white },
  userName: { fontSize: 20, fontWeight: '800', color: Colors.text },
  userEmail: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  userPhone: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  menuSection: { marginBottom: 24 },
  menuTitle: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.5, marginBottom: 10, marginLeft: 4 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card,
    borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border,
  },
  menuIconWrap: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(5, 150, 105, 0.1)',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  menuContent: { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: '600', color: Colors.text },
  menuSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(239,68,68,0.06)', borderRadius: 14, paddingVertical: 16,
    marginTop: 8, borderWidth: 1, borderColor: 'rgba(239,68,68,0.15)',
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: Colors.error },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, marginTop: 12,
  },
  deleteText: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
  // Delete Modal
  modalOverlay: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)', padding: 24,
  },
  modalContent: {
    backgroundColor: Colors.card, borderRadius: 20, padding: 28,
    width: '100%', maxWidth: 380, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
  },
  modalIconWrap: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(239,68,68,0.1)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#EF4444', marginBottom: 12 },
  modalDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20, textAlign: 'center', marginBottom: 20 },
  modalConfirmLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginBottom: 8, alignSelf: 'flex-start' },
  modalInput: {
    width: '100%', backgroundColor: Colors.surface, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16,
    borderWidth: 1.5, borderColor: 'rgba(239,68,68,0.2)', color: Colors.text,
    textAlign: 'center', fontWeight: '700', letterSpacing: 3, marginBottom: 20,
  },
  modalBtnRow: { flexDirection: 'row', gap: 12, width: '100%' },
  modalCancelBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: Colors.textMuted },
  modalDeleteBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#EF4444',
  },
  modalDeleteText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  appInfo: { alignItems: 'center', marginTop: 32 },
  appInfoText: { fontSize: 11, color: Colors.textMuted },
  appInfoVersion: { fontSize: 10, color: Colors.textDim, marginTop: 4, marginBottom: 4 },
  // Admin Dashboard Button
  adminDashboardBtn: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  adminDashboardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  adminDashboardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminDashboardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  adminDashboardSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
    fontWeight: '500',
  },
});
