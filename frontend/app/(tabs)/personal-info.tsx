/**
 * Premium Profile — Compact Modern Design
 * 2-step wizard: Mi Cuenta → Perfil Fiscal
 * Redesigned for minimal scrolling and modern look
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useThemeColors } from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';
import CustomHeader from '../../components/CustomHeader';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';
import Svg, { Circle } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Options ────────────────────────────────────────────────────────────────
const SEX_OPTIONS = [
  { value: 'M', labelKey: 'personalInfo.sex.male', icon: 'male' },
  { value: 'F', labelKey: 'personalInfo.sex.female', icon: 'female' },
];

const MARITAL_STATUS_OPTIONS = [
  { value: 'single', labelKey: 'personalInfo.maritalStatus.single', icon: 'person' },
  { value: 'married', labelKey: 'personalInfo.maritalStatus.married', icon: 'people' },
  { value: 'divorced', labelKey: 'personalInfo.maritalStatus.divorced', icon: 'git-branch' },
  { value: 'widowed', labelKey: 'personalInfo.maritalStatus.widowed', icon: 'heart-dislike' },
];

const FILING_STATUS_OPTIONS = [
  { value: 'single', labelKey: 'personalInfo.filingStatus.single' },
  { value: 'married_jointly', labelKey: 'personalInfo.filingStatus.marriedJointly' },
  { value: 'married_separately', labelKey: 'personalInfo.filingStatus.marriedSeparately' },
  { value: 'head_of_household', labelKey: 'personalInfo.filingStatus.headOfHousehold' },
  { value: 'qualifying_widow', labelKey: 'personalInfo.filingStatus.qualifyingWidow' },
];

const EYE_COLOR_OPTIONS = [
  { value: 'Negros', labelKey: 'personalInfo.eyeColor.black', emoji: '⚫' },
  { value: 'Castaños', labelKey: 'personalInfo.eyeColor.brown', emoji: '🟤' },
  { value: 'Pardos', labelKey: 'personalInfo.eyeColor.hazel', emoji: '🟡' },
  { value: 'Verdes', labelKey: 'personalInfo.eyeColor.green', emoji: '🟢' },
  { value: 'Azules', labelKey: 'personalInfo.eyeColor.blue', emoji: '🔵' },
  { value: 'Grises', labelKey: 'personalInfo.eyeColor.gray', emoji: '⚪' },
];

const SKIN_COLOR_OPTIONS = [
  { value: 'Blanca', labelKey: 'personalInfo.skinColor.white' },
  { value: 'Negra', labelKey: 'personalInfo.skinColor.black' },
  { value: 'Mestiza', labelKey: 'personalInfo.skinColor.mixed' },
  { value: 'Mulata', labelKey: 'personalInfo.skinColor.mulatto' },
];

const HAIR_COLOR_OPTIONS = [
  { value: 'Negro', labelKey: 'personalInfo.hairColor.black' },
  { value: 'Castaño', labelKey: 'personalInfo.hairColor.brown' },
  { value: 'Rubio', labelKey: 'personalInfo.hairColor.blonde' },
  { value: 'Canoso', labelKey: 'personalInfo.hairColor.gray' },
  { value: 'Pelirrojo', labelKey: 'personalInfo.hairColor.red' },
  { value: 'Calvo', labelKey: 'personalInfo.hairColor.bald' },
];

const CUBAN_PROVINCES = [
  'La Habana', 'Santiago de Cuba', 'Holguín', 'Villa Clara', 'Camagüey',
  'Matanzas', 'Granma', 'Pinar del Río', 'Las Tunas', 'Sancti Spíritus',
  'Cienfuegos', 'Ciego de Ávila', 'Guantánamo', 'Artemisa', 'Mayabeque',
  'Isla de la Juventud',
];

const MIAMI_ZIPS: { [key: string]: { city: string; state: string } } = {
  '33101': { city: 'Miami', state: 'FL' }, '33109': { city: 'Miami Beach', state: 'FL' },
  '33125': { city: 'Miami', state: 'FL' }, '33126': { city: 'Miami', state: 'FL' },
  '33127': { city: 'Miami', state: 'FL' }, '33128': { city: 'Miami', state: 'FL' },
  '33129': { city: 'Miami', state: 'FL' }, '33130': { city: 'Miami', state: 'FL' },
  '33131': { city: 'Miami', state: 'FL' }, '33132': { city: 'Miami', state: 'FL' },
  '33133': { city: 'Coral Gables', state: 'FL' }, '33134': { city: 'Coral Gables', state: 'FL' },
  '33135': { city: 'Miami', state: 'FL' }, '33139': { city: 'Miami Beach', state: 'FL' },
  '33140': { city: 'Miami Beach', state: 'FL' }, '33142': { city: 'Miami', state: 'FL' },
  '33144': { city: 'Miami', state: 'FL' }, '33145': { city: 'Miami', state: 'FL' },
  '33155': { city: 'Miami', state: 'FL' }, '33165': { city: 'Miami', state: 'FL' },
  '33172': { city: 'Miami', state: 'FL' }, '33175': { city: 'Miami', state: 'FL' },
  '33176': { city: 'Miami', state: 'FL' }, '33178': { city: 'Miami', state: 'FL' },
  '33010': { city: 'Hialeah', state: 'FL' }, '33012': { city: 'Hialeah', state: 'FL' },
  '33013': { city: 'Hialeah', state: 'FL' }, '33014': { city: 'Hialeah', state: 'FL' },
  '33015': { city: 'Hialeah', state: 'FL' }, '33016': { city: 'Hialeah', state: 'FL' },
  '79029': { city: 'Dumas', state: 'TX' },
};

interface ProfileData {
  first_name: string; middle_name: string; last_name: string; second_last_name: string;
  email: string; phone: string;
  address: { street: string; line2: string; city: string; state: string; zip_code: string; country: string };
  ssn_last_four: string; ssn: string; date_of_birth: string; marital_status: string; filing_status: string;
  occupation: string; profession: string; workplace: string; workplace_address: string;
  sex: string; birth_country: string; birth_state: string; birth_city: string;
  father_name: string; mother_name: string;
  eye_color: string; skin_color: string; hair_color: string; height: string;
}

// ─── Compact Input (Memoized to prevent focus loss) ─────────────────────────
const CompactField = React.memo(({ label, value, onChangeText, placeholder, editable = true, keyboardType, autoCapitalize, maxLength, colors }: any) => (
  <View style={{ marginBottom: 6 }}>
    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textGray, marginBottom: 3, marginLeft: 2 }}>{label}</Text>
    <TextInput
      style={{
        height: 42,
        backgroundColor: editable === false ? `${colors.backgroundGray}` : colors.backgroundGray,
        borderRadius: 10,
        paddingHorizontal: 12,
        fontSize: 15,
        color: editable === false ? colors.textGray : colors.text,
        borderWidth: 1,
        borderColor: colors.border,
      }}
      value={value || ''}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textLight}
      editable={editable}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      maxLength={maxLength}
      blurOnSubmit={false}
    />
  </View>
), (prev, next) => {
  // Only re-render if value, label, or editable actually changed
  return prev.value === next.value && prev.label === next.label && prev.editable === next.editable;
});

// ─── SSN Field with masking ─────────────────────────────────────────────────
const SSNField = React.memo(({ value, hasSavedSSN, ssnLast4, onChangeText, colors, isEn }: any) => {
  const [showFull, setShowFull] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);

  // Format SSN as XXX-XX-XXXX
  const formatSSN = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 9);
    if (digits.length <= 3) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  };

  // Mask SSN: •••-••-1234
  const maskSSN = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length >= 4) return `•••-••-${digits.slice(-4)}`;
    return '';
  };

  const rawDigits = (value || '').replace(/\D/g, '');
  const displayValue = isEditing ? formatSSN(rawDigits) :
    (rawDigits.length === 9 && !showFull) ? maskSSN(rawDigits) :
    (rawDigits.length === 9 && showFull) ? formatSSN(rawDigits) :
    (!rawDigits && hasSavedSSN && ssnLast4) ? `•••-••-${ssnLast4}` :
    formatSSN(rawDigits);

  return (
    <View style={{ marginBottom: 6, flex: 1 }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textGray, marginBottom: 3, marginLeft: 2 }}>
        SSN *
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TextInput
          style={{
            flex: 1, height: 42, backgroundColor: colors.backgroundGray,
            borderRadius: 10, paddingHorizontal: 12, fontSize: 15,
            color: colors.text, borderWidth: 1, borderColor: colors.border,
            paddingRight: 40,
          }}
          value={displayValue}
          onChangeText={(text) => {
            const digits = text.replace(/\D/g, '').slice(0, 9);
            onChangeText(digits);
          }}
          onFocus={() => setIsEditing(true)}
          onBlur={() => setIsEditing(false)}
          placeholder="123-45-6789"
          placeholderTextColor={colors.textLight}
          keyboardType="number-pad"
          maxLength={11}
          blurOnSubmit={false}
          secureTextEntry={false}
        />
        {(rawDigits.length === 9 || (hasSavedSSN && ssnLast4)) && !isEditing && (
          <TouchableOpacity
            style={{ position: 'absolute', right: 8, padding: 6 }}
            onPress={() => setShowFull(!showFull)}
            activeOpacity={0.7}
          >
            <Ionicons name={showFull ? 'eye-off' : 'eye'} size={18} color={colors.textGray} />
          </TouchableOpacity>
        )}
      </View>
      {rawDigits.length > 0 && rawDigits.length < 9 && (
        <Text style={{ fontSize: 10, color: '#F59E0B', marginTop: 2, marginLeft: 2 }}>
          {isEn ? `${9 - rawDigits.length} digits remaining` : `Faltan ${9 - rawDigits.length} dígitos`}
        </Text>
      )}
    </View>
  );
}, (prev, next) => prev.value === next.value && prev.hasSavedSSN === next.hasSavedSSN && prev.ssnLast4 === next.ssnLast4);

// ─── Circular Progress ──────────────────────────────────────────────────────
const CircularProgress = ({ percentage, size = 64, strokeWidth = 5, color = '#10B981' }: { percentage: number; size?: number; strokeWidth?: number; color?: string }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotateZ: '-90deg' }] }}>
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(0,0,0,0.06)" strokeWidth={strokeWidth} fill="none" />
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={strokeWidth} fill="none"
        strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
    </Svg>
  );
};

// ─── Section Card (MUST be outside main component to prevent remount) ───────
const SectionCard = React.memo(({ isOpen, onToggle, icon, iconColor, iconBg, title, badge, children, colors }: any) => (
  <View style={{
    backgroundColor: colors.background, borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2, overflow: 'hidden',
  }}>
    <TouchableOpacity
      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 10 }}
      onPress={onToggle} activeOpacity={0.7}
    >
      <View style={{ width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: iconBg }}>
        <Ionicons name={icon} size={17} color={iconColor} />
      </View>
      <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: colors.text }}>{title}</Text>
      {badge}
      <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textGray} />
    </TouchableOpacity>
    {isOpen && <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>{children}</View>}
  </View>
));

// ─── Component ──────────────────────────────────────────────────────────────
export default function PersonalInfo() {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { user, updateUser, refreshUser } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [scanningDocument, setScanningDocument] = useState(false);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [addressVerified, setAddressVerified] = useState<null | 'valid' | 'invalid' | 'corrected'>(null);
  const [verifyingAddress, setVerifyingAddress] = useState(false);
  const [standardizedAddress, setStandardizedAddress] = useState<any>(null);
  // Dependents state
  const [dependents, setDependents] = useState<{id?: string; first_name: string; last_name: string; relationship: string; date_of_birth: string; ssn_last4: string; is_student: boolean; is_disabled: boolean}[]>([]);
  const [loadingDeps, setLoadingDeps] = useState(false);
  const [showDepModal, setShowDepModal] = useState(false);
  const [editingDep, setEditingDep] = useState<any>(null);
  const [depForm, setDepForm] = useState({ first_name: '', last_name: '', relationship: 'child', date_of_birth: '', ssn_last4: '', is_student: false, is_disabled: false });
  const [savingDep, setSavingDep] = useState(false);
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    name: true, contact: true, address: true, taxid: true, filing: true,
    work: true, birth: true, physical: true, parents: true, dependents: false,
  });

  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null);
  const profileRef = useRef<ProfileData | null>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  const [profile, setProfile] = useState<ProfileData>({
    first_name: '', middle_name: '', last_name: '', second_last_name: '',
    email: '', phone: '',
    address: { street: '', line2: '', city: '', state: 'TX', zip_code: '', country: 'Estados Unidos' },
    ssn_last_four: '', ssn: '', date_of_birth: '', marital_status: 'single', filing_status: 'single',
    occupation: '', profession: '', workplace: '', workplace_address: '',
    sex: 'M', birth_country: 'Cuba', birth_state: 'La Habana', birth_city: '',
    father_name: '', mother_name: '',
    eye_color: 'Negros', skin_color: 'Mestiza', hair_color: 'Negro', height: '',
  });
  const [hasSavedSSN, setHasSavedSSN] = useState(false);

  useEffect(() => { loadProfile(); loadDependents(); }, []);

  useEffect(() => {
    if (user) {
      if (!profile.email) setProfile(p => ({ ...p, email: user.email || '' }));
      if (!profile.phone) setProfile(p => ({ ...p, phone: user.phone || '' }));
      if (user.profile_picture) setProfilePicture(`data:image/jpeg;base64,${user.profile_picture}`);
    }
  }, [user]);

  useEffect(() => { profileRef.current = profile; }, [profile]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await api.get('/client-profile');
      const data = response.data;
      setProfile(prev => ({
        ...prev,
        first_name: data.first_name || prev.first_name, middle_name: data.middle_name || prev.middle_name,
        last_name: data.last_name || prev.last_name, second_last_name: data.second_last_name || prev.second_last_name,
        email: data.email || prev.email, phone: data.phone || prev.phone,
        address: { ...prev.address, ...(data.address || {}), state: data.address?.state || prev.address.state },
        ssn_last_four: data.ssn_last_four || prev.ssn_last_four,
        ssn: prev.ssn, // Never load full SSN from server (security)
        date_of_birth: data.date_of_birth || prev.date_of_birth,
        marital_status: data.marital_status || prev.marital_status,
        filing_status: data.filing_status || prev.filing_status,
        occupation: data.occupation || prev.occupation, profession: data.profession || prev.profession,
        workplace: data.workplace || prev.workplace, workplace_address: data.workplace_address || prev.workplace_address,
        sex: data.sex || prev.sex, birth_country: data.birth_country || prev.birth_country,
        birth_state: data.birth_state || prev.birth_state, birth_city: data.birth_city || prev.birth_city,
        father_name: data.father_name || prev.father_name, mother_name: data.mother_name || prev.mother_name,
        eye_color: data.eye_color || prev.eye_color, skin_color: data.skin_color || prev.skin_color,
        hair_color: data.hair_color || prev.hair_color, height: data.height || prev.height,
      }));
      if (data.has_ssn) setHasSavedSSN(true);
      if (user && !data.first_name && user.name) {
        const parts = user.name.split(' ');
        setProfile(p => ({ ...p, first_name: p.first_name || parts[0] || '', last_name: p.last_name || (parts.length > 1 ? parts[parts.length - 1] : '') }));
      }
    } catch (error) {
      if (user) {
        const parts = (user.name || '').split(' ');
        setProfile(p => ({ ...p, first_name: parts[0] || '', last_name: parts.length > 1 ? parts[parts.length - 1] : '', email: user.email || '', phone: user.phone || '' }));
      }
    } finally { setLoading(false); }
  };

  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current);
    autoSaveTimeout.current = setTimeout(async () => {
      try {
        setAutoSaving(true);
        if (profileRef.current) await api.put('/client-profile', profileRef.current);
        setLastSaved(new Date());
      } catch (e) { /* silent */ }
      finally { setAutoSaving(false); }
    }, 3000);
  }, []);

  const autoCompleteFromZip = useCallback(async (zip: string) => {
    // First try local cache for instant response
    if (MIAMI_ZIPS[zip]) {
      setProfile(prev => ({ ...prev, address: { ...prev.address, city: MIAMI_ZIPS[zip].city, state: MIAMI_ZIPS[zip].state } }));
      return;
    }
    // Then call USPS API for any ZIP code
    try {
      const res = await api.get(`/usps/zipcode/citystate/${zip}`);
      if (res.data && res.data.city && res.data.state) {
        setProfile(prev => ({ ...prev, address: { ...prev.address, city: res.data.city, state: res.data.state } }));
      }
    } catch (e) {
      // Fallback: try prefix-based state guess
      const prefix = zip.substring(0, 3);
      const stateByPrefix: { [k: string]: string } = { '330': 'FL', '331': 'FL', '332': 'FL', '790': 'TX', '791': 'TX', '100': 'NY', '101': 'NY', '900': 'CA', '901': 'CA', '770': 'TX' };
      if (stateByPrefix[prefix]) setProfile(prev => ({ ...prev, address: { ...prev.address, state: stateByPrefix[prefix] } }));
    }
  }, []);

  const updateField = useCallback((field: string, value: string) => {
    setProfile(prev => {
      let next;
      if (field.startsWith('address.')) {
        const af = field.replace('address.', '');
        next = { ...prev, address: { ...prev.address, [af]: value } };
        if (af === 'zip_code' && value.length === 5) {
          // Defer the async zip lookup to avoid re-render during typing
          setTimeout(() => autoCompleteFromZip(value), 50);
        }
      } else {
        next = { ...prev, [field]: value };
      }
      return next;
    });
    triggerAutoSave();
  }, [triggerAutoSave, autoCompleteFromZip]);

  const handleSave = async () => {
    if (!profile.first_name.trim()) { Alert.alert(t('common.error', 'Error'), isEn ? 'First name is required' : 'El primer nombre es requerido'); return; }
    setSaving(true);
    try {
      await api.put('/client-profile', profile);
      const combinedName = [profile.first_name, profile.middle_name, profile.last_name, profile.second_last_name].filter(p => p && p.trim()).join(' ');
      await api.put('/users/me', { name: combinedName, phone: profile.phone.trim() || undefined, address: { address_line1: profile.address.street, address_line2: profile.address.line2, city: profile.address.city, state: profile.address.state, zip_code: profile.address.zip_code } });
      if (refreshUser) await refreshUser();
      setLastSaved(new Date());
      Alert.alert(isEn ? 'Saved!' : '¡Guardado!', isEn ? 'Your profile has been updated.' : 'Tu perfil ha sido actualizado.');
    } catch (error: any) { Alert.alert(t('common.error', 'Error'), error.response?.data?.detail || (isEn ? 'Could not save' : 'No se pudo guardar')); }
    finally { setSaving(false); }
  };

  const handleChangeProfilePicture = async () => {
    Alert.alert(isEn ? 'Profile Photo' : 'Foto de Perfil', isEn ? 'Select an option' : 'Selecciona una opción', [
      { text: isEn ? 'Take Photo' : 'Tomar Foto', onPress: () => pickImage('camera') },
      { text: isEn ? 'Choose from Gallery' : 'Elegir de Galería', onPress: () => pickImage('gallery') },
      { text: isEn ? 'Cancel' : 'Cancelar', style: 'cancel' },
    ]);
  };

  const pickImage = async (source: 'camera' | 'gallery') => {
    try {
      const permission = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { Alert.alert(isEn ? 'Permission Required' : 'Permiso Requerido', isEn ? 'Permission is needed' : 'Se necesita permiso'); return; }
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 1 });
      if (!result.canceled && result.assets[0]) {
        setUploadingImage(true);
        try {
          const manipulated = await ImageManipulator.manipulateAsync(result.assets[0].uri, [{ resize: { width: 512 } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG });
          const response = await fetch(manipulated.uri);
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64Image = (reader.result as string).split(',')[1];
            try { await api.put('/users/profile-picture', { profile_picture: base64Image }); if (refreshUser) await refreshUser(); setProfilePicture(`data:image/jpeg;base64,${base64Image}`); }
            catch (e) { Alert.alert('Error', isEn ? 'Could not update photo' : 'No se pudo actualizar la foto'); }
            finally { setUploadingImage(false); }
          };
          reader.readAsDataURL(blob);
        } catch (e) { setUploadingImage(false); }
      }
    } catch (e) { Alert.alert('Error', isEn ? 'Could not process image' : 'No se pudo procesar la imagen'); }
  };

  const scanDocument = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) { Alert.alert(isEn ? 'Permission required' : 'Permiso requerido', isEn ? 'Camera access needed' : 'Necesitamos acceso a la cámara'); return; }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.8, base64: true });
      if (!result.canceled && result.assets[0].base64) {
        setScanningDocument(true);
        try {
          const response = await api.post('/ocr/document', { image_base64: result.assets[0].base64, document_type: 'passport' });
          if (response.data.success && response.data.extracted_data) {
            const data = response.data.extracted_data;
            setProfile(prev => ({ ...prev, first_name: data.first_name || prev.first_name, last_name: data.last_name || prev.last_name, date_of_birth: data.date_of_birth || prev.date_of_birth, sex: data.sex || prev.sex, birth_country: data.nationality || prev.birth_country }));
            triggerAutoSave();
            Alert.alert(isEn ? 'Scanned!' : '¡Escaneado!', isEn ? 'Data extracted. Please verify.' : 'Datos extraídos. Verifica que sean correctos.');
          } else { Alert.alert(isEn ? 'Could not read' : 'No se pudo leer', isEn ? 'Enter data manually.' : 'Ingresa los datos manualmente.'); }
        } catch (e) { Alert.alert('Error', isEn ? 'Problem processing document' : 'Problema al procesar'); }
      }
    } catch (e) { /* silent */ }
    finally { setScanningDocument(false); }
  };

  const verifyAddressUSPS = async () => {
    const { street, city, state, zip_code } = profile.address;
    if (!street || !zip_code) { Alert.alert(isEn ? 'Missing Info' : 'Datos Faltantes', isEn ? 'Enter at least street and ZIP' : 'Ingresa calle y código postal'); return; }
    setVerifyingAddress(true); setAddressVerified(null);
    try {
      const res = await api.post('/usps/address/validate-simple', { street, city, state, zip: zip_code });
      const data = res.data;
      if (data.valid) {
        const std = data.standardized;
        const hasCorrections = std && ((std.streetAddress && std.streetAddress !== street) || (std.city && std.city !== city) || (std.state && std.state !== state) || (std.ZIPCode && std.ZIPCode !== zip_code));
        if (hasCorrections) {
          setStandardizedAddress(std); setAddressVerified('corrected');
          Alert.alert(isEn ? 'Address Corrected' : 'Dirección Corregida',
            `USPS sugiere:\n${std.streetAddress || street}\n${std.city || city}, ${std.state || state} ${std.ZIPCode || zip_code}\n\n${isEn ? 'Apply correction?' : '¿Aplicar corrección?'}`,
            [{ text: isEn ? 'Keep Mine' : 'Mantener', style: 'cancel' },
             { text: isEn ? 'Apply' : 'Aplicar', onPress: () => { setProfile(prev => ({ ...prev, address: { ...prev.address, street: std.streetAddress || prev.address.street, city: std.city || prev.address.city, state: std.state || prev.address.state, zip_code: std.ZIPCode || prev.address.zip_code } })); setAddressVerified('valid'); triggerAutoSave(); }}]);
        } else { setAddressVerified('valid'); }
      } else { setAddressVerified('invalid'); Alert.alert(isEn ? 'Could Not Verify' : 'No Verificada', data.dpvMessageEs || data.dpvMessage || (isEn ? 'USPS could not verify' : 'USPS no pudo verificar. Revisa los datos.')); }
    } catch (error: any) { setAddressVerified('invalid'); Alert.alert('Error', isEn ? 'Could not connect to USPS' : 'No se pudo conectar con USPS'); }
    finally { setVerifyingAddress(false); }
  };

  // ─── Dependents CRUD ───
  const loadDependents = async () => {
    try {
      setLoadingDeps(true);
      const res = await api.get('/dependents');
      setDependents(Array.isArray(res.data) ? res.data : []);
    } catch (e) { /* silent */ }
    finally { setLoadingDeps(false); }
  };

  const resetDepForm = () => {
    setDepForm({ first_name: '', last_name: '', relationship: 'child', date_of_birth: '', ssn_last4: '', is_student: false, is_disabled: false });
    setEditingDep(null);
  };

  const handleSaveDep = async () => {
    if (!depForm.first_name.trim() || !depForm.last_name.trim()) {
      Alert.alert('Error', isEn ? 'Name is required' : 'El nombre es requerido'); return;
    }
    try {
      setSavingDep(true);
      if (editingDep) {
        await api.put(`/dependents/${editingDep.id}`, depForm);
      } else {
        await api.post('/dependents', depForm);
      }
      await loadDependents();
      setShowDepModal(false);
      resetDepForm();
    } catch (e) {
      Alert.alert('Error', isEn ? 'Could not save' : 'No se pudo guardar');
    } finally { setSavingDep(false); }
  };

  const handleDeleteDep = (dep: any) => {
    Alert.alert(isEn ? 'Delete' : 'Eliminar', `${isEn ? 'Delete' : 'Eliminar a'} ${dep.first_name}?`, [
      { text: isEn ? 'Cancel' : 'Cancelar', style: 'cancel' },
      { text: isEn ? 'Delete' : 'Eliminar', style: 'destructive', onPress: async () => {
        try { await api.delete(`/dependents/${dep.id}`); await loadDependents(); } catch (e) { Alert.alert('Error'); }
      }},
    ]);
  };

  const getDepAge = (dob: string) => {
    try {
      const parts = dob.split('/');
      const d = parts.length === 3 ? new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1])) : new Date(dob);
      return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
    } catch { return null; }
  };

  const DEP_RELATIONSHIPS = [
    { value: 'child', label: isEn ? 'Child' : 'Hijo(a)', icon: 'happy-outline' },
    { value: 'spouse', label: isEn ? 'Spouse' : 'Cónyuge', icon: 'heart-outline' },
    { value: 'parent', label: isEn ? 'Parent' : 'Padre/Madre', icon: 'people-outline' },
    { value: 'sibling', label: isEn ? 'Sibling' : 'Hermano(a)', icon: 'people-outline' },
    { value: 'other', label: isEn ? 'Other' : 'Otro', icon: 'person-outline' },
  ];

  const getCompletion = () => {
    const fields: { [k: string]: string[] } = {
      account: [profile.first_name, profile.last_name, profile.phone, profile.email, profile.address?.street || '', profile.address?.city || '', profile.address?.state || '', profile.address?.zip_code || ''],
      fiscal: [profile.date_of_birth || '', profile.marital_status || '', profile.occupation || ''],
    };
    const total = Object.values(fields).flat();
    const filled = total.filter(f => f && typeof f === 'string' && f.trim() !== '').length;
    const global = Math.round((filled / total.length) * 100);
    const stepCompletion: { [k: string]: number } = {};
    Object.entries(fields).forEach(([key, vals]) => { const f = vals.filter(v => v && typeof v === 'string' && v.trim() !== '').length; stepCompletion[key] = Math.round((f / vals.length) * 100); });
    return { global, steps: stepCompletion };
  };

  const completion = getCompletion();

  const goToStep = (step: number) => {
    if (step < 0 || step > 2) return;
    const direction = step > currentStep ? 1 : -1;
    Animated.timing(slideAnim, { toValue: direction * -SCREEN_WIDTH, duration: 120, useNativeDriver: true }).start(() => {
      setCurrentStep(step); slideAnim.setValue(direction * SCREEN_WIDTH);
      Animated.timing(slideAnim, { toValue: 0, duration: 160, useNativeDriver: true }).start();
    });
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
  };

  const toggleSection = useCallback((key: string) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] })), []);

  // ─── Chip Selector ────────────────────────────────────────────────────────
  const renderChips = (label: string, value: string, options: any[], field: string) => (
    <View style={{ marginBottom: 6 }}>
      <Text style={styles.chipLabel}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((opt: any) => {
          const sel = value === opt.value;
          return (
            <TouchableOpacity key={opt.value} style={[styles.chip, sel && styles.chipSel]} onPress={() => updateField(field, opt.value)} activeOpacity={0.7}>
              {opt.emoji && <Text style={{ fontSize: 12 }}>{opt.emoji}</Text>}
              {opt.icon && <Ionicons name={opt.icon as any} size={14} color={sel ? '#fff' : colors.textGray} />}
              <Text style={[styles.chipText, sel && styles.chipTextSel]}>{t(opt.labelKey || '', opt.label || opt.value)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderHScroll = (label: string, value: string, options: string[], field: string) => (
    <View style={{ marginBottom: 6 }}>
      <Text style={styles.chipLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={[styles.chipRow, { flexWrap: 'nowrap' }]}>
          {options.map((opt) => {
            const sel = value === opt;
            return (
              <TouchableOpacity key={opt} style={[styles.chip, sel && styles.chipSel]} onPress={() => updateField(field, opt)} activeOpacity={0.7}>
                <Text style={[styles.chipText, sel && styles.chipTextSel]}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );

  // ─── Step 1: Mi Cuenta ──────────────────────────────────────────────────
  const renderStep1 = () => (
    <View style={{ gap: 10 }}>
      {/* Compact Avatar Row */}
      <View style={styles.avatarRow}>
        <TouchableOpacity onPress={handleChangeProfilePicture} disabled={uploadingImage} activeOpacity={0.8}>
          <View style={styles.avatarContainer}>
            <CircularProgress percentage={completion.global} size={68} strokeWidth={3} color={colors.primary} />
            <View style={styles.avatarInner}>
              {profilePicture ? (
                <Image source={{ uri: profilePicture }} style={styles.avatarImg} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                  <Text style={styles.avatarInitials}>{(profile.first_name?.[0] || '').toUpperCase()}{(profile.last_name?.[0] || '').toUpperCase()}</Text>
                </View>
              )}
            </View>
            <View style={[styles.cameraDot, { backgroundColor: colors.primary }]}>
              {uploadingImage ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="camera" size={11} color="#fff" />}
            </View>
          </View>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.avatarName} numberOfLines={1}>
            {profile.first_name || profile.last_name ? `${profile.first_name} ${profile.last_name}`.trim() : (isEn ? 'Your Name' : 'Tu Nombre')}
          </Text>
          <Text style={styles.avatarEmail} numberOfLines={1}>{profile.email || ''}</Text>
          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${completion.global}%`, backgroundColor: completion.global >= 80 ? '#10B981' : colors.primary }]} />
            </View>
            <Text style={styles.progressLabel}>{completion.global}%</Text>
          </View>
        </View>
      </View>

      <SectionCard isOpen={expandedSections['name'] !== false} onToggle={() => toggleSection('name')} icon="person" iconColor={colors.primary} iconBg={`${colors.primary}12`} title={isEn ? 'Full Name' : 'Nombre Completo'} colors={colors}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}><CompactField label={isEn ? 'First Name *' : 'Nombre *'} value={profile.first_name} onChangeText={(v: string) => updateField('first_name', v)} placeholder="Juan" autoCapitalize="words" colors={colors} /></View>
          <View style={{ flex: 1 }}><CompactField label={isEn ? 'Middle' : '2do Nombre'} value={profile.middle_name} onChangeText={(v: string) => updateField('middle_name', v)} placeholder="Carlos" autoCapitalize="words" colors={colors} /></View>
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1 }}><CompactField label={isEn ? 'Last Name *' : 'Apellido *'} value={profile.last_name} onChangeText={(v: string) => updateField('last_name', v)} placeholder="Pérez" autoCapitalize="words" colors={colors} /></View>
          <View style={{ flex: 1 }}><CompactField label={isEn ? '2nd Last' : '2do Apellido'} value={profile.second_last_name} onChangeText={(v: string) => updateField('second_last_name', v)} placeholder="García" autoCapitalize="words" colors={colors} /></View>
        </View>
      </SectionCard>

      <SectionCard isOpen={expandedSections['contact'] !== false} onToggle={() => toggleSection('contact')} icon="call" iconColor="#3B82F6" iconBg="#3B82F612" title={isEn ? 'Contact' : 'Contacto'} colors={colors}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}><CompactField label={isEn ? 'Phone *' : 'Teléfono *'} value={profile.phone} onChangeText={(v: string) => updateField('phone', v)} placeholder="(806) 934-2018" keyboardType="phone-pad" colors={colors} /></View>
          <View style={{ flex: 1 }}><CompactField label="Email" value={profile.email} editable={false} placeholder="email@example.com" colors={colors} /></View>
        </View>
      </SectionCard>

      <SectionCard isOpen={expandedSections['address'] !== false} onToggle={() => toggleSection('address')} icon="location" iconColor="#F59E0B" iconBg="#F59E0B12" title={isEn ? 'Address' : 'Dirección'} colors={colors}
        badge={addressVerified === 'valid' ? <View style={styles.uspsTag}><Ionicons name="checkmark-circle" size={12} color="#059669" /><Text style={styles.uspsTagText}>USPS</Text></View> : null}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}><CompactField label="ZIP" value={profile.address.zip_code} onChangeText={(v: string) => { updateField('address.zip_code', v); setAddressVerified(null); }} placeholder="79029" keyboardType="number-pad" maxLength={5} colors={colors} /></View>
          <View style={{ width: 80 }}><CompactField label={isEn ? 'State' : 'Estado'} value={profile.address.state} onChangeText={(v: string) => { updateField('address.state', v); setAddressVerified(null); }} placeholder="TX" autoCapitalize="characters" maxLength={2} colors={colors} /></View>
          <View style={{ flex: 1.5 }}><CompactField label={isEn ? 'City' : 'Ciudad'} value={profile.address.city} onChangeText={(v: string) => { updateField('address.city', v); setAddressVerified(null); }} placeholder="Dumas" autoCapitalize="words" colors={colors} /></View>
        </View>
        <CompactField label={isEn ? 'Street & Number' : 'Calle y Número'} value={profile.address.street} onChangeText={(v: string) => { updateField('address.street', v); setAddressVerified(null); }} placeholder="305 Bruce Ave" colors={colors} />
        <CompactField label={isEn ? 'Apt/Suite' : 'Apt/Suite'} value={profile.address.line2} onChangeText={(v: string) => updateField('address.line2', v)} placeholder="Apt 4B" colors={colors} />
        <TouchableOpacity
          style={[styles.uspsBtn, addressVerified === 'valid' && styles.uspsBtnOk, addressVerified === 'invalid' && styles.uspsBtnBad]}
          onPress={verifyAddressUSPS} disabled={verifyingAddress} activeOpacity={0.7}>
          {verifyingAddress ? <ActivityIndicator size="small" color="#3B82F6" /> :
           addressVerified === 'valid' ? <Ionicons name="checkmark-circle" size={16} color="#059669" /> :
           addressVerified === 'invalid' ? <Ionicons name="alert-circle" size={16} color="#EF4444" /> :
           <Ionicons name="shield-checkmark" size={16} color="#3B82F6" />}
          <Text style={[styles.uspsBtnText, addressVerified === 'valid' && { color: '#059669' }, addressVerified === 'invalid' && { color: '#EF4444' }]}>
            {verifyingAddress ? (isEn ? 'Verifying...' : 'Verificando...') :
             addressVerified === 'valid' ? (isEn ? 'Verified ✓' : 'Verificada ✓') :
             addressVerified === 'invalid' ? (isEn ? 'Retry' : 'Reintentar') :
             (isEn ? 'Verify USPS' : 'Verificar USPS')}
          </Text>
        </TouchableOpacity>
      </SectionCard>
    </View>
  );

  // ─── Step 2: Perfil Fiscal ────────────────────────────────────────────────
  const renderStep2 = () => (
    <View style={{ gap: 10 }}>
      <SectionCard isOpen={expandedSections['taxid'] !== false} onToggle={() => toggleSection('taxid')} icon="shield-checkmark" iconColor="#8B5CF6" iconBg="#8B5CF612" title={isEn ? 'Tax ID' : 'ID Fiscal'} colors={colors}>
        <View style={styles.privacyNote}>
          <Ionicons name="lock-closed" size={13} color={colors.info} />
          <Text style={[styles.privacyNoteText, { color: colors.info }]}>{isEn ? 'Private — only for your tax return' : 'Privado — solo para tu declaración'}</Text>
        </View>
        <View style={styles.row}>
          <SSNField value={profile.ssn} hasSavedSSN={hasSavedSSN} ssnLast4={profile.ssn_last_four} onChangeText={(v: string) => updateField('ssn', v)} colors={colors} isEn={isEn} />
          <View style={{ flex: 1 }}><CompactField label={isEn ? 'Date of Birth *' : 'Nacimiento *'} value={profile.date_of_birth} onChangeText={(v: string) => updateField('date_of_birth', v)} placeholder="1990-12-31" colors={colors} /></View>
        </View>
      </SectionCard>

      <SectionCard isOpen={expandedSections['filing'] !== false} onToggle={() => toggleSection('filing')} icon="document-text" iconColor="#10B981" iconBg="#10B98112" title={isEn ? 'Filing Status' : 'Estado de Declaración'} colors={colors}>
        {renderChips(isEn ? 'Marital Status' : 'Estado Civil', profile.marital_status, MARITAL_STATUS_OPTIONS, 'marital_status')}
        {renderChips(isEn ? 'Filing Status' : 'Declaración', profile.filing_status, FILING_STATUS_OPTIONS, 'filing_status')}
      </SectionCard>

      <SectionCard isOpen={expandedSections['work'] !== false} onToggle={() => toggleSection('work')} icon="briefcase" iconColor="#F59E0B" iconBg="#F59E0B12" title={isEn ? 'Employment' : 'Trabajo'} colors={colors}>
        <CompactField label={isEn ? 'Occupation' : 'Ocupación'} value={profile.occupation} onChangeText={(v: string) => updateField('occupation', v)} placeholder={isEn ? 'Engineer' : 'Ingeniero'} autoCapitalize="words" colors={colors} />
        <View style={styles.row}>
          <View style={{ flex: 1 }}><CompactField label={isEn ? 'Workplace' : 'Empresa'} value={profile.workplace} onChangeText={(v: string) => updateField('workplace', v)} placeholder={isEn ? 'Company' : 'Empresa'} autoCapitalize="words" colors={colors} /></View>
        </View>
        <CompactField label={isEn ? 'Work Address' : 'Dir. Trabajo'} value={profile.workplace_address} onChangeText={(v: string) => updateField('workplace_address', v)} placeholder="123 Business St" colors={colors} />
      </SectionCard>

      {/* ─── Dependientes ─── */}
      <SectionCard isOpen={expandedSections['dependents'] !== false} onToggle={() => toggleSection('dependents')} icon="people" iconColor="#EC4899" iconBg="#EC489912" title={`${isEn ? 'Dependents' : 'Dependientes'} (${dependents.length})`} colors={colors}>
        {loadingDeps ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ padding: 20 }} />
        ) : (
          <View>
            {dependents.map((dep, idx) => {
              const rel = DEP_RELATIONSHIPS.find(r => r.value === dep.relationship) || DEP_RELATIONSHIPS[4];
              const age = getDepAge(dep.date_of_birth);
              return (
                <View key={dep.id || idx} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: idx < dependents.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: dep.relationship === 'child' ? '#D1FAE5' : dep.relationship === 'spouse' ? '#FCE7F3' : '#E0E7FF', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={rel.icon as any} size={18} color={dep.relationship === 'child' ? '#059669' : dep.relationship === 'spouse' ? '#DB2777' : '#4F46E5'} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{dep.first_name} {dep.last_name}</Text>
                    <Text style={{ fontSize: 11, color: colors.secondaryText }}>{rel.label}{age !== null ? ` • ${age} ${isEn ? 'yrs' : 'años'}` : ''}{dep.ssn_last4 ? ` • SSN ••${dep.ssn_last4.slice(-4)}` : ''}</Text>
                  </View>
                  <TouchableOpacity onPress={() => { setEditingDep(dep); setDepForm({ ...dep }); setShowDepModal(true); }} style={{ padding: 6 }}>
                    <Ionicons name="create-outline" size={18} color={colors.secondaryText} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteDep(dep)} style={{ padding: 6 }}>
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              );
            })}
            {dependents.length === 0 && (
              <Text style={{ fontSize: 13, color: colors.secondaryText, textAlign: 'center', paddingVertical: 12 }}>
                {isEn ? 'No dependents added yet' : 'No hay dependientes agregados'}
              </Text>
            )}
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, paddingVertical: 10, backgroundColor: `${colors.primary}10`, borderRadius: 10 }}
              onPress={() => { resetDepForm(); setShowDepModal(true); }}
            >
              <Ionicons name="add-circle" size={18} color={colors.primary} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>{isEn ? 'Add Dependent' : 'Agregar Dependiente'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </SectionCard>
    </View>
  );
  const renderStep3 = () => (
    <View style={{ gap: 10 }}>
      {/* Scan Card */}
      <TouchableOpacity style={styles.scanRow} onPress={scanDocument} disabled={scanningDocument} activeOpacity={0.7}>
        <View style={{ width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: `${colors.primary}12` }}>
          {scanningDocument ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="scan" size={18} color={colors.primary} />}
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.scanTitle}>{isEn ? 'Scan Passport' : 'Escanear Pasaporte'}</Text>
          <Text style={styles.scanSub}>{isEn ? 'Auto-fill your data' : 'Llena automáticamente'}</Text>
        </View>
        <Ionicons name="camera" size={20} color={colors.primary} />
      </TouchableOpacity>

      <SectionCard isOpen={expandedSections['birth'] !== false} onToggle={() => toggleSection('birth')} icon="flag" iconColor="#EF4444" iconBg="#EF444412" title={isEn ? 'Birthplace' : 'Nacimiento'} colors={colors}>
        {renderChips(isEn ? 'Country' : 'País', profile.birth_country, [
          { value: 'Cuba', label: '🇨🇺 Cuba' }, { value: 'Estados Unidos', label: '🇺🇸 USA' }, { value: 'Otro', label: isEn ? '🌎 Other' : '🌎 Otro' }
        ], 'birth_country')}
        {profile.birth_country === 'Cuba' && renderHScroll(isEn ? 'Province' : 'Provincia', profile.birth_state, CUBAN_PROVINCES, 'birth_state')}
        <CompactField label={isEn ? 'Birth City' : 'Ciudad de Nacimiento'} value={profile.birth_city} onChangeText={(v: string) => updateField('birth_city', v)} placeholder={isEn ? 'Havana' : 'Centro Habana'} autoCapitalize="words" colors={colors} />
      </SectionCard>

      <SectionCard isOpen={expandedSections['physical'] !== false} onToggle={() => toggleSection('physical')} icon="body" iconColor="#6366F1" iconBg="#6366F112" title={isEn ? 'Personal Data' : 'Datos Personales'} colors={colors}>
        {renderChips(isEn ? 'Sex' : 'Sexo', profile.sex, SEX_OPTIONS, 'sex')}
        {renderChips(isEn ? 'Eyes' : 'Ojos', profile.eye_color, EYE_COLOR_OPTIONS, 'eye_color')}
        <View style={styles.row}>
          <View style={{ flex: 1 }}>{renderChips(isEn ? 'Skin' : 'Piel', profile.skin_color, SKIN_COLOR_OPTIONS, 'skin_color')}</View>
        </View>
        {renderChips(isEn ? 'Hair' : 'Cabello', profile.hair_color, HAIR_COLOR_OPTIONS, 'hair_color')}
        <CompactField label={isEn ? 'Height (cm)' : 'Estatura (cm)'} value={profile.height} onChangeText={(v: string) => updateField('height', v)} placeholder="170" keyboardType="number-pad" colors={colors} />
      </SectionCard>

      <SectionCard isOpen={expandedSections['parents'] !== false} onToggle={() => toggleSection('parents')} icon="people" iconColor="#EC4899" iconBg="#EC489912" title={isEn ? 'Parents' : 'Padres'} colors={colors}>
        <CompactField label={isEn ? "Father's Name" : 'Nombre del Padre'} value={profile.father_name} onChangeText={(v: string) => updateField('father_name', v)} placeholder="José Pérez" autoCapitalize="words" colors={colors} />
        <CompactField label={isEn ? "Mother's Name" : 'Nombre de la Madre'} value={profile.mother_name} onChangeText={(v: string) => updateField('mother_name', v)} placeholder="María García" autoCapitalize="words" colors={colors} />
      </SectionCard>
    </View>
  );

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <CustomHeader title={isEn ? 'My Profile' : 'Mi Perfil'} showBack={true} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const STEPS_KEYS = ['account', 'fiscal'];
  const stepPct = completion.steps[STEPS_KEYS[currentStep]] || 0;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <CustomHeader title={isEn ? 'My Profile' : 'Mi Perfil'} showBack={true} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Step Tabs */}
        <View style={styles.tabRow}>
          {(['account', 'fiscal'] as const).map((key, idx) => {
            const isActive = idx === currentStep;
            const pct = completion.steps[key] || 0;
            const labels = isEn ? ['Account', 'Tax'] : ['Cuenta', 'Fiscal'];
            return (
              <TouchableOpacity key={key} style={[styles.tab, isActive && styles.tabActive]} onPress={() => goToStep(idx)} activeOpacity={0.7}>
                {pct >= 100 && <Ionicons name="checkmark-circle" size={14} color={isActive ? '#fff' : colors.primary} style={{ marginRight: 4 }} />}
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{labels[idx]}</Text>
                {!isActive && pct < 100 && <Text style={styles.tabPct}>{pct}%</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Auto-save indicator (absolute so it doesn't shift layout) */}
        {autoSaving && (
          <View style={styles.autoSaveBar}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.autoSaveText}>{isEn ? 'Saving...' : 'Guardando...'}</Text>
          </View>
        )}

        {/* Content */}
        <ScrollView ref={scrollViewRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 24 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>
          <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>
            {currentStep === 0 && renderStep1()}
            {currentStep === 1 && renderStep2()}
          </Animated.View>
          <View style={{ height: 80 }} />
        </ScrollView>

        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          {currentStep > 0 ? (
            <TouchableOpacity style={styles.backBtn} onPress={() => goToStep(currentStep - 1)} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={18} color={colors.text} />
              <Text style={styles.backBtnText}>{isEn ? 'Back' : 'Atrás'}</Text>
            </TouchableOpacity>
          ) : <View style={{ width: 90 }} />}
          {currentStep < 1 ? (
            <TouchableOpacity style={[styles.nextBtn, { backgroundColor: colors.primary }]} onPress={() => goToStep(currentStep + 1)} activeOpacity={0.8}>
              <Text style={styles.nextBtnText}>{isEn ? 'Next' : 'Siguiente'}</Text>
              <Ionicons name="chevron-forward" size={18} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <>
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={styles.saveBtnText}>{isEn ? 'Save' : 'Guardar'}</Text>
              </>}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* ─── Add/Edit Dependent Modal ─── */}
      <Modal visible={showDepModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: insets.bottom + 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{editingDep ? (isEn ? 'Edit Dependent' : 'Editar Dependiente') : (isEn ? 'Add Dependent' : 'Agregar Dependiente')}</Text>
              <TouchableOpacity onPress={() => { setShowDepModal(false); resetDepForm(); }} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color={colors.textGray} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textGray, marginBottom: 4 }}>{isEn ? 'First Name *' : 'Nombre *'}</Text>
                  <TextInput style={{ backgroundColor: colors.backgroundGray, borderRadius: 10, padding: 12, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border }} value={depForm.first_name} onChangeText={(v) => setDepForm(p => ({ ...p, first_name: v }))} placeholder="Juan" placeholderTextColor={colors.textGray} autoCapitalize="words" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textGray, marginBottom: 4 }}>{isEn ? 'Last Name *' : 'Apellido *'}</Text>
                  <TextInput style={{ backgroundColor: colors.backgroundGray, borderRadius: 10, padding: 12, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border }} value={depForm.last_name} onChangeText={(v) => setDepForm(p => ({ ...p, last_name: v }))} placeholder="García" placeholderTextColor={colors.textGray} autoCapitalize="words" />
                </View>
              </View>

              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textGray, marginBottom: 6 }}>{isEn ? 'Relationship' : 'Parentesco'}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {DEP_RELATIONSHIPS.map((r) => {
                  const active = depForm.relationship === r.value;
                  return (
                    <TouchableOpacity key={r.value} onPress={() => setDepForm(p => ({ ...p, relationship: r.value }))} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: active ? colors.primary : colors.backgroundGray, borderWidth: 1, borderColor: active ? colors.primary : colors.border }}>
                      <Ionicons name={r.icon as any} size={14} color={active ? '#fff' : colors.textGray} />
                      <Text style={{ fontSize: 12, fontWeight: '600', color: active ? '#fff' : colors.text }}>{r.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textGray, marginBottom: 4 }}>{isEn ? 'Date of Birth' : 'Nacimiento'}</Text>
                  <TextInput style={{ backgroundColor: colors.backgroundGray, borderRadius: 10, padding: 12, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border }} value={depForm.date_of_birth} onChangeText={(v) => setDepForm(p => ({ ...p, date_of_birth: v }))} placeholder="MM/DD/YYYY" placeholderTextColor={colors.textGray} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textGray, marginBottom: 4 }}>SSN ({isEn ? 'last 4' : 'últimos 4'})</Text>
                  <TextInput style={{ backgroundColor: colors.backgroundGray, borderRadius: 10, padding: 12, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border }} value={depForm.ssn_last4} onChangeText={(v) => setDepForm(p => ({ ...p, ssn_last4: v }))} placeholder="1234" placeholderTextColor={colors.textGray} keyboardType="numeric" maxLength={4} secureTextEntry />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 20, marginBottom: 12 }}>
                <TouchableOpacity onPress={() => setDepForm(p => ({ ...p, is_student: !p.is_student }))} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name={depForm.is_student ? 'checkbox' : 'square-outline'} size={22} color={depForm.is_student ? colors.primary : colors.textGray} />
                  <Text style={{ fontSize: 13, color: colors.text }}>{isEn ? 'Student' : 'Estudiante'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setDepForm(p => ({ ...p, is_disabled: !p.is_disabled }))} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name={depForm.is_disabled ? 'checkbox' : 'square-outline'} size={22} color={depForm.is_disabled ? colors.primary : colors.textGray} />
                  <Text style={{ fontSize: 13, color: colors.text }}>{isEn ? 'Disabled' : 'Discapacitado'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <TouchableOpacity onPress={handleSaveDep} disabled={savingDep} style={{ marginTop: 10, paddingVertical: 14, backgroundColor: colors.primary, borderRadius: 14, alignItems: 'center', opacity: savingDep ? 0.6 : 1 }}>
              {savingDep ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>{editingDep ? (isEn ? 'Save Changes' : 'Guardar Cambios') : (isEn ? 'Add Dependent' : 'Agregar Dependiente')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundGray },

  // Tabs
  tabRow: {
    flexDirection: 'row', backgroundColor: colors.background,
    paddingHorizontal: 14, paddingVertical: 10, gap: 8,
    borderBottomWidth: 1, borderBottomColor: `${colors.border}50`,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, borderRadius: 10,
    backgroundColor: colors.backgroundGray, gap: 2,
  },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textGray },
  tabTextActive: { color: '#fff', fontWeight: '700' },
  tabPct: { fontSize: 10, color: colors.textLight, marginLeft: 3 },

  // Auto-save (absolute positioned, doesn't shift layout)
  autoSaveBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 3, gap: 6, backgroundColor: `${colors.primary}15`,
  },
  autoSaveText: { fontSize: 11, color: colors.primary },

  // Avatar Row
  avatarRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.background, borderRadius: 18,
    padding: 14, shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06,
    shadowRadius: 8, elevation: 3,
  },
  avatarContainer: { position: 'relative', width: 68, height: 68 },
  avatarInner: { position: 'absolute', top: 4, left: 4, width: 60, height: 60, borderRadius: 30, overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { fontSize: 22, fontWeight: '800', color: '#fff' },
  cameraDot: {
    position: 'absolute', bottom: 0, right: 0, width: 24, height: 24,
    borderRadius: 12, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: colors.background, zIndex: 10,
  },
  avatarName: { fontSize: 17, fontWeight: '700', color: colors.text },
  avatarEmail: { fontSize: 12, color: colors.textGray, marginTop: 1, marginBottom: 6 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressTrack: { flex: 1, height: 5, backgroundColor: `${colors.border}60`, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressLabel: { fontSize: 12, fontWeight: '700', color: colors.primary, width: 32 },

  // Rows
  row: { flexDirection: 'row', gap: 8 },

  // Chips
  chipLabel: { fontSize: 11, fontWeight: '600', color: colors.textGray, marginBottom: 4, marginLeft: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 8, backgroundColor: colors.backgroundGray,
    borderWidth: 1, borderColor: colors.border, gap: 4,
  },
  chipSel: {
    backgroundColor: colors.primary, borderColor: colors.primary,
  },
  chipText: { fontSize: 12, fontWeight: '500', color: colors.text },
  chipTextSel: { color: '#fff', fontWeight: '600' },

  // Privacy note
  privacyNote: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: `${colors.info}08`, borderRadius: 8,
    padding: 8, marginBottom: 6,
  },
  privacyNoteText: { fontSize: 11, flex: 1 },

  // Scan row
  scanRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.background, borderRadius: 16,
    padding: 14, borderWidth: 1, borderColor: `${colors.primary}25`,
    borderStyle: 'dashed',
  },
  scanTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  scanSub: { fontSize: 11, color: colors.textGray, marginTop: 1 },

  // USPS
  uspsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', gap: 6,
  },
  uspsBtnOk: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  uspsBtnBad: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  uspsBtnText: { fontSize: 13, fontWeight: '600', color: '#3B82F6' },
  uspsTag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#ECFDF5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginRight: 4 },
  uspsTagText: { fontSize: 10, fontWeight: '700', color: '#059669' },

  // Bottom Bar
  bottomBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: colors.background,
    borderTopWidth: 1, borderTopColor: `${colors.border}40`,
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, paddingHorizontal: 16, borderRadius: 12,
    backgroundColor: colors.backgroundGray, gap: 4,
  },
  backBtnText: { fontSize: 14, fontWeight: '600', color: colors.text },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, paddingHorizontal: 24, borderRadius: 12, gap: 4,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 4,
  },
  nextBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, paddingHorizontal: 24, borderRadius: 12, gap: 6,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 4,
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
