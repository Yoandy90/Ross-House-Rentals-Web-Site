import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useThemeColors } from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';
import { CustomInput } from '../../components/CustomInput';
import { CustomButton } from '../../components/CustomButton';
import api from '../../services/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import CustomHeader from '../../components/CustomHeader';

export default function PersonalInfo() {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { user, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);

  // Update local state when user loads or changes
  React.useEffect(() => {
    console.log('🔄 useEffect triggered, user:', user);
    if (user) {
      console.log('✅ Updating local states with user data');
      console.log('   - name:', user.name);
      console.log('   - email:', user.email);
      console.log('   - phone:', user.phone);
      console.log('   - address:', user.address);
      console.log('   - profile_picture:', user.profile_picture ? 'exists' : 'null');
      
      setName(user.name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setAddressLine1(user.address?.address_line1 || '');
      setAddressLine2(user.address?.address_line2 || '');
      setCity(user.address?.city || '');
      setState(user.address?.state || '');
      setZipCode(user.address?.zip_code || '');
      
      // Format profile picture with base64 prefix if it exists
      if (user.profile_picture) {
        setProfilePicture(`data:image/jpeg;base64,${user.profile_picture}`);
      } else {
        setProfilePicture(null);
      }
    } else {
      console.log('⚠️ User is null, not updating states');
    }
  }, [user]);

  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permiso Requerido', 'Se necesita permiso para acceder a la galería');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setProfilePicture(base64Image);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permiso Requerido', 'Se necesita permiso para acceder a la cámara');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setProfilePicture(base64Image);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  };

  const showImageOptions = () => {
    Alert.alert(
      'Foto de Perfil',
      'Selecciona una opción',
      [
        {
          text: 'Tomar Foto',
          onPress: handleTakePhoto,
        },
        {
          text: 'Elegir de Galería',
          onPress: handlePickImage,
        },
        {
          text: 'Cancelar',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'El nombre no puede estar vacío');
      return;
    }

    if (!email.trim()) {
      Alert.alert('Error', 'El email no puede estar vacío');
      return;
    }

    setSaving(true);
    try {
      const updateData: any = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        address: {
          address_line1: addressLine1.trim(),
          address_line2: addressLine2.trim(),
          city: city.trim(),
          state: state.trim(),
          zip_code: zipCode.trim(),
        }
      };

      // Only include profile_picture if it has changed or exists
      if (profilePicture && profilePicture !== user?.profile_picture) {
        updateData.profile_picture = profilePicture;
      }

      console.log('📤 Updating profile with data:', {
        ...updateData,
        profile_picture: updateData.profile_picture ? 'Image data (hidden)' : 'No change'
      });

      const response = await api.put('/users/me', updateData);
      
      console.log('✅ Profile updated successfully');
      
      // Update user in context
      if (updateUser) {
        updateUser(response.data);
      }
      
      // Also update local state to match with base64 prefix
      if (response.data.profile_picture) {
        setProfilePicture(`data:image/jpeg;base64,${response.data.profile_picture}`);
      } else {
        setProfilePicture(null);
      }
      
      Alert.alert('Éxito', 'Información actualizada correctamente');
      setEditing(false);
    } catch (error: any) {
      console.error('❌ Error updating profile:', error);
      console.error('Error response:', error.response?.data);
      
      // Handle session expired or no auth
      if (error.response?.status === 401 || error.response?.data?.detail?.includes('authorization')) {
        Alert.alert(
          'Sesión expirada', 
          'Tu sesión ha expirado. Por favor cierra sesión y vuelve a iniciar.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', error.response?.data?.detail || 'No se pudo actualizar la información');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setName(user?.name || '');
    setEmail(user?.email || '');
    setPhone(user?.phone || '');
    setAddressLine1(user?.address?.address_line1 || '');
    setAddressLine2(user?.address?.address_line2 || '');
    setCity(user?.address?.city || '');
    setState(user?.address?.state || '');
    setZipCode(user?.address?.zip_code || '');
    
    // Restore profile picture with base64 prefix
    if (user?.profile_picture) {
      setProfilePicture(`data:image/jpeg;base64,${user.profile_picture}`);
    } else {
      setProfilePicture(null);
    }
    
    setEditing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Custom Header */}
      <CustomHeader 
        title="Mi Perfil"
        showBack={true}
      />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Picture */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={editing ? showImageOptions : undefined}
            disabled={!editing}
          >
            {profilePicture ? (
              <Image source={{ uri: profilePicture }} style={styles.avatar} />
            ) : (
              <Ionicons name="person" size={60} color={colors.textWhite} />
            )}
            {editing && (
              <View style={styles.avatarOverlay}>
                <Ionicons name="camera" size={24} color={colors.background} />
              </View>
            )}
          </TouchableOpacity>
          {editing && <Text style={styles.subtitle}>Toca la foto para cambiarla</Text>}
        </View>

        {/* Info Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Datos de la Cuenta</Text>
            {!editing && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => setEditing(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="create-outline" size={20} color={colors.primary} />
                <Text style={styles.editButtonText}>Editar</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.cardContent}>
            {editing ? (
              <>
                <CustomInput
                  label="Nombre Completo *"
                  value={name}
                  onChangeText={setName}
                  placeholder="Tu nombre completo"
                  autoCapitalize="words"
                />
                <CustomInput
                  label="Email *"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="tu@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <CustomInput
                  label="Teléfono"
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="(555) 123-4567"
                  keyboardType="phone-pad"
                />

                {/* Address Section */}
                <View style={styles.sectionDivider} />
                <Text style={styles.sectionTitle}>Dirección</Text>
                
                <CustomInput
                  label="Dirección Línea 1"
                  value={addressLine1}
                  onChangeText={setAddressLine1}
                  placeholder="123 Calle Principal"
                  autoCapitalize="words"
                />
                <CustomInput
                  label="Dirección Línea 2"
                  value={addressLine2}
                  onChangeText={setAddressLine2}
                  placeholder="Apt 4B, Piso 2, etc."
                  autoCapitalize="words"
                />
                <View style={styles.rowInputs}>
                  <View style={styles.halfInput}>
                    <CustomInput
                      label="Ciudad"
                      value={city}
                      onChangeText={setCity}
                      placeholder="Miami"
                      autoCapitalize="words"
                    />
                  </View>
                  <View style={styles.halfInput}>
                    <CustomInput
                      label="Estado"
                      value={state}
                      onChangeText={setState}
                      placeholder="FL"
                      autoCapitalize="characters"
                      maxLength={2}
                    />
                  </View>
                </View>
                <CustomInput
                  label="Código Postal"
                  value={zipCode}
                  onChangeText={setZipCode}
                  placeholder="33101"
                  keyboardType="number-pad"
                  maxLength={5}
                />
                
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.button, styles.buttonCancel]}
                    onPress={handleCancel}
                    disabled={saving}
                  >
                    <Text style={styles.buttonCancelText}>Cancelar</Text>
                  </TouchableOpacity>
                  
                  <CustomButton
                    title="Guardar"
                    onPress={handleSave}
                    loading={saving}
                    style={styles.button}
                  />
                </View>
              </>
            ) : (
              <>
                <View style={styles.infoRow}>
                  <Ionicons name="person-outline" size={20} color={colors.textGray} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Nombre</Text>
                    <Text style={styles.infoValue}>{user?.name || 'No especificado'}</Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <Ionicons name="mail-outline" size={20} color={colors.textGray} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Email</Text>
                    <Text style={styles.infoValue}>{user?.email}</Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <Ionicons name="call-outline" size={20} color={colors.textGray} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Teléfono</Text>
                    <Text style={styles.infoValue}>{user?.phone || 'No especificado'}</Text>
                  </View>
                </View>

                {/* Address Display */}
                <View style={styles.sectionDivider} />
                
                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={20} color={colors.textGray} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Dirección</Text>
                    {user?.address?.address_line1 ? (
                      <>
                        <Text style={styles.infoValue}>{user.address.address_line1}</Text>
                        {user.address.address_line2 && (
                          <Text style={styles.infoValue}>{user.address.address_line2}</Text>
                        )}
                        <Text style={styles.infoValue}>
                          {user.address.city && user.address.state 
                            ? `${user.address.city}, ${user.address.state} ${user.address.zip_code || ''}`
                            : 'Información incompleta'}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.infoValue}>No especificada</Text>
                    )}
                  </View>
                </View>

                {user?.created_at && (
                  <View style={styles.infoRow}>
                    <Ionicons name="calendar-outline" size={20} color={colors.textGray} />
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>Miembro desde</Text>
                      <Text style={styles.infoValue}>
                        {format(new Date(user.created_at), "dd 'de' MMMM, yyyy", { locale: es })}
                      </Text>
                    </View>
                  </View>
                )}
              </>
            )}
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color={colors.info} />
          <Text style={styles.infoText}>
            Para cambiar tu email, por favor contacta con soporte.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
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
    marginBottom: 24,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textGray,
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  cardContent: {
    gap: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.textGray,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
  },
  buttonCancel: {
    backgroundColor: colors.backgroundGray,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textGray,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: colors.info + '15',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.info,
    lineHeight: 18,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
});