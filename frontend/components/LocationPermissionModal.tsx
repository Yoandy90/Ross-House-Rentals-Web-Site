/**
 * Location Permission Modal
 * Shows when user first logs in to request location permission
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface LocationPermissionModalProps {
  visible: boolean;
  onComplete: () => void;
}

const LocationPermissionModal: React.FC<LocationPermissionModalProps> = ({
  visible,
  onComplete,
}) => {
  const [requesting, setRequesting] = React.useState(false);

  const handleAllow = async () => {
    try {
      setRequesting(true);
      
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status === 'granted') {
        // Get current location
        const location = await Location.getCurrentPositionAsync({});
        
        // Save location to AsyncStorage
        await AsyncStorage.setItem('user_location', JSON.stringify({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          timestamp: new Date().toISOString(),
        }));
        
        // Mark that we asked for permission
        await AsyncStorage.setItem('location_permission_asked', 'true');
      } else {
        // User denied, but we still mark as asked
        await AsyncStorage.setItem('location_permission_asked', 'true');
      }
      
      onComplete();
    } catch (error) {
      console.error('Error requesting location:', error);
      await AsyncStorage.setItem('location_permission_asked', 'true');
      onComplete();
    } finally {
      setRequesting(false);
    }
  };

  const handleNotNow = async () => {
    try {
      // Mark that we asked (user said no)
      await AsyncStorage.setItem('location_permission_asked', 'true');
      onComplete();
    } catch (error) {
      console.error('Error saving permission state:', error);
      onComplete();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Ionicons name="location" size={60} color="#6C1110" />
          </View>

          {/* Title */}
          <Text style={styles.title}>
            ¿Compartir tu ubicación?
          </Text>

          {/* Description */}
          <Text style={styles.description}>
            Nos gustaría usar tu ubicación para:
          </Text>

          {/* Benefits list */}
          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <Text style={styles.benefitText}>
                Encontrar la oficina más cercana
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <Text style={styles.benefitText}>
                Sugerir citas en tu zona
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <Text style={styles.benefitText}>
                Ofrecerte servicios locales
              </Text>
            </View>
          </View>

          {/* Privacy note */}
          <Text style={styles.privacyNote}>
            Tu ubicación se guarda de forma segura y privada. Puedes cambiar esto en cualquier momento desde Configuración.
          </Text>

          {/* Buttons */}
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleAllow}
            disabled={requesting}
          >
            <Ionicons name="checkmark" size={20} color="#fff" />
            <Text style={styles.primaryButtonText}>
              {requesting ? 'Solicitando...' : 'Permitir'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={handleNotNow}
            disabled={requesting}
          >
            <Text style={styles.secondaryButtonText}>
              Ahora no
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  benefitsList: {
    marginBottom: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 12,
    flex: 1,
  },
  privacyNote: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#6C1110',
    shadowColor: '#6C1110',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
});

export default LocationPermissionModal;
