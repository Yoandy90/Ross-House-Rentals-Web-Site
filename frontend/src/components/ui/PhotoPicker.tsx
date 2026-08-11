import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useColors, Spacing, FontSizes, BorderRadius } from '../../constants/theme';

interface PhotoPickerProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  maxPhotos?: number;
}

export function PhotoPicker({ photos, onPhotosChange, maxPhotos = 10 }: PhotoPickerProps) {
  const Colors = useColors();
  const styles = React.useMemo(() => create_styles(Colors), [Colors]);

  const requestPermission = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permiso requerido',
          'Necesitamos acceso a tu galería para subir fotos de la propiedad.'
        );
        return false;
      }
    }
    return true;
  };

  const pickFromGallery = async () => {
    const hasPermission = await requestPermission();
    if (!hasPermission) return;

    const remaining = maxPhotos - photos.length;
    if (remaining <= 0) {
      Alert.alert('Límite alcanzado', `Máximo ${maxPhotos} fotos por propiedad`);
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.6,
        base64: true,
        exif: false,
      });

      if (!result.canceled && result.assets) {
        const newPhotos = result.assets
          .filter(asset => asset.base64)
          .map(asset => {
            const mimeType = asset.mimeType || 'image/jpeg';
            return `data:${mimeType};base64,${asset.base64}`;
          });
        onPhotosChange([...photos, ...newPhotos]);
      }
    } catch (err) {
      console.log('Gallery pick error:', err);
      Alert.alert('Error', 'No se pudieron cargar las fotos');
    }
  };

  const takePhoto = async () => {
    if (photos.length >= maxPhotos) {
      Alert.alert('Límite alcanzado', `Máximo ${maxPhotos} fotos por propiedad`);
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara.');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.6,
        base64: true,
        exif: false,
      });

      if (!result.canceled && result.assets[0]?.base64) {
        const asset = result.assets[0];
        const mimeType = asset.mimeType || 'image/jpeg';
        const dataUri = `data:${mimeType};base64,${asset.base64}`;
        onPhotosChange([...photos, dataUri]);
      }
    } catch (err) {
      console.log('Camera error:', err);
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  };

  const removePhoto = (index: number) => {
    Alert.alert(
      'Eliminar foto',
      '¿Estás seguro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            const updated = [...photos];
            updated.splice(index, 1);
            onPhotosChange(updated);
          },
        },
      ]
    );
  };

  const showPickerOptions = () => {
    Alert.alert(
      'Agregar fotos',
      'Selecciona una opción',
      [
        { text: 'Cámara', onPress: takePhoto },
        { text: 'Galería', onPress: pickFromGallery },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>Fotos de la propiedad</Text>
        <Text style={styles.counter}>{photos.length}/{maxPhotos}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
        {/* Add button */}
        {photos.length < maxPhotos && (
          <TouchableOpacity style={styles.addButton} onPress={showPickerOptions} activeOpacity={0.7}>
            <Ionicons name="camera-outline" size={28} color={Colors.brandRed} />
            <Text style={styles.addText}>Agregar</Text>
          </TouchableOpacity>
        )}

        {/* Photo previews */}
        {photos.map((photo, index) => (
          <View key={`photo-${index}`} style={styles.photoWrapper}>
            <Image source={{ uri: photo }} style={styles.photoPreview} />
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => removePhoto(index)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={22} color={Colors.error} />
            </TouchableOpacity>
            {index === 0 && (
              <View style={styles.coverBadge}>
                <Text style={styles.coverText}>Portada</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {photos.length === 0 && (
        <TouchableOpacity style={styles.emptyState} onPress={showPickerOptions} activeOpacity={0.7}>
          <Ionicons name="images-outline" size={36} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Agrega fotos de tu propiedad</Text>
          <Text style={styles.emptyDesc}>Las propiedades con fotos reciben 5x más consultas</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const PHOTO_SIZE = 100;

const create_styles = (Colors: any) => StyleSheet.create({
  container: {
    marginBottom: Spacing.base,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  label: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  counter: {
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  scrollRow: {
    flexDirection: 'row',
  },
  addButton: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: BorderRadius.card,
    borderWidth: 2,
    borderColor: Colors.brandRed,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: 'rgba(237,27,51,0.06)',
  },
  addText: {
    fontSize: 10,
    color: Colors.brandRed,
    fontWeight: '600',
    marginTop: 4,
  },
  photoWrapper: {
    position: 'relative',
    marginRight: 10,
  },
  photoPreview: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: BorderRadius.card,
    backgroundColor: Colors.surfaceLight,
  },
  removeBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: Colors.surface,
    borderRadius: 11,
  },
  coverBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: Colors.brandRed,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  coverText: {
    fontSize: 8,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginTop: 10,
  },
  emptyDesc: {
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
    marginTop: 4,
  },
});
