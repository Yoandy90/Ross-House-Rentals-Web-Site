import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { apiCall } from '../../src/utils/api';
import { Input } from '../../src/components/ui/Input';
import { Spacing, FontSizes, BorderRadius, Shadows, useColors } from '../../src/constants/theme';

const CATEGORIES = [
  { id: 'plumbing', icon: 'water', label_es: 'Plomería', label_en: 'Plumbing' },
  { id: 'electrical', icon: 'flash', label_es: 'Eléctrico', label_en: 'Electrical' },
  { id: 'appliance', icon: 'tv', label_es: 'Electrodoméstico', label_en: 'Appliance' },
  { id: 'hvac', icon: 'thermometer', label_es: 'A/C - Calefacción', label_en: 'HVAC' },
  { id: 'structural', icon: 'home', label_es: 'Estructura', label_en: 'Structural' },
  { id: 'pest', icon: 'bug', label_es: 'Plagas', label_en: 'Pest Control' },
  { id: 'cleaning', icon: 'sparkles', label_es: 'Limpieza', label_en: 'Cleaning' },
  { id: 'other', icon: 'ellipsis-horizontal', label_es: 'Otro', label_en: 'Other' },
];

const getPriorities = (C: any) => [
  { id: 'low', label_es: 'Baja', label_en: 'Low', color: C.success },
  { id: 'normal', label_es: 'Normal', label_en: 'Normal', color: C.info },
  { id: 'high', label_es: 'Alta', label_en: 'High', color: C.warning },
  { id: 'urgent', label_es: 'Urgente', label_en: 'Urgent', color: C.error },
];

export default function NewMaintenanceScreen() {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const lang = i18n.language;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [priority, setPriority] = useState('normal');
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Error', t('maintenance.photo_permission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
      allowsMultipleSelection: true,
      selectionLimit: 5 - photos.length,
    });

    if (!result.canceled && result.assets) {
      // Convert each asset to a base64 data URL so it can be sent to the
      // backend and rendered by the admin web (local file:// URIs won't
      // work outside this device).
      const newPhotos = result.assets
        .map((a: any) => {
          if (a.base64) {
            const mime = (a.mimeType || a.type || 'image/jpeg').replace(/^image\//, '');
            return `data:image/${mime};base64,${a.base64}`;
          }
          return a.uri;
        })
        .filter(Boolean);
      setPhotos(prev => [...prev, ...newPhotos].slice(0, 5));
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Error', t('maintenance.camera_permission'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const a: any = result.assets[0];
      const dataUrl = a.base64
        ? `data:image/${(a.mimeType || a.type || 'image/jpeg').replace(/^image\//, '')};base64,${a.base64}`
        : a.uri;
      setPhotos(prev => [...prev, dataUrl].slice(0, 5));
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Error', t('maintenance.title_required'));
      return;
    }
    if (!description.trim()) {
      Alert.alert('Error', t('maintenance.desc_required'));
      return;
    }

    setLoading(true);
    try {
      await apiCall('/tenant/maintenance-request', {
        method: 'POST',
        body: {
          title: title.trim(),
          description: description.trim(),
          category,
          priority,
          photos,
        },
      });
      Alert.alert(
        t('maintenance.success_title'),
        t('maintenance.success_desc'),
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={[styles.container, { paddingTop: insets.top }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={C.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('maintenance.new_request')}</Text>
        </View>

        {/* Subtle header glow */}
        <LinearGradient
          colors={['rgba(200,16,46,0.05)', 'transparent']}
          style={styles.headerGlow}
        />

        {/* Category Selector */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionLabelRow}>
            <Ionicons name="grid-outline" size={14} color={C.brandRed} />
            <Text style={styles.sectionLabel}>{t('maintenance.category')}</Text>
          </View>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryChip, category === cat.id && styles.categoryChipActive]}
                onPress={() => setCategory(cat.id)}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={18}
                  color={category === cat.id ? C.brandRed : C.textMuted}
                />
                <Text style={[styles.categoryText, category === cat.id && styles.categoryTextActive]}>
                  {lang === 'es' ? cat.label_es : cat.label_en}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Title & Description */}
        <Input
          label={t('maintenance.issue_title')}
          value={title}
          onChangeText={setTitle}
          placeholder={t('maintenance.title_placeholder')}
        />

        <Input
          label={t('maintenance.description')}
          value={description}
          onChangeText={setDescription}
          placeholder={t('maintenance.desc_placeholder')}
          multiline
          numberOfLines={4}
          style={styles.textarea}
        />

        {/* Priority */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionLabelRow}>
            <Ionicons name="flag-outline" size={14} color={C.brandRed} />
            <Text style={styles.sectionLabel}>{t('maintenance.priority')}</Text>
          </View>
          <View style={styles.priorityRow}>
            {getPriorities(C).map(p => (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.priorityChip,
                  priority === p.id && {
                    borderColor: p.color,
                    backgroundColor: `${p.color}15`,
                  },
                ]}
                onPress={() => setPriority(p.id)}
              >
                <View style={[styles.priorityDot, { backgroundColor: p.color }]} />
                <Text style={[styles.priorityText, priority === p.id && { color: p.color }]}>
                  {lang === 'es' ? p.label_es : p.label_en}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Photos */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionLabelRow}>
            <Ionicons name="camera-outline" size={14} color={C.brandRed} />
            <Text style={styles.sectionLabel}>{t('maintenance.photos')} ({photos.length}/5)</Text>
          </View>
          <View style={styles.photosRow}>
            {photos.map((uri, i) => (
              <View key={i} style={styles.photoThumb}>
                <Image source={{ uri }} style={styles.photoImage} />
                <TouchableOpacity style={styles.photoRemove} onPress={() => removePhoto(i)}>
                  <Ionicons name="close" size={14} color={C.white} />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < 5 && (
              <View style={styles.photoActions}>
                <TouchableOpacity style={styles.addPhotoBtn} onPress={takePhoto}>
                  <Ionicons name="camera" size={24} color={C.brandRed} />
                  <Text style={styles.addPhotoText}>{t('maintenance.camera')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addPhotoBtn} onPress={pickImage}>
                  <Ionicons name="images" size={24} color={C.info} />
                  <Text style={styles.addPhotoText}>{t('maintenance.gallery')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Submit Button with Gradient */}
        <TouchableOpacity
          style={styles.submitBtn}
          onPress={handleSubmit}
          activeOpacity={0.8}
          disabled={loading}
        >
          <LinearGradient
            colors={['#E11D48', '#9B1B30']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.submitGradient}
          >
            {loading ? (
              <Text style={styles.submitText}>...</Text>
            ) : (
              <>
                <Ionicons name="send" size={18} color={C.white} />
                <Text style={styles.submitText}>{t('maintenance.submit')}</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.background },
  container: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: Spacing.base, paddingBottom: 40 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: Spacing.md,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  headerTitle: { fontSize: FontSizes.xl, fontWeight: '800', color: C.textPrimary, letterSpacing: -0.3 },
  headerGlow: { height: 20 },

  // Section Card wrapper
  sectionCard: {
    backgroundColor: C.surface,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    borderColor: C.border,
    padding: Spacing.base,
    marginTop: Spacing.md,
    overflow: 'hidden',
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  sectionLabel: {
    fontSize: FontSizes.xs, color: C.textMuted, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  categoryGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: BorderRadius.full,
    backgroundColor: C.surfaceLight, borderWidth: 1, borderColor: C.border,
  },
  categoryChipActive: {
    borderColor: C.brandRed, backgroundColor: 'rgba(237,27,51,0.08)',
  },
  categoryText: { fontSize: FontSizes.sm, color: C.textMuted, fontWeight: '500' },
  categoryTextActive: { color: C.brandRed, fontWeight: '700' },
  textarea: { minHeight: 100, textAlignVertical: 'top' },
  priorityRow: { flexDirection: 'row', gap: 8 },
  priorityChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: BorderRadius.md,
    backgroundColor: C.surfaceLight, borderWidth: 1, borderColor: C.border,
  },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  priorityText: { fontSize: FontSizes.xs, color: C.textMuted, fontWeight: '600' },
  photosRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  photoThumb: {
    width: 80, height: 80, borderRadius: BorderRadius.md,
    overflow: 'hidden', position: 'relative',
    borderWidth: 1, borderColor: C.border,
  },
  photoImage: { width: '100%', height: '100%' },
  photoRemove: {
    position: 'absolute', top: 4, right: 4,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center',
  },
  photoActions: { flexDirection: 'row', gap: 10 },
  addPhotoBtn: {
    width: 80, height: 80, borderRadius: BorderRadius.md,
    backgroundColor: C.surfaceLight, borderWidth: 1, borderColor: C.border,
    borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', gap: 4,
  },
  addPhotoText: { fontSize: 9, color: C.textMuted, fontWeight: '700' },

  // Submit
  submitBtn: {
    marginTop: Spacing.xl,
    borderRadius: BorderRadius.card,
    overflow: 'hidden',
    ...Shadows.button,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: BorderRadius.card,
  },
  submitText: {
    color: C.white,
    fontSize: FontSizes.md,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
