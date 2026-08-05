import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions,
  Modal,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import Svg, { Path } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useTranslation } from 'react-i18next';

const { width } = Dimensions.get('window');

// Types
interface PassportFormData {
  tramite_type: string;
  primer_apellido: string;
  segundo_apellido: string;
  primer_nombre: string;
  segundo_nombre: string;
  fecha_nacimiento: string;
  fecha_nacimiento_dia: string;
  fecha_nacimiento_mes: string;
  fecha_nacimiento_año: string;
  sexo: string;
  color_ojos: string;
  color_piel: string;
  color_cabello: string;
  estatura: string;
  estado_civil: string;
  caracteristicas_especiales: string;
  nombre_padre: string;
  nombre_madre: string;
  pais_nacimiento: string;
  provincia_nacimiento: string;
  municipio_nacimiento: string;
  clasificacion_migratoria: string;
  fecha_salida_cuba: string;
  direccion_actual: string;
  ciudad_actual: string;
  estado_actual: string;
  codigo_postal: string;
  pais_actual: string;
  telefono: string;
  email: string;
  centro_trabajo: string;
  profesion: string;
  ocupacion: string;
  direccion_trabajo: string;
  nombre_referencia: string;
  telefono_referencia: string;
  direccion_referencia: string;
  numero_pasaporte_anterior: string;
  fecha_expedicion_anterior: string;
  numero_carnet_identidad: string;
  tomo_acta: string;
  folio_acta: string;
  foto_pasaporte: string | null;
  firma_digital: string | null;
  documento_identidad: string | null;
  acta_nacimiento: string | null;
  // Shipping
  shipping_method: string;
  shipping_price: number;
  shipping_label: string;
}

const initialFormData: PassportFormData = {
  tramite_type: '',
  primer_apellido: '',
  segundo_apellido: '',
  primer_nombre: '',
  segundo_nombre: '',
  fecha_nacimiento: '',
  fecha_nacimiento_dia: '',
  fecha_nacimiento_mes: '',
  fecha_nacimiento_año: '',
  sexo: '',
  color_ojos: '',
  color_piel: '',
  color_cabello: '',
  estatura: '',
  estado_civil: '',
  caracteristicas_especiales: '',
  nombre_padre: '',
  nombre_madre: '',
  pais_nacimiento: 'Cuba',
  provincia_nacimiento: '',
  municipio_nacimiento: '',
  clasificacion_migratoria: '',
  fecha_salida_cuba: '',
  direccion_actual: '',
  ciudad_actual: '',
  estado_actual: '',
  codigo_postal: '',
  pais_actual: 'Estados Unidos',
  telefono: '',
  email: '',
  centro_trabajo: '',
  profesion: '',
  ocupacion: '',
  direccion_trabajo: '',
  nombre_referencia: '',
  telefono_referencia: '',
  direccion_referencia: '',
  numero_pasaporte_anterior: '',
  fecha_expedicion_anterior: '',
  numero_carnet_identidad: '',
  tomo_acta: '',
  folio_acta: '',
  foto_pasaporte: null,
  firma_digital: null,
  documento_identidad: null,
  acta_nacimiento: null,
  shipping_method: '',
  shipping_price: 0,
  shipping_label: '',
};

const TRAMITE_TYPES = [
  { id: 'pasaporte_primera_vez', label: 'Primera vez', desc: 'Solicitar un pasaporte cubano nuevo', icon: 'document-text', emoji: '🛂' },
  { id: 'renovacion_pasaporte', label: 'Renovación', desc: 'Renovar un pasaporte existente', icon: 'refresh', emoji: '🔄' },
];

const CLASIFICACION_MIGRATORIA = [
  { id: 'pve', label: 'PVE', desc: 'Permiso de Viaje al Exterior', icon: 'airplane-outline' },
  { id: 'pre', label: 'PRE', desc: 'Permiso de Residencia en el Exterior', icon: 'home-outline' },
  { id: 'pvt', label: 'PVT', desc: 'Permiso de Viaje Temporal', icon: 'time-outline' },
  { id: 'psi', label: 'PSI', desc: 'Permiso de Salida Indefinido', icon: 'exit-outline' },
  { id: 'residente_exterior', label: 'Residente', desc: 'Residente en el Exterior', icon: 'globe-outline' },
  { id: 'salida_ilegal', label: 'Salida Ilegal', desc: 'Salida no autorizada', icon: 'alert-circle-outline' },
];

const STEP_INFO = [
  { num: 1, label: 'Trámite', icon: 'clipboard-outline' },
  { num: 2, label: 'Personal', icon: 'person-outline' },
  { num: 3, label: 'Padres', icon: 'people-outline' },
  { num: 4, label: 'Migración', icon: 'airplane-outline' },
  { num: 5, label: 'Residencia', icon: 'home-outline' },
  { num: 6, label: 'Laboral', icon: 'briefcase-outline' },
  { num: 7, label: 'Referencia', icon: 'call-outline' },
  { num: 8, label: 'Envío', icon: 'mail-outline' },
  { num: 9, label: 'Documentos', icon: 'camera-outline' },
];

const C = {
  brand: '#8B1A1A',
  brandLight: '#A63D3D',
  brandSoft: '#FFF1F0',
  bg: '#F2F2F7',
  card: '#FFFFFF',
  text: '#1C1C1E',
  sub: '#636366',
  muted: '#AEAEB2',
  border: '#E5E5EA',
  borderLight: '#F2F2F7',
  success: '#34C759',
  successSoft: '#E8F9ED',
  warning: '#FF9500',
  error: '#FF3B30',
  white: '#FFFFFF',
  inputBg: '#F9F9FB',
};

const TOTAL_STEPS = 9;

// ─── Cuba Provinces & Municipalities Data ───
const CUBA_DATA: Record<string, string[]> = {
  'Pinar del Río': ['Sandino', 'Mantua', 'Minas de Matahambre', 'Viñales', 'La Palma', 'Los Palacios', 'Consolación del Sur', 'Pinar del Río', 'San Luis', 'San Juan y Martínez', 'Guane'],
  'Artemisa': ['Bahía Honda', 'Mariel', 'Guanajay', 'Caimito', 'Bauta', 'San Antonio de los Baños', 'Güira de Melena', 'Alquízar', 'Artemisa', 'Candelaria', 'San Cristóbal'],
  'La Habana': ['Playa', 'Plaza de la Revolución', 'Centro Habana', 'La Habana Vieja', 'Regla', 'La Habana del Este', 'Guanabacoa', 'San Miguel del Padrón', 'Diez de Octubre', 'Cerro', 'Marianao', 'La Lisa', 'Boyeros', 'Arroyo Naranjo', 'Cotorro'],
  'Mayabeque': ['Bejucal', 'San José de las Lajas', 'Jaruco', 'Santa Cruz del Norte', 'Madruga', 'Nueva Paz', 'San Nicolás', 'Güines', 'Melena del Sur', 'Batabanó', 'Quivicán'],
  'Matanzas': ['Matanzas', 'Cárdenas', 'Martí', 'Colón', 'Perico', 'Jovellanos', 'Pedro Betancourt', 'Limonar', 'Unión de Reyes', 'Ciénaga de Zapata', 'Jagüey Grande', 'Calimete', 'Los Arabos'],
  'Villa Clara': ['Corralillo', 'Quemado de Güines', 'Sagua la Grande', 'Encrucijada', 'Camajuaní', 'Caibarién', 'Remedios', 'Placetas', 'Santa Clara', 'Cifuentes', 'Santo Domingo', 'Ranchuelo', 'Manicaragua'],
  'Cienfuegos': ['Aguada de Pasajeros', 'Rodas', 'Palmira', 'Lajas', 'Cruces', 'Cumanayagua', 'Cienfuegos', 'Abreus'],
  'Sancti Spíritus': ['Yaguajay', 'Jatibonico', 'Taguasco', 'Cabaiguán', 'Fomento', 'Trinidad', 'Sancti Spíritus', 'La Sierpe'],
  'Ciego de Ávila': ['Chambas', 'Morón', 'Bolivia', 'Primero de Enero', 'Ciro Redondo', 'Florencia', 'Majagua', 'Ciego de Ávila', 'Venezuela', 'Baraguá'],
  'Camagüey': ['Carlos M. de Céspedes', 'Esmeralda', 'Sierra de Cubitas', 'Minas', 'Nuevitas', 'Guáimaro', 'Sibanicú', 'Camagüey', 'Florida', 'Vertientes', 'Jimaguayú', 'Najasa', 'Santa Cruz del Sur'],
  'Las Tunas': ['Manatí', 'Puerto Padre', 'Jesús Menéndez', 'Majibacoa', 'Las Tunas', 'Jobabo', 'Colombia', 'Amancio'],
  'Holguín': ['Gibara', 'Rafael Freyre', 'Banes', 'Antilla', 'Báguanos', 'Holguín', 'Calixto García', 'Cacocum', 'Urbano Noris', 'Cueto', 'Mayarí', 'Frank País', 'Sagua de Tánamo', 'Moa'],
  'Granma': ['Río Cauto', 'Cauto Cristo', 'Jiguaní', 'Bayamo', 'Yara', 'Manzanillo', 'Campechuela', 'Media Luna', 'Niquero', 'Pilón', 'Bartolomé Masó', 'Buey Arriba', 'Guisa'],
  'Santiago de Cuba': ['Contramaestre', 'Mella', 'San Luis', 'Segundo Frente', 'Songo-La Maya', 'Santiago de Cuba', 'Palma Soriano', 'Tercer Frente', 'Guamá'],
  'Guantánamo': ['El Salvador', 'Manuel Tames', 'Yateras', 'Baracoa', 'Maisí', 'Imías', 'San Antonio del Sur', 'Caimanera', 'Guantánamo', 'Niceto Pérez'],
  'Isla de la Juventud': ['Isla de la Juventud'],
};
const CUBA_PROVINCES = Object.keys(CUBA_DATA);

// ─── Dropdown Selector Component (outside main component for stable identity) ───
const DropdownSelector = React.memo(({ label, value, placeholder, options, onSelect, required, icon }: {
  label: string; value: string; placeholder: string; options: string[];
  onSelect: (val: string) => void; required?: boolean; icon?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = search
    ? options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  return (
    <View style={s.fieldWrap}>
      <Text style={s.label}>{label}{required ? <Text style={{ color: C.brand }}> *</Text> : null}</Text>
      <TouchableOpacity
        style={[s.inputWrap, { justifyContent: 'space-between' }]}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          {icon && <Ionicons name={icon as any} size={18} color={C.muted} style={{ marginRight: 8 }} />}
          <Text style={[{ fontSize: 15, flex: 1 }, value ? { color: C.text } : { color: C.muted }]}>
            {value || placeholder}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={C.muted} />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%' }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: C.text }}>{label}</Text>
              <TouchableOpacity onPress={() => { setOpen(false); setSearch(''); }} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color={C.sub} />
              </TouchableOpacity>
            </View>
            {/* Search */}
            {options.length > 5 && (
              <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.inputBg, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: C.border }}>
                  <Ionicons name="search" size={18} color={C.muted} />
                  <TextInput
                    style={{ flex: 1, paddingVertical: 10, paddingLeft: 8, fontSize: 15, color: C.text }}
                    placeholder="Buscar..."
                    placeholderTextColor={C.muted}
                    value={search}
                    onChangeText={setSearch}
                    autoFocus
                  />
                </View>
              </View>
            )}
            {/* Options */}
            <ScrollView style={{ paddingHorizontal: 8 }} keyboardShouldPersistTaps="handled">
              {filtered.map((opt) => {
                const active = value === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={{
                      flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16,
                      marginHorizontal: 4, marginVertical: 2, borderRadius: 12,
                      backgroundColor: active ? C.brandSoft : 'transparent',
                    }}
                    onPress={() => { onSelect(opt); setOpen(false); setSearch(''); }}
                    activeOpacity={0.6}
                  >
                    <Text style={{ flex: 1, fontSize: 15, color: active ? C.brand : C.text, fontWeight: active ? '600' : '400' }}>
                      {opt}
                    </Text>
                    {active && <Ionicons name="checkmark-circle" size={22} color={C.brand} />}
                  </TouchableOpacity>
                );
              })}
              {filtered.length === 0 && (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ color: C.muted, fontSize: 14 }}>No se encontraron resultados</Text>
                </View>
              )}
              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
});

// ─────────── Extracted Memoized Components (prevent keyboard dismiss) ───────────

const FormInput = React.memo(({ label, value, onChangeText, placeholder, required, keyboardType, autoCapitalize, maxLength, editable, multiline, icon }: any) => (
  <View style={s.fieldWrap}>
    <Text style={s.label}>{label}{required ? <Text style={{ color: C.brand }}> *</Text> : null}</Text>
    <View style={[s.inputWrap, editable === false && s.inputDisabled, multiline && { minHeight: 90 }]}>
      {icon && <Ionicons name={icon} size={18} color={C.muted} style={{ marginRight: 8 }} />}
      <TextInput
        style={[s.inputText, multiline && { textAlignVertical: 'top', minHeight: 70 }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
        editable={editable}
        multiline={multiline}
      />
    </View>
  </View>
));

const ChipGroup = React.memo(({ label, options, value, onSelect }: any) => (
  <View style={s.fieldWrap}>
    <Text style={s.label}>{label}</Text>
    <View style={s.chipRow}>
      {options.map((opt: string) => {
        const active = value === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[s.chip, active && s.chipActive]}
            onPress={() => onSelect(opt)}
            activeOpacity={0.7}
          >
            {active && <Ionicons name="checkmark" size={14} color={C.white} style={{ marginRight: 4 }} />}
            <Text style={[s.chipLabel, active && s.chipLabelActive]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
));

const SectionTitle = React.memo(({ icon, title, subtitle }: any) => (
  <View style={s.sectionHeader}>
    <View style={s.sectionIconCircle}>
      <Ionicons name={icon} size={20} color={C.brand} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={s.sectionTitle}>{title}</Text>
      {subtitle && <Text style={s.sectionSub}>{subtitle}</Text>}
    </View>
  </View>
));

export default function PassportApplicationScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<PassportFormData>(initialFormData);
  const [loading, setLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [shippingRates, setShippingRates] = useState<any[]>([]);
  const [loadingRates, setLoadingRates] = useState(false);
  const [signaturePaths, setSignaturePaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const signatureRef = useRef<View>(null);
  const currentPathRef = useRef<string>('');

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const newPath = `M${locationX},${locationY}`;
        currentPathRef.current = newPath;
        setCurrentPath(newPath);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const updatedPath = `${currentPathRef.current} L${locationX},${locationY}`;
        currentPathRef.current = updatedPath;
        setCurrentPath(updatedPath);
      },
      onPanResponderRelease: () => {
        if (currentPathRef.current) {
          setSignaturePaths(prev => [...prev, currentPathRef.current]);
        }
        currentPathRef.current = '';
        setCurrentPath('');
      },
    })
  ).current;

  const calculatePrice = () => {
    if (!formData.fecha_nacimiento_dia || !formData.fecha_nacimiento_mes || !formData.fecha_nacimiento_año) {
      return 260;
    }
    const birthDate = new Date(
      parseInt(formData.fecha_nacimiento_año),
      parseInt(formData.fecha_nacimiento_mes) - 1,
      parseInt(formData.fecha_nacimiento_dia)
    );
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age < 14 ? 240 : 260;
  };

  useEffect(() => {
    loadDraft();
    loadClientProfile();
  }, []);

  const loadClientProfile = async () => {
    try {
      const response = await api.get('/client-profile');
      const profile = response.data;
      setFormData(prev => {
        const updates: Partial<PassportFormData> = {};
        if (!prev.primer_nombre && profile.first_name) updates.primer_nombre = profile.first_name;
        if (!prev.segundo_nombre && profile.middle_name) updates.segundo_nombre = profile.middle_name;
        if (!prev.primer_apellido && profile.last_name) updates.primer_apellido = profile.last_name;
        if (!prev.segundo_apellido && profile.second_last_name) updates.segundo_apellido = profile.second_last_name;
        if (profile.date_of_birth && !prev.fecha_nacimiento_dia) {
          const parts = profile.date_of_birth.split('-');
          if (parts.length === 3) {
            updates.fecha_nacimiento_año = parts[0];
            updates.fecha_nacimiento_mes = parts[1];
            updates.fecha_nacimiento_dia = parts[2];
          }
        }
        if (!prev.sexo && profile.sex) updates.sexo = profile.sex;
        if (!prev.color_ojos && profile.eye_color) updates.color_ojos = profile.eye_color;
        if (!prev.color_piel && profile.skin_color) updates.color_piel = profile.skin_color;
        if (!prev.color_cabello && profile.hair_color) updates.color_cabello = profile.hair_color;
        if (!prev.estatura && profile.height) updates.estatura = profile.height;
        if (!prev.estado_civil && profile.marital_status) {
          const statusMap: { [key: string]: string } = {
            'single': 'Soltero(a)', 'married': 'Casado(a)',
            'divorced': 'Divorciado(a)', 'widowed': 'Viudo(a)',
          };
          updates.estado_civil = statusMap[profile.marital_status] || profile.marital_status;
        }
        if (!prev.pais_nacimiento && profile.birth_country) updates.pais_nacimiento = profile.birth_country;
        if (!prev.provincia_nacimiento && profile.birth_state) updates.provincia_nacimiento = profile.birth_state;
        if (!prev.municipio_nacimiento && profile.birth_city) updates.municipio_nacimiento = profile.birth_city;
        if (!prev.nombre_padre && profile.father_name) updates.nombre_padre = profile.father_name;
        if (!prev.nombre_madre && profile.mother_name) updates.nombre_madre = profile.mother_name;
        if (profile.address) {
          if (!prev.direccion_actual && profile.address.street)
            updates.direccion_actual = profile.address.street + (profile.address.line2 ? ' ' + profile.address.line2 : '');
          if (!prev.ciudad_actual && profile.address.city) updates.ciudad_actual = profile.address.city;
          if (!prev.estado_actual && profile.address.state) updates.estado_actual = profile.address.state;
          if (!prev.codigo_postal && profile.address.zip_code) updates.codigo_postal = profile.address.zip_code;
        }
        if (!prev.telefono && profile.phone) updates.telefono = profile.phone;
        if (!prev.email && profile.email) updates.email = profile.email;
        if (!prev.ocupacion && profile.occupation) updates.ocupacion = profile.occupation;
        if (!prev.profesion && profile.profession) updates.profesion = profile.profession;
        if (!prev.centro_trabajo && profile.workplace) updates.centro_trabajo = profile.workplace;
        if (!prev.direccion_trabajo && profile.workplace_address) updates.direccion_trabajo = profile.workplace_address;
        if (Object.keys(updates).length > 0) return { ...prev, ...updates };
        return prev;
      });
    } catch (error) {
      // Profile not found
    }
  };

  useFocusEffect(
    useCallback(() => {
      const checkForPassportPhoto = async () => {
        try {
          const photo = await AsyncStorage.getItem('passport_photo_temp');
          if (photo) {
            updateField('foto_pasaporte', photo);
            await AsyncStorage.removeItem('passport_photo_temp');
          }
        } catch (error) {
          console.error('Error loading passport photo:', error);
        }
      };
      checkForPassportPhoto();
    }, [])
  );

  const loadDraft = async () => {
    try {
      const response = await api.get('/passport-applications/draft');
      if (response.data.draft) {
        setFormData(response.data.draft.form_data);
        setDraftId(response.data.draft.id);
        setCurrentStep(response.data.draft.last_step || 1);
        Alert.alert(
          'Borrador encontrado',
          '¿Deseas continuar con tu solicitud anterior?',
          [
            { text: 'Empezar de nuevo', onPress: () => resetForm() },
            { text: 'Continuar', style: 'default' }
          ]
        );
      }
    } catch (error) {}
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setCurrentStep(1);
    setDraftId(null);
  };

  const saveDraft = async () => {
    try {
      setSavingDraft(true);
      const response = await api.post('/passport-applications/draft', {
        form_data: formData,
        last_step: currentStep,
        draft_id: draftId,
      });
      setDraftId(response.data.draft_id);
      Alert.alert('✓ Guardado', 'Tu progreso ha sido guardado');
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar el borrador');
    } finally {
      setSavingDraft(false);
    }
  };

  const updateField = useCallback((field: keyof PassportFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const pickImage = async (field: 'foto_pasaporte' | 'documento_identidad' | 'acta_nacimiento') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: field === 'foto_pasaporte' ? [1, 1] : [4, 3],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      updateField(field, `data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const takePhoto = async (field: 'foto_pasaporte' | 'documento_identidad' | 'acta_nacimiento') => {
    if (field === 'foto_pasaporte') {
      router.push({
        pathname: '/camera-capture',
        params: { type: 'photo_2x2', returnTo: 'passport-application', field: field }
      });
    } else {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true, aspect: [4, 3], quality: 0.8, base64: true,
      });
      if (!result.canceled && result.assets[0].base64) {
        updateField(field, `data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    }
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1: return !!formData.tramite_type;
      case 2: return !!(formData.primer_apellido && formData.primer_nombre &&
                formData.fecha_nacimiento_dia && formData.fecha_nacimiento_mes &&
                formData.fecha_nacimiento_año && formData.sexo);
      case 3: return !!(formData.nombre_padre && formData.nombre_madre && formData.provincia_nacimiento);
      case 4: return !!formData.clasificacion_migratoria;
      case 5: return !!(formData.direccion_actual && formData.ciudad_actual &&
                formData.estado_actual && formData.telefono);
      case 6: return !!(formData.ocupacion);
      case 7: return !!(formData.nombre_referencia && formData.direccion_referencia);
      case 8: return !!formData.shipping_method;
      case 9: return !!(formData.foto_pasaporte && formData.firma_digital);
      default: return true;
    }
  };

  const loadShippingRates = useCallback(async () => {
    if (!formData.codigo_postal || formData.codigo_postal.length < 5) return;
    try {
      setLoadingRates(true);
      const res = await api.post('/usps/labels/passport-rates', { client_zip: formData.codigo_postal });
      if (res.data.success && res.data.rates) {
        setShippingRates(res.data.rates);
        if (!formData.shipping_method && res.data.rates.length > 0) {
          const freeRate = res.data.rates.find((r: any) => r.isFree);
          if (freeRate) {
            setFormData(prev => ({ ...prev, shipping_method: freeRate.mailClass, shipping_price: 0 }));
          }
        }
      }
    } catch (e) {
      console.error('Error loading rates:', e);
    } finally {
      setLoadingRates(false);
    }
  }, [formData.codigo_postal]);

  const nextStep = () => {
    if (!validateStep(currentStep)) {
      Alert.alert('Campos requeridos', 'Por favor completa todos los campos obligatorios');
      return;
    }
    const next = currentStep + 1;
    if (next <= TOTAL_STEPS) {
      setCurrentStep(next);
      if (next === 8) loadShippingRates();
    }
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const submitApplication = async () => {
    if (!validateStep(9)) {
      Alert.alert('Campos requeridos', 'Por favor completa la foto y firma');
      return;
    }
    const totalPrice = calculatePrice() + formData.shipping_price;
    Alert.alert(
      'Confirmar envío',
      `Trámite: $${calculatePrice()}\nEnvío: ${formData.shipping_price > 0 ? '$' + formData.shipping_price.toFixed(2) : 'Gratis'} (${formData.shipping_label})\n\nTotal: $${totalPrice.toFixed(2)}\n\n¿Deseas continuar al pago?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Continuar', onPress: processPayment }
      ]
    );
  };

  const processPayment = async () => {
    try {
      setLoading(true);
      const totalPrice = calculatePrice() + formData.shipping_price;
      const response = await api.post('/passport-applications/submit', {
        form_data: formData, draft_id: draftId, price: totalPrice,
        shipping_method: formData.shipping_method,
        shipping_price: formData.shipping_price,
      });
      if (response.data.success) {
        router.push({
          pathname: '/payment-service',
          params: {
            service_order_id: response.data.order_id,
            amount: totalPrice,
            service_name: 'Solicitud de Pasaporte Cubano',
          }
        });
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo procesar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  const generatePdfPreview = async () => {
    try {
      setGeneratingPdf(true);
      const response = await api.post('/passport-applications/preview-pdf', formData);
      if (response.data.success && response.data.pdf_base64) {
        const filename = `${FileSystem.documentDirectory}solicitud_pasaporte_preview.pdf`;
        await FileSystem.writeAsStringAsync(filename, response.data.pdf_base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(filename, {
            mimeType: 'application/pdf',
            dialogTitle: 'Vista Previa de Solicitud de Pasaporte',
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert('✅ PDF Generado', 'El PDF se ha guardado correctamente.');
        }
      } else {
        throw new Error('No se pudo generar el PDF');
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo generar la vista previa del PDF.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const clearSignature = () => { setSignaturePaths([]); setCurrentPath(''); };

  const saveSignature = async () => {
    if (signaturePaths.length === 0) {
      Alert.alert('Error', 'Por favor firma antes de guardar');
      return;
    }
    try {
      if (signatureRef.current) {
        const uri = await captureRef(signatureRef, { format: 'png', quality: 0.8, result: 'data-uri' });
        updateField('firma_digital', uri);
        setShowSignatureModal(false);
        setSignaturePaths([]);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar la firma');
    }
  };

  // ─────────── Step Renderers ───────────

  const renderStep1 = () => (
    <View>
      <SectionTitle icon="clipboard-outline" title="Tipo de Trámite" subtitle="Selecciona el servicio que necesitas" />
      <View style={{ gap: 12, marginTop: 16 }}>
        {TRAMITE_TYPES.map((type) => {
          const active = formData.tramite_type === type.id;
          return (
            <TouchableOpacity
              key={type.id}
              style={[s.tramiteCard, active && s.tramiteCardActive]}
              onPress={() => updateField('tramite_type', type.id)}
              activeOpacity={0.7}
            >
              <View style={[s.tramiteEmoji, active && { backgroundColor: C.brand }]}>
                <Text style={{ fontSize: 28 }}>{type.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.tramiteLabel, active && { color: C.brand }]}>{type.label}</Text>
                <Text style={s.tramiteDesc}>{type.desc}</Text>
              </View>
              <View style={[s.radioCircle, active && s.radioCircleActive]}>
                {active && <View style={s.radioInner} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View>
      <SectionTitle icon="person-outline" title="Datos Personales" subtitle="Tu información básica" />
      <View style={s.rowFields}>
        <View style={{ flex: 1 }}>
          <FormInput label="Primer Nombre" value={formData.primer_nombre} required
            onChangeText={(v: string) => updateField('primer_nombre', v)} placeholder="Juan" autoCapitalize="words" icon="person-outline" />
        </View>
        <View style={{ flex: 1 }}>
          <FormInput label="Segundo Nombre" value={formData.segundo_nombre}
            onChangeText={(v: string) => updateField('segundo_nombre', v)} placeholder="Carlos" autoCapitalize="words" />
        </View>
      </View>
      <View style={s.rowFields}>
        <View style={{ flex: 1 }}>
          <FormInput label="Primer Apellido" value={formData.primer_apellido} required
            onChangeText={(v: string) => updateField('primer_apellido', v)} placeholder="García" autoCapitalize="words" />
        </View>
        <View style={{ flex: 1 }}>
          <FormInput label="Segundo Apellido" value={formData.segundo_apellido}
            onChangeText={(v: string) => updateField('segundo_apellido', v)} placeholder="López" autoCapitalize="words" />
        </View>
      </View>

      <View style={s.fieldWrap}>
        <Text style={s.label}>Fecha de Nacimiento <Text style={{ color: C.brand }}>*</Text></Text>
        <View style={s.dateRow}>
          <View style={s.datePickerWrap}>
            <Text style={s.datePickerLabel}>Día</Text>
            <Picker selectedValue={formData.fecha_nacimiento_dia}
              onValueChange={(value) => updateField('fecha_nacimiento_dia', value)}
              style={s.datePicker} itemStyle={s.datePickerItem}>
              <Picker.Item label="--" value="" />
              {Array.from({length: 31}, (_, i) => i + 1).map((d) => (
                <Picker.Item key={d} label={String(d)} value={String(d)} />
              ))}
            </Picker>
          </View>
          <View style={[s.datePickerWrap, { flex: 1.5 }]}>
            <Text style={s.datePickerLabel}>Mes</Text>
            <Picker selectedValue={formData.fecha_nacimiento_mes}
              onValueChange={(value) => updateField('fecha_nacimiento_mes', value)}
              style={s.datePicker} itemStyle={s.datePickerItem}>
              <Picker.Item label="--" value="" />
              {['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'].map((m, i) => (
                <Picker.Item key={i} label={m} value={String(i + 1)} />
              ))}
            </Picker>
          </View>
          <View style={s.datePickerWrap}>
            <Text style={s.datePickerLabel}>Año</Text>
            <Picker selectedValue={formData.fecha_nacimiento_año}
              onValueChange={(value) => updateField('fecha_nacimiento_año', value)}
              style={s.datePicker} itemStyle={s.datePickerItem}>
              <Picker.Item label="--" value="" />
              {Array.from({length: 100}, (_, i) => new Date().getFullYear() - i).map((y) => (
                <Picker.Item key={y} label={String(y)} value={String(y)} />
              ))}
            </Picker>
          </View>
        </View>
      </View>

      <View style={s.fieldWrap}>
        <Text style={s.label}>Sexo <Text style={{ color: C.brand }}>*</Text></Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {[{ val: 'M', label: 'Masculino', icon: 'male' }, { val: 'F', label: 'Femenino', icon: 'female' }].map((opt) => {
            const active = formData.sexo === opt.val;
            return (
              <TouchableOpacity key={opt.val} style={[s.genderBtn, active && s.genderBtnActive]} onPress={() => updateField('sexo', opt.val)}>
                <Ionicons name={opt.icon as any} size={20} color={active ? C.white : C.sub} />
                <Text style={[s.genderLabel, active && { color: C.white }]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ChipGroup label="Color de Ojos" options={['Claros', 'Negros', 'Pardos']} value={formData.color_ojos} onSelect={(v: string) => updateField('color_ojos', v)} />
      <ChipGroup label="Color de Piel" options={['Blanca', 'Mestiza', 'Negra', 'Amarilla']} value={formData.color_piel} onSelect={(v: string) => updateField('color_piel', v)} />
      <ChipGroup label="Color de Cabello" options={['Negro', 'Castaño', 'Rubio', 'Canoso', 'Rojo']} value={formData.color_cabello} onSelect={(v: string) => updateField('color_cabello', v)} />

      <View style={s.rowFields}>
        <View style={{ width: 110 }}>
          <FormInput label="Estatura (cm)" value={formData.estatura}
            onChangeText={(v: string) => updateField('estatura', v)} placeholder="170" keyboardType="numeric" />
        </View>
        <View style={{ flex: 1 }}>
          <ChipGroup label="Estado Civil" options={['Soltero', 'Casado', 'Divorciado', 'Viudo']} value={formData.estado_civil} onSelect={(v: string) => updateField('estado_civil', v)} />
        </View>
      </View>
    </View>
  );

  const handleProvinciaChange = useCallback((provincia: string) => {
    updateField('provincia_nacimiento', provincia);
    updateField('municipio_nacimiento', '');
  }, [updateField]);

  const municipiosDisponibles = formData.provincia_nacimiento
    ? CUBA_DATA[formData.provincia_nacimiento] || []
    : [];

  const renderStep3 = () => (
    <View>
      <SectionTitle icon="people-outline" title="Padres y Nacimiento" subtitle="Información familiar y de origen" />
      <FormInput label="Nombre completo del Padre" value={formData.nombre_padre} required icon="person-outline"
        onChangeText={(v: string) => updateField('nombre_padre', v)} placeholder="Nombres y apellidos" autoCapitalize="words" />
      <FormInput label="Nombre completo de la Madre" value={formData.nombre_madre} required icon="person-outline"
        onChangeText={(v: string) => updateField('nombre_madre', v)} placeholder="Nombres y apellidos" autoCapitalize="words" />

      <View style={s.divider}><Text style={s.dividerText}>Lugar de Nacimiento</Text></View>

      <FormInput label="País" value={formData.pais_nacimiento} editable={false} icon="flag-outline" />
      <View style={s.rowFields}>
        <View style={{ flex: 1 }}>
          <DropdownSelector
            label="Provincia"
            value={formData.provincia_nacimiento}
            placeholder="Seleccionar..."
            options={CUBA_PROVINCES}
            onSelect={handleProvinciaChange}
            required
            icon="map-outline"
          />
        </View>
        <View style={{ flex: 1 }}>
          <DropdownSelector
            label="Municipio"
            value={formData.municipio_nacimiento}
            placeholder={formData.provincia_nacimiento ? 'Seleccionar...' : 'Elige provincia'}
            options={municipiosDisponibles}
            onSelect={(v: string) => updateField('municipio_nacimiento', v)}
            icon="locate-outline"
          />
        </View>
      </View>
    </View>
  );

  const renderStep4 = () => (
    <View>
      <SectionTitle icon="airplane-outline" title="Clasificación Migratoria" subtitle="¿Cómo saliste de Cuba?" />
      <View style={{ gap: 10, marginTop: 12 }}>
        {CLASIFICACION_MIGRATORIA.map((opt) => {
          const active = formData.clasificacion_migratoria === opt.id;
          return (
            <TouchableOpacity key={opt.id} style={[s.migrCard, active && s.migrCardActive]} onPress={() => updateField('clasificacion_migratoria', opt.id)} activeOpacity={0.7}>
              <View style={[s.migrIcon, active && { backgroundColor: C.successSoft }]}>
                <Ionicons name={opt.icon as any} size={20} color={active ? C.success : C.sub} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.migrLabel, active && { color: C.text, fontWeight: '700' }]}>{opt.label}</Text>
                <Text style={s.migrDesc}>{opt.desc}</Text>
              </View>
              <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={active ? C.success : C.border} />
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={{ marginTop: 16 }}>
        <FormInput label="Fecha de salida de Cuba" value={formData.fecha_salida_cuba}
          onChangeText={(v: string) => updateField('fecha_salida_cuba', v)} placeholder="DD/MM/AAAA" keyboardType="numeric" icon="calendar-outline" />
      </View>
    </View>
  );

  const autoCompleteFromZip = useCallback(async (zip: string) => {
    try {
      const res = await api.get(`/usps/zipcode/citystate/${zip}`);
      if (res.data && res.data.city && res.data.state) {
        setFormData(prev => ({ ...prev, ciudad_actual: res.data.city, estado_actual: res.data.state }));
      }
    } catch (e) {
      const prefix = zip.substring(0, 3);
      const stateByPrefix: Record<string, string> = {
        '330': 'FL', '331': 'FL', '332': 'FL', '333': 'FL',
        '790': 'TX', '791': 'TX', '792': 'TX', '793': 'TX',
        '100': 'NY', '101': 'NY', '900': 'CA', '901': 'CA', '770': 'TX',
      };
      if (stateByPrefix[prefix]) {
        setFormData(prev => ({ ...prev, estado_actual: stateByPrefix[prefix] }));
      }
    }
  }, []);

  const handleZipChange = useCallback((value: string) => {
    setFormData(prev => ({ ...prev, codigo_postal: value }));
    if (value.length === 5) {
      setTimeout(() => autoCompleteFromZip(value), 50);
    }
  }, [autoCompleteFromZip]);

  const renderStep5 = () => (
    <View>
      <SectionTitle icon="home-outline" title="Residencia Actual" subtitle="Tu dirección en EE.UU." />
      <FormInput label="Dirección" value={formData.direccion_actual} required icon="location-outline"
        onChangeText={(v: string) => updateField('direccion_actual', v)} placeholder="Calle, número, apartamento" />
      <View style={s.rowFields}>
        <View style={{ flex: 1 }}>
          <FormInput label="Código Postal" value={formData.codigo_postal}
            onChangeText={handleZipChange} placeholder="79029" keyboardType="numeric" maxLength={5} icon="mail-outline" />
        </View>
        <View style={{ flex: 1 }}>
          <FormInput label="País" value={formData.pais_actual} editable={false} icon="flag-outline" />
        </View>
      </View>
      <View style={s.rowFields}>
        <View style={{ flex: 1 }}>
          <FormInput label="Ciudad" value={formData.ciudad_actual} required
            onChangeText={(v: string) => updateField('ciudad_actual', v)} placeholder="Se llena con el ZIP" />
        </View>
        <View style={{ flex: 1 }}>
          <FormInput label="Estado" value={formData.estado_actual} required
            onChangeText={(v: string) => updateField('estado_actual', v)} placeholder="TX" autoCapitalize="characters" maxLength={2} />
        </View>
      </View>
      <FormInput label="Teléfono" value={formData.telefono} required icon="call-outline"
        onChangeText={(v: string) => updateField('telefono', v)} placeholder="(555) 123-4567" keyboardType="phone-pad" />
      <FormInput label="Email" value={formData.email} icon="mail-outline"
        onChangeText={(v: string) => updateField('email', v)} placeholder="correo@ejemplo.com" keyboardType="email-address" autoCapitalize="none" />
    </View>
  );

  const renderStep6 = () => (
    <View>
      <SectionTitle icon="briefcase-outline" title="Datos Laborales" subtitle='Si no trabajas, escribe "Desempleado"' />
      <FormInput label="Centro de Trabajo/Estudio" value={formData.centro_trabajo} icon="business-outline"
        onChangeText={(v: string) => updateField('centro_trabajo', v)} placeholder="Nombre de la empresa o N/A" />
      <View style={s.rowFields}>
        <View style={{ flex: 1 }}>
          <FormInput label="Profesión" value={formData.profesion}
            onChangeText={(v: string) => updateField('profesion', v)} placeholder="Ingeniero" />
        </View>
        <View style={{ flex: 1 }}>
          <FormInput label="Ocupación" value={formData.ocupacion} required
            onChangeText={(v: string) => updateField('ocupacion', v)} placeholder="Desempleado" />
        </View>
      </View>
      <FormInput label="Dirección del trabajo" value={formData.direccion_trabajo} icon="location-outline"
        onChangeText={(v: string) => updateField('direccion_trabajo', v)} placeholder="Dirección completa o N/A" />
    </View>
  );

  const renderStep7 = () => (
    <View>
      <SectionTitle icon="call-outline" title="Referencia en Cuba" subtitle="Persona que puede verificar tus datos" />
      <FormInput label="Nombre completo" value={formData.nombre_referencia} required icon="person-outline"
        onChangeText={(v: string) => updateField('nombre_referencia', v)} placeholder="Nombres y apellidos" autoCapitalize="words" />
      <FormInput label="Teléfono de contacto" value={formData.telefono_referencia} icon="call-outline"
        onChangeText={(v: string) => updateField('telefono_referencia', v)} placeholder="+53 5 XXX XXXX" keyboardType="phone-pad" />
      <FormInput label="Dirección en Cuba" value={formData.direccion_referencia} required icon="location-outline" multiline
        onChangeText={(v: string) => updateField('direccion_referencia', v)} placeholder="Dirección completa incluyendo provincia" />

      <View style={s.divider}><Text style={s.dividerText}>Documentos Anteriores (opcional)</Text></View>

      <View style={s.rowFields}>
        <View style={{ flex: 1 }}>
          <FormInput label="No. Pasaporte anterior" value={formData.numero_pasaporte_anterior}
            onChangeText={(v: string) => updateField('numero_pasaporte_anterior', v)} placeholder="A123456" autoCapitalize="characters" />
        </View>
        <View style={{ flex: 1 }}>
          <FormInput label="Carné de Identidad" value={formData.numero_carnet_identidad}
            onChangeText={(v: string) => updateField('numero_carnet_identidad', v)} placeholder="12345678901" keyboardType="numeric" maxLength={11} />
        </View>
      </View>
    </View>
  );

  const renderStep8 = () => (
    <View>
      <SectionTitle icon="mail-outline" title="Envío del Pasaporte" subtitle="Selecciona la velocidad de envío" />

      {/* Route visualization */}
      <View style={{ backgroundColor: C.inputBg, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.border }}>
        {/* IDA */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 16 }}>📤</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: C.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>Ida — Tú envías tus documentos</Text>
            <Text style={{ fontSize: 13, color: C.text, fontWeight: '600', marginTop: 2 }}>
              {formData.ciudad_actual || 'Tu ciudad'}, {formData.estado_actual || '--'} → Dumas, TX
            </Text>
          </View>
          <View style={{ backgroundColor: C.success, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
            <Text style={{ fontSize: 9, fontWeight: '700', color: C.white }}>INCLUIDO</Text>
          </View>
        </View>

        <View style={{ height: 1, backgroundColor: C.border, marginLeft: 46 }} />

        {/* RETORNO */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 16 }}>📥</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: C.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>Retorno — Recibe tu pasaporte</Text>
            <Text style={{ fontSize: 13, color: C.text, fontWeight: '600', marginTop: 2 }}>
              Dumas, TX → {formData.ciudad_actual || 'Tu ciudad'}, {formData.estado_actual || '--'}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={16} color={C.brand} />
        </View>
      </View>

      {/* Shipping speed selection */}
      <Text style={[s.label, { marginBottom: 10 }]}>Velocidad de retorno del pasaporte</Text>

      {loadingRates ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={C.brand} />
          <Text style={{ color: C.sub, marginTop: 12, fontSize: 14 }}>Consultando tarifas USPS...</Text>
        </View>
      ) : shippingRates.length > 0 ? (
        <View style={{ gap: 10 }}>
          {shippingRates.map((rate) => {
            const active = formData.shipping_method === rate.mailClass;
            return (
              <TouchableOpacity
                key={rate.mailClass}
                style={[s.migrCard, active && s.migrCardActive, rate.isFree && active && { borderColor: C.success }]}
                onPress={() => {
                  setFormData(prev => ({
                    ...prev,
                    shipping_method: rate.mailClass,
                    shipping_price: rate.clientPrice,
                    shipping_label: rate.displayName,
                  }));
                }}
                activeOpacity={0.7}
              >
                <View style={[s.migrIcon, active && { backgroundColor: rate.isFree ? C.successSoft : C.brandSoft }]}>
                  <Text style={{ fontSize: 22 }}>{rate.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[s.migrLabel, active && { fontWeight: '700' }]}>{rate.displayName}</Text>
                    {rate.isFree && (
                      <View style={{ backgroundColor: C.success, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: C.white }}>GRATIS</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.migrDesc}>{rate.deliveryTime}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {rate.isFree ? (
                    <Text style={{ fontSize: 16, fontWeight: '800', color: C.success }}>$0</Text>
                  ) : (
                    <Text style={{ fontSize: 16, fontWeight: '800', color: C.brand }}>${rate.clientPrice.toFixed(2)}</Text>
                  )}
                  <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={active ? (rate.isFree ? C.success : C.brand) : C.border} style={{ marginTop: 4 }} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <View style={{ padding: 30, alignItems: 'center' }}>
          <Ionicons name="alert-circle-outline" size={36} color={C.muted} />
          <Text style={{ color: C.sub, marginTop: 8, textAlign: 'center', fontSize: 13 }}>No se pudieron cargar las tarifas. Verifica tu código postal en el paso 5.</Text>
          <TouchableOpacity onPress={loadShippingRates} style={{ marginTop: 12, paddingVertical: 8, paddingHorizontal: 20, backgroundColor: C.brandSoft, borderRadius: 10 }}>
            <Text style={{ color: C.brand, fontWeight: '600' }}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Note */}
      <View style={{ backgroundColor: '#FFFBEB', borderRadius: 12, padding: 12, marginTop: 16, flexDirection: 'row', gap: 8 }}>
        <Ionicons name="bulb-outline" size={18} color="#D97706" />
        <Text style={{ fontSize: 12, color: '#92400E', flex: 1 }}>
          Se generarán 2 etiquetas de envío (ida y retorno) con tu dirección y la de Ross Tax. Las recibirás junto con la confirmación de tu orden.
        </Text>
      </View>
    </View>
  );

  const renderStep9 = () => (
    <View>
      <SectionTitle icon="camera-outline" title="Documentos y Firma" subtitle="Foto, firma y documentos de apoyo" />

      {/* Passport Photo */}
      <View style={s.uploadCard}>
        <View style={s.uploadCardHeader}>
          <View style={[s.uploadIcon, { backgroundColor: '#FFF3E0' }]}>
            <Text style={{ fontSize: 20 }}>📷</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.uploadCardTitle}>Foto de Pasaporte <Text style={{ color: C.brand }}>*</Text></Text>
            <Text style={s.uploadCardHint}>Fondo claro, de frente, sin lentes</Text>
          </View>
        </View>
        {formData.foto_pasaporte ? (
          <View style={s.previewWrap}>
            <Image source={{ uri: formData.foto_pasaporte }} style={s.photoPreview} />
            <TouchableOpacity style={s.removeBtn} onPress={() => updateField('foto_pasaporte', null as any)}>
              <Ionicons name="close-circle" size={26} color={C.error} />
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <View style={s.photoGuide}>
              <Svg width="80" height="100" viewBox="0 0 120 150">
                <Path d="M60 10 C35 10, 25 35, 25 55 C25 75, 35 90, 60 90 C85 90, 95 75, 95 55 C95 35, 85 10, 60 10" fill="none" stroke={C.brand} strokeWidth="2" strokeDasharray="5,5" opacity={0.4} />
                <Path d="M20 150 C20 120, 35 100, 60 100 C85 100, 100 120, 100 150" fill="none" stroke={C.brand} strokeWidth="2" strokeDasharray="5,5" opacity={0.4} />
              </Svg>
            </View>
            <View style={s.uploadActions}>
              <TouchableOpacity style={s.uploadActionBtn} onPress={() => takePhoto('foto_pasaporte')}>
                <Ionicons name="camera-outline" size={20} color={C.brand} />
                <Text style={s.uploadActionText}>Cámara</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.uploadActionBtn} onPress={() => pickImage('foto_pasaporte')}>
                <Ionicons name="images-outline" size={20} color={C.brand} />
                <Text style={s.uploadActionText}>Galería</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Digital Signature */}
      <View style={s.uploadCard}>
        <View style={s.uploadCardHeader}>
          <View style={[s.uploadIcon, { backgroundColor: '#E8EAF6' }]}>
            <Text style={{ fontSize: 20 }}>✍️</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.uploadCardTitle}>Firma Digital <Text style={{ color: C.brand }}>*</Text></Text>
            <Text style={s.uploadCardHint}>Firma con tu dedo en pantalla</Text>
          </View>
        </View>
        {formData.firma_digital ? (
          <View style={s.previewWrap}>
            <Image source={{ uri: formData.firma_digital }} style={s.sigPreview} />
            <TouchableOpacity style={s.removeBtn} onPress={() => updateField('firma_digital', null as any)}>
              <Ionicons name="close-circle" size={26} color={C.error} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={s.signatureArea} onPress={() => setShowSignatureModal(true)}>
            <Ionicons name="create-outline" size={28} color={C.brand} />
            <Text style={s.signatureAreaText}>Toca para firmar</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Previous Passport */}
      <View style={s.uploadCard}>
        <View style={s.uploadCardHeader}>
          <View style={[s.uploadIcon, { backgroundColor: '#E0F7FA' }]}>
            <Text style={{ fontSize: 20 }}>📄</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.uploadCardTitle}>Pasaporte Anterior</Text>
            <Text style={s.uploadCardHint}>Escanea si lo tienes (opcional)</Text>
          </View>
        </View>
        {formData.documento_identidad ? (
          <View style={[s.previewWrap, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
            <Ionicons name="checkmark-circle" size={24} color={C.success} />
            <Text style={{ color: C.success, fontWeight: '600', flex: 1 }}>Documento cargado</Text>
            <TouchableOpacity onPress={() => updateField('documento_identidad', null as any)}>
              <Ionicons name="close-circle" size={24} color={C.error} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.uploadActions}>
            <TouchableOpacity style={s.uploadActionBtn} onPress={() => takePhoto('documento_identidad')}>
              <Ionicons name="scan-outline" size={20} color={C.brand} />
              <Text style={s.uploadActionText}>Escanear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.uploadActionBtn} onPress={() => pickImage('documento_identidad')}>
              <Ionicons name="images-outline" size={20} color={C.brand} />
              <Text style={s.uploadActionText}>Galería</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Birth Certificate */}
      <View style={s.uploadCard}>
        <View style={s.uploadCardHeader}>
          <View style={[s.uploadIcon, { backgroundColor: '#FFF8E1' }]}>
            <Text style={{ fontSize: 20 }}>📜</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.uploadCardTitle}>Acta de Nacimiento</Text>
            <Text style={s.uploadCardHint}>Certificación de nacimiento (opcional)</Text>
          </View>
        </View>
        {formData.acta_nacimiento ? (
          <View style={[s.previewWrap, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
            <Ionicons name="checkmark-circle" size={24} color={C.success} />
            <Text style={{ color: C.success, fontWeight: '600', flex: 1 }}>Documento cargado</Text>
            <TouchableOpacity onPress={() => updateField('acta_nacimiento', null as any)}>
              <Ionicons name="close-circle" size={24} color={C.error} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.uploadActions}>
            <TouchableOpacity style={s.uploadActionBtn} onPress={() => takePhoto('acta_nacimiento')}>
              <Ionicons name="scan-outline" size={20} color={C.brand} />
              <Text style={s.uploadActionText}>Escanear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.uploadActionBtn} onPress={() => pickImage('acta_nacimiento')}>
              <Ionicons name="images-outline" size={20} color={C.brand} />
              <Text style={s.uploadActionText}>Galería</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Price Summary */}
      <View style={s.priceCard}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Ionicons name="receipt-outline" size={20} color={C.brand} />
            <Text style={s.priceLabel}>Resumen de costos</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontSize: 13, color: C.sub }}>Trámite pasaporte</Text>
            <Text style={{ fontSize: 13, color: C.text, fontWeight: '600' }}>${calculatePrice()}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontSize: 13, color: C.sub }}>Envío ({formData.shipping_label || 'No seleccionado'})</Text>
            <Text style={{ fontSize: 13, color: formData.shipping_price > 0 ? C.text : C.success, fontWeight: '600' }}>
              {formData.shipping_price > 0 ? `$${formData.shipping_price.toFixed(2)}` : 'Gratis'}
            </Text>
          </View>
          <View style={{ borderTopWidth: 1, borderTopColor: C.border, marginTop: 6, paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>Total</Text>
            <Text style={s.priceAmount}>${(calculatePrice() + formData.shipping_price).toFixed(2)}</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      case 6: return renderStep6();
      case 7: return renderStep7();
      case 8: return renderStep8();
      case 9: return renderStep9();
      default: return null;
    }
  };

  // ─────────── Main Return ───────────

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Solicitud de Pasaporte</Text>
          <View style={s.stepBadge}>
            <Text style={s.stepBadgeText}>Paso {currentStep} de {TOTAL_STEPS}</Text>
          </View>
        </View>
        <TouchableOpacity style={s.headerBtn} onPress={saveDraft} disabled={savingDraft}>
          {savingDraft ? <ActivityIndicator size="small" color={C.brand} /> : <Ionicons name="bookmark-outline" size={22} color={C.brand} />}
        </TouchableOpacity>
      </View>

      {/* Progress Steps */}
      <View style={s.progressWrap}>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${(currentStep / TOTAL_STEPS) * 100}%` }]} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.stepsRow}>
          {STEP_INFO.map((step) => {
            const done = step.num < currentStep;
            const active = step.num === currentStep;
            return (
              <TouchableOpacity key={step.num} style={s.stepItem} onPress={() => {
                if (step.num < currentStep) setCurrentStep(step.num);
              }} activeOpacity={0.7}>
                <View style={[s.stepDot, done && s.stepDotDone, active && s.stepDotActive]}>
                  {done ? (
                    <Ionicons name="checkmark" size={12} color={C.white} />
                  ) : (
                    <Text style={[s.stepDotNum, active && { color: C.white }]}>{step.num}</Text>
                  )}
                </View>
                <Text style={[s.stepLabel, (done || active) && { color: C.brand, fontWeight: '600' }]} numberOfLines={1}>
                  {step.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Content */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={s.card}>
            {renderCurrentStep()}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer Navigation */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        {currentStep > 1 ? (
          <TouchableOpacity style={s.footerBtnSec} onPress={prevStep}>
            <Ionicons name="chevron-back" size={18} color={C.sub} />
            <Text style={s.footerBtnSecText}>Anterior</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 100 }} />}

        {currentStep < TOTAL_STEPS ? (
          <TouchableOpacity style={s.footerBtnPrimary} onPress={nextStep} activeOpacity={0.8}>
            <Text style={s.footerBtnPrimaryText}>Siguiente</Text>
            <Ionicons name="chevron-forward" size={18} color={C.white} />
          </TouchableOpacity>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={s.footerBtnSec} onPress={generatePdfPreview} disabled={generatingPdf}>
              {generatingPdf ? <ActivityIndicator color={C.brand} /> : (
                <>
                  <Ionicons name="document-text-outline" size={18} color={C.brand} />
                  <Text style={[s.footerBtnSecText, { color: C.brand }]}>PDF</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={[s.footerBtnPrimary, { backgroundColor: C.success, paddingHorizontal: 24 }]} onPress={submitApplication} disabled={loading}>
              {loading ? <ActivityIndicator color={C.white} /> : (
                <>
                  <Text style={s.footerBtnPrimaryText}>Pagar ${(calculatePrice() + formData.shipping_price).toFixed(2)}</Text>
                  <Ionicons name="card-outline" size={18} color={C.white} />
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Signature Modal */}
      <Modal visible={showSignatureModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.signatureModal}>
            <View style={s.sigModalHeader}>
              <Text style={s.sigModalTitle}>Firma Digital</Text>
              <TouchableOpacity onPress={() => setShowSignatureModal(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={26} color={C.text} />
              </TouchableOpacity>
            </View>
            <Text style={s.sigModalHint}>Firma con tu dedo en el área blanca</Text>
            <View ref={signatureRef} style={s.sigCanvas} collapsable={false}>
              <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers}>
                <Svg width="100%" height="100%">
                  {signaturePaths.map((path, index) => (
                    <Path key={index} d={path} stroke="#000" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  ))}
                  {currentPath && <Path d={currentPath} stroke="#000" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
                </Svg>
              </View>
              {signaturePaths.length === 0 && !currentPath && (
                <View style={s.sigPlaceholder} pointerEvents="none">
                  <Ionicons name="pencil-outline" size={24} color={C.muted} />
                  <Text style={{ color: C.muted, marginTop: 8 }}>Firma aquí</Text>
                </View>
              )}
            </View>
            <View style={s.sigModalBtns}>
              <TouchableOpacity style={s.sigClearBtn} onPress={clearSignature}>
                <Text style={{ color: C.sub, fontWeight: '600' }}>Limpiar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.sigSaveBtn} onPress={saveSignature}>
                <Text style={{ color: C.white, fontWeight: '700' }}>Guardar Firma</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─────────── Styles ───────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10,
    backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: C.borderLight,
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.text, letterSpacing: -0.3 },
  stepBadge: {
    marginTop: 3, backgroundColor: C.brandSoft, paddingHorizontal: 10, paddingVertical: 2,
    borderRadius: 10,
  },
  stepBadgeText: { fontSize: 11, fontWeight: '600', color: C.brand },

  // Progress
  progressWrap: { backgroundColor: C.white, paddingBottom: 8 },
  progressTrack: {
    height: 3, backgroundColor: C.borderLight, marginHorizontal: 16, borderRadius: 2,
  },
  progressFill: { height: '100%', backgroundColor: C.brand, borderRadius: 2 },
  stepsRow: { flexDirection: 'row', paddingHorizontal: 8, paddingTop: 10 },
  stepItem: { alignItems: 'center', width: (width - 16) / 8, paddingHorizontal: 2 },
  stepDot: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: C.borderLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  stepDotDone: { backgroundColor: C.brand },
  stepDotActive: { backgroundColor: C.brand, ...Platform.select({ ios: { shadowColor: C.brand, shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 4 } }) },
  stepDotNum: { fontSize: 11, fontWeight: '700', color: C.muted },
  stepLabel: { fontSize: 9, color: C.muted, textAlign: 'center' },

  // Content
  scrollContent: { padding: 16, paddingBottom: 30 },
  card: {
    backgroundColor: C.card, borderRadius: 20, padding: 20,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 3 } }),
  },

  // Section
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  sectionIconCircle: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: C.brandSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: C.text },
  sectionSub: { fontSize: 13, color: C.sub, marginTop: 2 },

  // Step 1 - Tramite Cards
  tramiteCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16,
    backgroundColor: C.inputBg, borderRadius: 16, borderWidth: 2, borderColor: 'transparent',
  },
  tramiteCardActive: { borderColor: C.brand, backgroundColor: C.brandSoft },
  tramiteEmoji: {
    width: 52, height: 52, borderRadius: 16, backgroundColor: C.borderLight,
    alignItems: 'center', justifyContent: 'center',
  },
  tramiteLabel: { fontSize: 16, fontWeight: '700', color: C.text },
  tramiteDesc: { fontSize: 12, color: C.sub, marginTop: 2 },
  radioCircle: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioCircleActive: { borderColor: C.brand },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.brand },

  // Fields
  fieldWrap: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: C.sub, marginBottom: 6, letterSpacing: -0.2 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.inputBg,
    borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: C.border,
    minHeight: 48,
  },
  inputText: { flex: 1, fontSize: 15, color: C.text, paddingVertical: Platform.OS === 'ios' ? 12 : 8 },
  inputDisabled: { backgroundColor: '#EDEDF0' },
  rowFields: { flexDirection: 'row', gap: 10 },

  // Date picker
  dateRow: { flexDirection: 'row', gap: 8, backgroundColor: C.inputBg, borderRadius: 12, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  datePickerWrap: { flex: 1, alignItems: 'center' },
  datePickerLabel: { fontSize: 10, fontWeight: '600', color: C.muted, paddingTop: 6 },
  datePicker: { width: '100%', height: 48 },
  datePickerItem: { fontSize: 15, height: 48 },

  // Gender
  genderBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, backgroundColor: C.inputBg, borderRadius: 12, borderWidth: 1, borderColor: C.border,
  },
  genderBtnActive: { backgroundColor: C.brand, borderColor: C.brand },
  genderLabel: { fontSize: 14, fontWeight: '600', color: C.text },

  // Chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: C.inputBg, borderRadius: 20, borderWidth: 1, borderColor: C.border,
  },
  chipActive: { backgroundColor: C.brand, borderColor: C.brand },
  chipLabel: { fontSize: 13, fontWeight: '500', color: C.text },
  chipLabelActive: { color: C.white },

  // Migration cards
  migrCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    backgroundColor: C.inputBg, borderRadius: 14, borderWidth: 1.5, borderColor: 'transparent',
  },
  migrCardActive: { backgroundColor: C.successSoft, borderColor: C.success },
  migrIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: C.borderLight,
    alignItems: 'center', justifyContent: 'center',
  },
  migrLabel: { fontSize: 14, fontWeight: '600', color: C.text },
  migrDesc: { fontSize: 11, color: C.sub, marginTop: 1 },

  // Divider
  divider: { marginTop: 20, marginBottom: 14, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 14 },
  dividerText: { fontSize: 14, fontWeight: '700', color: C.brand },

  // Upload
  uploadCard: {
    marginBottom: 16, padding: 16, backgroundColor: C.inputBg, borderRadius: 16,
    borderWidth: 1, borderColor: C.border,
  },
  uploadCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  uploadIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  uploadCardTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  uploadCardHint: { fontSize: 11, color: C.muted, marginTop: 1 },
  uploadActions: { flexDirection: 'row', gap: 10 },
  uploadActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, backgroundColor: C.white, borderRadius: 12, borderWidth: 1, borderColor: C.brand,
  },
  uploadActionText: { fontSize: 13, fontWeight: '600', color: C.brand },
  previewWrap: { alignItems: 'center', position: 'relative' },
  photoPreview: { width: 130, height: 130, borderRadius: 12, backgroundColor: C.borderLight },
  removeBtn: { position: 'absolute', top: -8, right: (width - 130) / 2 - 60, backgroundColor: C.white, borderRadius: 13 },
  photoGuide: {
    alignItems: 'center', marginBottom: 14, paddingVertical: 12, backgroundColor: C.white,
    borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: C.border,
  },

  // Signature
  signatureArea: {
    alignItems: 'center', justifyContent: 'center', paddingVertical: 24,
    backgroundColor: C.white, borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', borderColor: C.brand,
  },
  signatureAreaText: { fontSize: 13, color: C.brand, marginTop: 6, fontWeight: '600' },
  sigPreview: { width: 180, height: 70, borderRadius: 8, backgroundColor: C.white },

  // Price
  priceCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 18, backgroundColor: C.brandSoft, borderRadius: 16, marginTop: 4,
  },
  priceLabel: { fontSize: 16, fontWeight: '600', color: C.text },
  priceAmount: { fontSize: 26, fontWeight: '800', color: C.brand },

  // Footer
  footer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, backgroundColor: C.white,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  footerBtnSec: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: 14, backgroundColor: C.borderLight,
  },
  footerBtnSecText: { fontSize: 14, fontWeight: '600', color: C.sub },
  footerBtnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: 14, backgroundColor: C.brand,
  },
  footerBtnPrimaryText: { fontSize: 15, fontWeight: '700', color: C.white },

  // Signature Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  signatureModal: { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  sigModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sigModalTitle: { fontSize: 18, fontWeight: '700', color: C.text },
  sigModalHint: { fontSize: 13, color: C.sub, marginBottom: 14 },
  sigCanvas: {
    height: 200, backgroundColor: C.white, borderRadius: 14, borderWidth: 2,
    borderColor: C.border, overflow: 'hidden', position: 'relative',
  },
  sigPlaceholder: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  sigModalBtns: { flexDirection: 'row', gap: 12, marginTop: 18 },
  sigClearBtn: {
    flex: 1, padding: 14, backgroundColor: C.borderLight, borderRadius: 12, alignItems: 'center',
  },
  sigSaveBtn: {
    flex: 2, padding: 14, backgroundColor: C.brand, borderRadius: 12, alignItems: 'center',
  },
});
