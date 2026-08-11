import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Spacing, FontSizes, BorderRadius, useColors } from '../src/constants/theme';
import { apiCall } from '../src/utils/api';
import { useAuth } from '../src/contexts/AuthContext';

export default function EditProfileScreen() {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, tenant } = useAuth();

  const displayUser = user || tenant;

  const [name, setName] = useState(displayUser?.name || '');
  const [email, setEmail] = useState(displayUser?.email || '');
  const [phone, setPhone] = useState(displayUser?.phone || '');
  const [companyName, setCompanyName] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [memberSince, setMemberSince] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await apiCall('/marketplace/me');
      if (data.success && data.user) {
        setName(data.user.name || '');
        setEmail(data.user.email || '');
        // Clean phone number - remove country code if present
        const rawPhone = data.user.phone || '';
        setPhone(cleanPhoneNumber(rawPhone));
        setCompanyName(data.user.company_name || '');
        setEmergencyContact(data.user.emergency_contact || '');
        setEmergencyPhone(cleanPhoneNumber(data.user.emergency_phone || ''));
        setProfilePhoto(data.user.profile_photo_url || null);
        if (data.user.created_at) {
          setMemberSince(formatDate(data.user.created_at));
        }
      }
    } catch (err: any) {
      console.log('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  };

  // Clean phone number - remove country code (1) if present
  const cleanPhoneNumber = (phoneStr: string): string => {
    let digits = phoneStr.replace(/\D/g, '');
    // If it starts with 1 and has 11 digits, remove the 1
    if (digits.length === 11 && digits.startsWith('1')) {
      digits = digits.slice(1);
    }
    return digits;
  };

  // Format date for display
  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-MX', { 
        month: 'long', 
        year: 'numeric' 
      });
    } catch {
      return '';
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para subir una foto de perfil.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0]?.base64) {
      uploadPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu cámara para tomar una foto de perfil.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0]?.base64) {
      uploadPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const uploadPhoto = async (imageData: string) => {
    setUploadingPhoto(true);
    try {
      const data = await apiCall('/marketplace/profile-photo', {
        method: 'POST',
        body: { image_data: imageData, content_type: 'image/jpeg' },
      });
      if (data.success && data.profile_photo_url) {
        setProfilePhoto(data.profile_photo_url);
        Alert.alert('✅', 'Foto de perfil actualizada');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo subir la foto');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const showPhotoOptions = () => {
    Alert.alert(
      'Foto de Perfil',
      'Elige una opción',
      [
        { text: 'Tomar Foto', onPress: takePhoto },
        { text: 'Elegir de Galería', onPress: pickImage },
        ...(profilePhoto ? [{ text: 'Quitar Foto', style: 'destructive' as const, onPress: () => setProfilePhoto(null) }] : []),
        { text: 'Cancelar', style: 'cancel' as const },
      ]
    );
  };

  // Format phone for display: (806) 693-0745
  const formatPhone = (text: string): string => {
    const digits = text.replace(/\D/g, '');
    if (digits.length === 0) return '';
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handlePhoneChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 10);
    setPhone(digits);
  };

  const handleEmergencyPhoneChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 10);
    setEmergencyPhone(digits);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', t('edit_profile.name_required'));
      return;
    }
    if (!email.trim()) {
      Alert.alert('Error', t('edit_profile.email_required'));
      return;
    }

    setSaving(true);
    try {
      const body: any = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.replace(/\D/g, ''),
      };
      if (companyName.trim()) {
        body.company_name = companyName.trim();
      }
      if (emergencyContact.trim()) {
        body.emergency_contact = emergencyContact.trim();
      }
      if (emergencyPhone) {
        body.emergency_phone = emergencyPhone.replace(/\D/g, '');
      }

      const data = await apiCall('/marketplace/me', {
        method: 'PUT',
        body,
      });

      if (data.success) {
        Alert.alert('✅', t('edit_profile.saved'), [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || t('edit_profile.save_error'));
    } finally {
      setSaving(false);
    }
  };

  const isTenant = displayUser?.role === 'tenant';
  const isLandlord = displayUser?.role === 'landlord';

  const getRoleInfo = () => {
    switch (displayUser?.role) {
      case 'tenant':
        return { emoji: '🏠', label: 'Inquilino', color: '#10B981' };
      case 'landlord':
        return { emoji: '🏢', label: 'Propietario', color: '#3B82F6' };
      case 'guest':
        return { emoji: '👋', label: 'Invitado', color: '#8B5CF6' };
      default:
        return { emoji: '🔑', label: 'Comprador', color: '#F59E0B' };
    }
  };

  const roleInfo = getRoleInfo();

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={C.brandRed} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
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
          <Text style={styles.title}>{t('edit_profile.title')}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <LinearGradient
            colors={['rgba(200,16,46,0.08)', 'rgba(200,16,46,0.02)']}
            style={StyleSheet.absoluteFill}
          />
          
          {/* Avatar */}
          <TouchableOpacity onPress={showPhotoOptions} activeOpacity={0.8} style={styles.avatarWrapper}>
            <View style={styles.avatarContainer}>
              {profilePhoto ? (
                <Image source={{ uri: profilePhoto }} style={styles.avatarImage} />
              ) : (
                <LinearGradient
                  colors={['#C8102E', '#9B1B30']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[StyleSheet.absoluteFill, styles.avatarGradient]}
                >
                  <Text style={styles.avatarText}>
                    {(name || 'U')[0].toUpperCase()}
                  </Text>
                </LinearGradient>
              )}
              {uploadingPhoto && (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator size="small" color={C.white} />
                </View>
              )}
            </View>
            <View style={styles.cameraIconBadge}>
              <Ionicons name="camera" size={14} color={C.white} />
            </View>
          </TouchableOpacity>
          
          <Text style={styles.userName}>{name || 'Usuario'}</Text>
          <Text style={styles.userEmail}>{email}</Text>
          
          {/* Role Badge */}
          <View style={[styles.roleBadge, { borderColor: `${roleInfo.color}30` }]}>
            <Text style={styles.roleEmoji}>{roleInfo.emoji}</Text>
            <Text style={[styles.roleText, { color: roleInfo.color }]}>{roleInfo.label}</Text>
          </View>
          
          {memberSince && (
            <Text style={styles.memberSince}>Miembro desde {memberSince}</Text>
          )}
        </View>

        {/* Form Sections */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="person-outline" size={16} color={C.brandRed} /> Información Personal
          </Text>
          
          {/* Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>NOMBRE COMPLETO</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={18} color={C.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Tu nombre completo"
                placeholderTextColor={C.textDim}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>CORREO ELECTRÓNICO</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={18} color={C.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="tu@email.com"
                placeholderTextColor={C.textDim}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Phone */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>TELÉFONO</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="call-outline" size={18} color={C.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={formatPhone(phone)}
                onChangeText={handlePhoneChange}
                placeholder="(806) 555-0001"
                placeholderTextColor={C.textDim}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Company (landlord only) */}
          {isLandlord && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>EMPRESA</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="business-outline" size={18} color={C.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={companyName}
                  onChangeText={setCompanyName}
                  placeholder="Nombre de tu empresa"
                  placeholderTextColor={C.textDim}
                />
              </View>
            </View>
          )}
        </View>

        {/* Emergency Contact Section (for tenants) */}
        {isTenant && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="alert-circle-outline" size={16} color="#F59E0B" /> Contacto de Emergencia
            </Text>
            
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>NOMBRE DEL CONTACTO</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="people-outline" size={18} color={C.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={emergencyContact}
                  onChangeText={setEmergencyContact}
                  placeholder="Familiar o amigo cercano"
                  placeholderTextColor={C.textDim}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>TELÉFONO DE EMERGENCIA</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="call-outline" size={18} color={C.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={formatPhone(emergencyPhone)}
                  onChangeText={handleEmergencyPhoneChange}
                  placeholder="(806) 555-0002"
                  placeholderTextColor={C.textDim}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          </View>
        )}

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#E11D48', '#9B1B30']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveGradient}
          >
            {saving ? (
              <ActivityIndicator size="small" color={C.white} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color={C.white} />
                <Text style={styles.saveText}>{t('edit_profile.save')}</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Info text */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={16} color={C.textMuted} />
          <Text style={styles.infoText}>{t('edit_profile.info')}</Text>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: Spacing.base, paddingBottom: 40 },
  loadingContainer: { flex: 1, backgroundColor: C.background, justifyContent: 'center', alignItems: 'center' },
  
  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  title: { fontSize: FontSizes['2xl'], fontWeight: '800', color: C.textPrimary, letterSpacing: -0.5 },

  // Profile Card
  profileCard: {
    alignItems: 'center',
    backgroundColor: C.glass,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    borderColor: C.glassBorder,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  avatarWrapper: {
    marginBottom: Spacing.md,
  },
  avatarContainer: {
    width: 100, height: 100, borderRadius: 32,
    overflow: 'hidden', justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: 'rgba(200,16,46,0.3)',
  },
  avatarGradient: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 100, height: 100, borderRadius: 32,
  },
  avatarText: { fontSize: 38, fontWeight: '800', color: C.white },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 32,
  },
  cameraIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: -4,
    backgroundColor: C.brandRed,
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: C.background,
  },
  userName: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: C.textPrimary,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: FontSizes.sm,
    color: C.textMuted,
    marginBottom: Spacing.sm,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.glass,
    paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20,
    borderWidth: 1,
  },
  roleEmoji: {
    fontSize: 14,
  },
  roleText: { 
    fontSize: FontSizes.xs, 
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  memberSince: {
    fontSize: FontSizes.xs,
    color: C.textMuted,
    marginTop: Spacing.sm,
  },

  // Sections
  section: {
    backgroundColor: C.glass,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    borderColor: C.glassBorder,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: C.textPrimary,
    marginBottom: Spacing.md,
  },

  // Form
  fieldGroup: { marginBottom: Spacing.md },
  fieldLabel: {
    fontSize: 11, color: C.textMuted, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.glass, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: C.glassBorder,
    paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1, color: C.textPrimary, fontSize: FontSizes.base,
    paddingVertical: 14, fontWeight: '500',
  },

  // Save
  saveButton: { marginTop: Spacing.sm, borderRadius: BorderRadius.card, overflow: 'hidden' },
  saveButtonDisabled: { opacity: 0.6 },
  saveGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: BorderRadius.card,
  },
  saveText: { fontSize: FontSizes.base, fontWeight: '700', color: C.white },

  // Info
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginTop: Spacing.md, paddingHorizontal: 4,
  },
  infoText: { flex: 1, fontSize: FontSizes.xs, color: C.textMuted, lineHeight: 17 },
});
