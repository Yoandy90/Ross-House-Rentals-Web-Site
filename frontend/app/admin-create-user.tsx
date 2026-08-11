import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { apiCall } from '../src/utils/api';
import { useColors, Spacing, FontSizes, BorderRadius } from '../src/constants/theme';

interface Property {
  _id: string;
  name: string;
  address: string;
}

const USER_ROLES = [
  { value: 'tenant', label: 'Inquilino', icon: 'home', color: '#3B82F6', desc: 'Puede ver su contrato, pagar renta y reportar mantenimiento' },
  { value: 'landlord', label: 'Propietario', icon: 'business', color: '#10B981', desc: 'Puede ver sus propiedades, ingresos y gestionar inquilinos' },
  { value: 'buyer', label: 'Comprador', icon: 'key', color: '#8B5CF6', desc: 'Puede buscar propiedades y solicitar información' },
  { value: 'admin', label: 'Administrador', icon: 'shield-checkmark', color: '#C8102E', desc: 'Acceso completo al sistema' },
];

export default function AdminCreateUserScreen() {
  const Colors = useColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPropertyPicker, setShowPropertyPicker] = useState(false);

  // Form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('tenant');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    try {
      const data = await apiCall('/admin/properties');
      setProperties(data.properties || data || []);
    } catch (err) {
      console.log('Error fetching properties:', err);
    } finally {
      setLoading(false);
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let pwd = '';
    for (let i = 0; i < 10; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    setPassword(pwd);
  };

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Error', 'Nombre y apellido son requeridos');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Error', 'Ingresa un email válido');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Error', 'El teléfono es requerido');
      return;
    }
    if (!password || password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (role === 'tenant' && !selectedProperty) {
      Alert.alert('Error', 'Selecciona una propiedad para el inquilino');
      return;
    }

    setSubmitting(true);
    try {
      await apiCall('/admin/users', {
        method: 'POST',
        body: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          role,
          password,
          property_id: role === 'tenant' ? selectedProperty?._id : null,
        },
      });

      Alert.alert(
        'Éxito',
        `Usuario creado correctamente.\n\nEmail: ${email}\nContraseña: ${password}`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo crear el usuario');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.brandRed} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={['rgba(59,130,246,0.08)', 'transparent']} style={styles.bgGradient} />
      
      <KeyboardAvoidingView
        style={{ flex: 1 }}
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
              <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Nuevo Usuario</Text>
              <Text style={styles.headerSubtitle}>Crear inquilino, propietario o admin</Text>
            </View>
          </View>

          {/* Role Selection */}
          <Text style={styles.label}>Rol del Usuario *</Text>
          <View style={styles.rolesGrid}>
            {USER_ROLES.map((r) => (
              <TouchableOpacity
                key={r.value}
                style={[styles.roleCard, role === r.value && { borderColor: r.color, backgroundColor: `${r.color}15` }]}
                onPress={() => setRole(r.value)}
              >
                <View style={[styles.roleIcon, { backgroundColor: `${r.color}20` }]}>
                  <Ionicons name={r.icon as any} size={20} color={r.color} />
                </View>
                <Text style={[styles.roleLabel, role === r.value && { color: r.color }]}>{r.label}</Text>
                <Text style={styles.roleDesc} numberOfLines={2}>{r.desc}</Text>
                {role === r.value && (
                  <View style={[styles.checkBadge, { backgroundColor: r.color }]}>
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Name Fields */}
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Nombre *</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Nombre"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Apellido *</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Apellido"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </View>

          {/* Email */}
          <Text style={styles.label}>Email *</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="mail" size={18} color={Colors.textMuted} />
            <TextInput
              style={styles.inputWithIcon}
              value={email}
              onChangeText={setEmail}
              placeholder="email@ejemplo.com"
              placeholderTextColor={Colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Phone */}
          <Text style={styles.label}>Teléfono *</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="call" size={18} color={Colors.textMuted} />
            <TextInput
              style={styles.inputWithIcon}
              value={phone}
              onChangeText={setPhone}
              placeholder="(806) 555-1234"
              placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
            />
          </View>

          {/* Property Selector for Tenants */}
          {role === 'tenant' && (
            <>
              <Text style={styles.label}>Propiedad Asignada *</Text>
              <TouchableOpacity
                style={styles.selector}
                onPress={() => setShowPropertyPicker(!showPropertyPicker)}
              >
                <Ionicons name="business" size={18} color={Colors.brandRed} />
                <Text style={[styles.selectorText, !selectedProperty && { color: Colors.textMuted }]}>
                  {selectedProperty?.name || 'Seleccionar propiedad'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={Colors.textMuted} />
              </TouchableOpacity>

              {showPropertyPicker && (
                <View style={styles.pickerList}>
                  {properties.map((p) => (
                    <TouchableOpacity
                      key={p._id}
                      style={[styles.pickerItem, selectedProperty?._id === p._id && styles.pickerItemActive]}
                      onPress={() => { setSelectedProperty(p); setShowPropertyPicker(false); }}
                    >
                      <Text style={styles.pickerItemText}>{p.name}</Text>
                      <Text style={styles.pickerItemSub}>{p.address}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}

          {/* Password */}
          <Text style={styles.label}>Contraseña *</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed" size={18} color={Colors.textMuted} />
            <TextInput
              style={styles.inputWithIcon}
              value={password}
              onChangeText={setPassword}
              placeholder="Mínimo 6 caracteres"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.generateBtn} onPress={generatePassword}>
            <Ionicons name="key" size={16} color={Colors.brandRed} />
            <Text style={styles.generateText}>Generar contraseña automática</Text>
          </TouchableOpacity>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Ionicons name="person-add" size={20} color={Colors.white} />
                <Text style={styles.submitText}>Crear Usuario</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.base },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  bgGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: Spacing.md },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.glassLight,
    borderWidth: 1, borderColor: Colors.glassBorderLight,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: FontSizes['2xl'], fontWeight: '800', color: Colors.textPrimary },
  headerSubtitle: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 2 },

  label: {
    fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textSecondary,
    marginTop: Spacing.md, marginBottom: 8,
  },

  rolesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  roleCard: {
    width: '48%', padding: 12, borderRadius: BorderRadius.md,
    backgroundColor: Colors.glass,
    borderWidth: 1.5, borderColor: Colors.glassBorderLight,
    position: 'relative',
  },
  roleIcon: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  roleLabel: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.textPrimary },
  roleDesc: { fontSize: 10, color: Colors.textMuted, marginTop: 4, lineHeight: 14 },
  checkBadge: {
    position: 'absolute', top: 8, right: 8,
    width: 20, height: 20, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },

  row: { flexDirection: 'row', gap: 12 },

  input: {
    backgroundColor: Colors.glass, padding: 14,
    borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.glassBorderLight,
    fontSize: FontSizes.sm, color: Colors.textPrimary,
  },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.glass, paddingHorizontal: 14,
    borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.glassBorderLight,
  },
  inputWithIcon: { flex: 1, paddingVertical: 14, fontSize: FontSizes.sm, color: Colors.textPrimary },

  selector: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.glass, padding: 14,
    borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.glassBorderLight,
  },
  selectorText: { flex: 1, fontSize: FontSizes.sm, color: Colors.textPrimary },

  pickerList: {
    backgroundColor: Colors.glassLight, borderRadius: BorderRadius.md,
    marginTop: 8, overflow: 'hidden',
  },
  pickerItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.glassLight },
  pickerItemActive: { backgroundColor: 'rgba(200,16,46,0.15)' },
  pickerItemText: { fontSize: FontSizes.sm, color: Colors.textPrimary, fontWeight: '600' },
  pickerItemSub: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 2 },

  generateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8,
  },
  generateText: { fontSize: FontSizes.xs, color: Colors.brandRed, fontWeight: '600' },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.brandRed, padding: 16, borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  submitText: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.textPrimary },
});
