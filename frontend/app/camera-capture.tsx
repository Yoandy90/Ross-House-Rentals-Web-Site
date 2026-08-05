import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../constants/colors';
import * as ImageManipulator from 'expo-image-manipulator';
import api from '../services/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const DOCUMENT_TYPES: Record<string, { title: string; guide: string }> = {
  photo_2x2: { title: 'Foto Personal 2x2', guide: 'oval' },
  id_front: { title: 'ID Frontal', guide: 'rectangle' },
  id_back: { title: 'ID Reverso', guide: 'rectangle' },
  passport: { title: 'Pasaporte', guide: 'rectangle' },
  ssn_card: { title: 'Social Security Card', guide: 'rectangle' },
  w2: { title: 'Formulario W2', guide: 'rectangle' },
  '1099': { title: 'Formulario 1099', guide: 'rectangle' },
  receipt: { title: 'Recibo', guide: 'rectangle' },
  other: { title: 'Otro Documento', guide: 'rectangle' },
};

export default function CameraCapture() {
  const { type = 'photo_2x2', returnTo, field } = useLocalSearchParams();
  const router = useRouter();
  const colors = useThemeColors();
  const { t } = useTranslation();
  const styles = createStyles(colors);
  const cameraRef = useRef<CameraView>(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [facing, setFacing] = useState<'front' | 'back'>('back');

  const docType = String(type);
  const docInfo = DOCUMENT_TYPES[docType] || DOCUMENT_TYPES.other;
  
  // Check if this is being used for passport application
  const isPassportPhoto = returnTo === 'passport-application';

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
        });
        
        if (photo && photo.uri) {
          // Recortar la imagen al área de la guía
          const croppedPhoto = await cropImageToGuide(photo.uri);
          setCapturedPhoto(croppedPhoto);
        }
      } catch (error) {
        console.error('Error taking picture:', error);
        Alert.alert('Error', 'No se pudo tomar la foto');
      }
    }
  };

  const cropImageToGuide = async (uri: string) => {
    try {
      // Definir área de recorte según el tipo de documento
      let cropArea;
      
      if (docInfo.guide === 'oval') {
        // Para foto 2x2: recortar área rectangular que contiene el óvalo
        // Centrado en la pantalla con las dimensiones del marco
        const frameWidth = 280;
        const frameHeight = 380;
        const originX = (SCREEN_WIDTH - frameWidth) / 2;
        const originY = (SCREEN_HEIGHT - frameHeight) / 2 - 60; // Ajuste por header
        
        cropArea = {
          originX: originX,
          originY: originY,
          width: frameWidth,
          height: frameHeight,
        };
      } else {
        // Para documentos: recortar área del rectángulo guía
        const guideWidth = 300;
        const guideHeight = 200;
        const originX = (SCREEN_WIDTH - guideWidth) / 2;
        const originY = (SCREEN_HEIGHT - guideHeight) / 2 - 60;
        
        cropArea = {
          originX: originX,
          originY: originY,
          width: guideWidth,
          height: guideHeight,
        };
      }

      // Recortar y comprimir la imagen
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        uri,
        [
          { crop: cropArea },
          { resize: docInfo.guide === 'oval' ? { width: 600 } : { width: 800 } },
        ],
        {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      return manipulatedImage.uri;
    } catch (error) {
      console.error('Error cropping image:', error);
      // Si falla el recorte, devolver la imagen original
      return uri;
    }
  };

  const retake = () => {
    setCapturedPhoto(null);
  };

  const uploadPhoto = async () => {
    if (!capturedPhoto) return;

    try {
      setUploading(true);
      
      // Convert image to base64
      const response = await fetch(capturedPhoto);
      const blob = await response.blob();
      const reader = new FileReader();
      
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        
        // If this is for passport application, store in AsyncStorage and go back
        if (isPassportPhoto) {
          try {
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            await AsyncStorage.setItem('passport_photo_temp', base64data);
            router.back();
          } catch (error) {
            console.error('Error saving passport photo:', error);
            Alert.alert('Error', 'No se pudo guardar la foto');
          } finally {
            setUploading(false);
          }
          return;
        }
        
        // Original upload flow for documents
        try {
          await api.post('/document-capture/upload', {
            document_type: docType,
            image_data: base64data,
            notes: null,
            year: new Date().getFullYear(),
          });
          
          Alert.alert(
            '¡Éxito!',
            'Documento enviado correctamente a la oficina',
            [
              {
                text: 'OK',
                onPress: () => router.back(),
              },
            ]
          );
        } catch (error: any) {
          console.error('Upload error:', error);
          Alert.alert(
            'Error',
            error.response?.data?.detail || 'No se pudo subir el documento'
          );
        } finally {
          setUploading(false);
        }
      };
      
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Error processing image:', error);
      Alert.alert('Error', 'No se pudo procesar la imagen');
      setUploading(false);
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Ionicons name="camera-off" size={64} color={colors.textSecondary} />
          <Text style={styles.permissionText}>
            Se requiere permiso de cámara
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.back()}
          >
            <Text style={styles.buttonText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (capturedPhoto) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{docInfo.title}</Text>
        </View>
        <View style={styles.previewContainer}>
          <Image source={{ uri: capturedPhoto }} style={styles.previewImage} />
        </View>
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.controlButton, styles.secondaryButton]}
            onPress={retake}
            disabled={uploading}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
            <Text style={styles.controlButtonText}>Retomar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.controlButton, styles.primaryButton]}
            onPress={uploadPhoto}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color={colors.textWhite} />
            ) : (
              <>
                <Ionicons name="send" size={24} color={colors.textWhite} />
                <Text style={[styles.controlButtonText, { color: colors.textWhite }]}>
                  Enviar
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={28} color={colors.textWhite} />
        </TouchableOpacity>
        <Text style={styles.title}>{docInfo.title}</Text>
        <TouchableOpacity
          onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
          style={styles.flipButton}
        >
          <Ionicons name="camera-reverse" size={28} color={colors.textWhite} />
        </TouchableOpacity>
      </View>

      <CameraView style={styles.camera} ref={cameraRef} facing={facing} />
      
      {/* Overlay con guías sobre la cámara */}
      <View style={styles.guideOverlay} pointerEvents="none">
        <View style={styles.guideContainer}>
          {docInfo.guide === 'oval' ? (
            <>
              {/* Marco de foto 2x2 */}
              <View style={styles.photoFrame}>
                {/* Guía oval para rostro */}
                <View style={styles.ovalGuide} />
                
                {/* Línea para nivel de ojos */}
                <View style={styles.eyeLevelLine}>
                  <View style={styles.eyeLevelDot} />
                  <View style={styles.eyeLevelDot} />
                </View>
                
                {/* Indicador de hombros - línea horizontal */}
                <View style={styles.shoulderLine} />
                
                {/* Esquinas del marco */}
                <View style={styles.cornerTopLeft} />
                <View style={styles.cornerTopRight} />
                <View style={styles.cornerBottomLeft} />
                <View style={styles.cornerBottomRight} />
              </View>
              
              {/* Instrucciones */}
              <View style={styles.photoInstructions}>
                <Text style={styles.instructionText}>Centra tu rostro en el óvalo</Text>
                <Text style={styles.instructionText}>Mantén los hombros visibles</Text>
              </View>
            </>
          ) : (
            <View style={styles.rectangleGuide} />
          )}
        </View>
      </View>

      <View style={styles.bottomControls}>
        <Text style={styles.instruction}>
          {docInfo.guide === 'oval'
            ? 'Centra tu rostro en el óvalo'
            : 'Centra el documento en el rectángulo'}
        </Text>
        <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
          <View style={styles.captureButtonInner} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    permissionText: {
      fontSize: 16,
      color: colors.textSecondary,
      marginTop: 16,
      marginBottom: 24,
      textAlign: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      backgroundColor: 'rgba(0,0,0,0.7)',
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    flipButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textWhite,
    },
    camera: {
      flex: 1,
    },
    guideOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    guideContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    photoFrame: {
      width: 280,
      height: 380,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ovalGuide: {
      width: 220,
      height: 280,
      borderRadius: 110,
      borderWidth: 4,
      borderColor: '#FFFFFF',
      opacity: 0.9,
    },
    eyeLevelLine: {
      position: 'absolute',
      top: 90,
      flexDirection: 'row',
      width: 240,
      justifyContent: 'space-between',
      paddingHorizontal: 20,
    },
    eyeLevelDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#4CAF50',
    },
    shoulderLine: {
      position: 'absolute',
      bottom: 40,
      width: 260,
      height: 3,
      backgroundColor: '#4CAF50',
      opacity: 0.7,
    },
    cornerTopLeft: {
      position: 'absolute',
      top: -10,
      left: -10,
      width: 30,
      height: 30,
      borderTopWidth: 4,
      borderLeftWidth: 4,
      borderColor: '#FFFFFF',
    },
    cornerTopRight: {
      position: 'absolute',
      top: -10,
      right: -10,
      width: 30,
      height: 30,
      borderTopWidth: 4,
      borderRightWidth: 4,
      borderColor: '#FFFFFF',
    },
    cornerBottomLeft: {
      position: 'absolute',
      bottom: -10,
      left: -10,
      width: 30,
      height: 30,
      borderBottomWidth: 4,
      borderLeftWidth: 4,
      borderColor: '#FFFFFF',
    },
    cornerBottomRight: {
      position: 'absolute',
      bottom: -10,
      right: -10,
      width: 30,
      height: 30,
      borderBottomWidth: 4,
      borderRightWidth: 4,
      borderColor: '#FFFFFF',
    },
    photoInstructions: {
      position: 'absolute',
      bottom: 80,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
    },
    instructionText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
      marginVertical: 3,
    },
    rectangleGuide: {
      width: 300,
      height: 200,
      borderRadius: 12,
      borderWidth: 3,
      borderColor: '#FFFFFF',
      borderStyle: 'dashed',
    },
    bottomControls: {
      padding: 32,
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.7)',
    },
    instruction: {
      fontSize: 14,
      color: colors.textWhite,
      marginBottom: 24,
      textAlign: 'center',
    },
    captureButton: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.textWhite,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 4,
      borderColor: 'rgba(255,255,255,0.3)',
    },
    captureButtonInner: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.textWhite,
    },
    previewContainer: {
      flex: 1,
      backgroundColor: '#000',
    },
    previewImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'contain',
    },
    controls: {
      flexDirection: 'row',
      padding: 16,
      gap: 16,
      backgroundColor: 'rgba(0,0,0,0.9)',
    },
    controlButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 18,
      borderRadius: 12,
      gap: 8,
    },
    secondaryButton: {
      backgroundColor: '#6B7280',
      borderWidth: 2,
      borderColor: '#9CA3AF',
    },
    primaryButton: {
      backgroundColor: colors.primary,
    },
    controlButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    button: {
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    buttonText: {
      color: colors.textWhite,
      fontSize: 16,
      fontWeight: '600',
    },
  });
