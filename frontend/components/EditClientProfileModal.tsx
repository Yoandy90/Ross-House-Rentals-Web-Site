import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useThemeColors } from '../constants/colors';
import { CustomInput } from './CustomInput';
import { CustomButton } from './CustomButton';
import api from '../services/api';

interface EditClientProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clientData: any;
}

export default function EditClientProfileModal({
  visible,
  onClose,
  onSuccess,
  clientData,
}: EditClientProfileModalProps) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);

  useEffect(() => {
    if (clientData && visible) {
      setName(clientData.name || '');
      setEmail(clientData.email || '');
      setPhone(clientData.phone || '');
      setAddressLine1(clientData.address?.address_line1 || '');
      setAddressLine2(clientData.address?.address_line2 || '');
      setCity(clientData.address?.city || '');
      setState(clientData.address?.state || '');
      setZipCode(clientData.address?.zip_code || '');
      setProfilePicture(clientData.profile_picture || null);
    }
  }, [clientData, visible]);

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
      Alert.alert('Error', 'El nombre es requerido');
      return;
    }

    if (!email.trim()) {
      Alert.alert('Error', 'El email es requerido');
      return;
    }

    setLoading(true);
    try {
      const updateData: any = {
        name,
        email,
        phone,
        address: {
          address_line1: addressLine1,
          address_line2: addressLine2,
          city,
          state,
          zip_code: zipCode,
        },
      };

      if (profilePicture) {
        updateData.profile_picture = profilePicture;
      }

      await api.put(`/admin/clients/${clientData.id}`, updateData);
      
      Alert.alert('Éxito', 'Perfil actualizado correctamente');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error updating client:', error);
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo actualizar el perfil');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Editar Perfil del Cliente</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Picture */}
          <View style={styles.photoSection}>
            <TouchableOpacity onPress={showImageOptions} style={styles.photoContainer}>
              {profilePicture ? (
                <Image source={{ uri: profilePicture }} style={styles.photo} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="person" size={48} color={colors.textGray} />
                </View>
              )}
              <View style={styles.photoOverlay}>
                <Ionicons name="camera" size={24} color={colors.background} />
              </View>
            </TouchableOpacity>
            <Text style={styles.photoHint}>Toca para cambiar foto</Text>
          </View>

          {/* Personal Info */}
          <Text style={styles.sectionTitle}>Información Personal</Text>
          <CustomInput
            label="Nombre Completo *"
            value={name}
            onChangeText={setName}
            placeholder="Nombre del cliente"
            autoCapitalize="words"
          />

          <CustomInput
            label="Email *"
            value={email}
            onChangeText={setEmail}
            placeholder="email@ejemplo.com"
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

          {/* Address */}
          <Text style={styles.sectionTitle}>Dirección</Text>
          <CustomInput
            label="Dirección Línea 1"
            value={addressLine1}
            onChangeText={setAddressLine1}
            placeholder="123 Main Street"
            autoCapitalize="words"
          />

          <CustomInput
            label="Dirección Línea 2"
            value={addressLine2}
            onChangeText={setAddressLine2}
            placeholder="Apt 4B (Opcional)"
            autoCapitalize="words"
          />

          <CustomInput
            label="Ciudad"
            value={city}
            onChangeText={setCity}
            placeholder="Miami"
            autoCapitalize="words"
          />

          <View style={styles.rowInputs}>
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
            <View style={styles.halfInput}>
              <CustomInput
                label="Código Postal"
                value={zipCode}
                onChangeText={setZipCode}
                placeholder="33101"
                keyboardType="number-pad"
                maxLength={5}
              />
            </View>
          </View>

          {/* Save Button */}
          <CustomButton
            title="Guardar Cambios"
            onPress={handleSave}
            loading={loading}
            style={styles.saveButton}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  placeholder: {
    width: 40,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  photoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    marginBottom: 12,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.backgroundGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoHint: {
    fontSize: 13,
    color: colors.textGray,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
    marginTop: 8,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  saveButton: {
    marginTop: 32,
  },
});