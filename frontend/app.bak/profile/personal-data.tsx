import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, API_URL } from '../../src/constants/theme';
import { useTranslation } from 'react-i18next';
import AddressAutocomplete from '../../src/components/AddressAutocomplete';

export default function PersonalDataScreen() {
  const { token, user, refreshUser } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<any>({});
  const [ssnVisible, setSsnVisible] = useState(false);

  // Form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [ssn, setSsn] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('TX');
  const [zip, setZip] = useState('');
  const [employer, setEmployer] = useState('');
  const [empType, setEmpType] = useState('');
  const [income, setIncome] = useState('');

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        // Pre-fill
        const name = data.name || '';
        const parts = name.split(' ');
        setFirstName(data.first_name || parts[0] || '');
        setLastName(data.last_name || parts.slice(1).join(' ') || '');
        setPhone(data.phone || '');
        setEmail(data.email || '');
        setDob(data.date_of_birth || '');
        setSsn(data.ssn_encrypted || '');
        setStreet(data.address_street || (typeof data.address === 'string' ? data.address : '') || '');
        setCity(data.address_city || '');
        setState(data.address_state || 'TX');
        setZip(data.address_zip || '');
        setEmployer(data.employer || '');
        setEmpType(data.employment_type || '');
        setIncome(data.monthly_income || '');
      }
    } catch {}
    setLoading(false);
  };

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Error', t('personalData.nameRequired'));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/users/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          name: `${firstName.trim()} ${lastName.trim()}`,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone,
          email: email,
          date_of_birth: dob,
          ssn_encrypted: ssn.replace(/\D/g, ''),
          address_street: street,
          address_city: city,
          address_state: state,
          address_zip: zip,
          employer: employer,
          employment_type: empType,
          monthly_income: income,
        }),
      });
      if (res.ok) {
        Alert.alert('✅', t('personalData.savedMsg'));
        setEditing(false);
        fetchProfile();
        // Refresh AuthContext so apply form picks up changes
        refreshUser();
      } else {
        const err = await res.json();
        Alert.alert(t('common.error', 'Error'), err.detail || t('personalData.couldNotUpdate', 'Could not update'));
      }
    } catch {
      Alert.alert('Error', t('common.connectionError', 'Connection error'));
    }
    setSaving(false);
  };

  // Formatters
  const formatPhone = (text: string) => {
    const c = text.replace(/\D/g, '').slice(0, 10);
    if (c.length >= 7) return `(${c.slice(0, 3)}) ${c.slice(3, 6)}-${c.slice(6)}`;
    if (c.length >= 4) return `(${c.slice(0, 3)}) ${c.slice(3)}`;
    if (c.length > 0) return `(${c}`;
    return '';
  };
  const formatDOB = (text: string) => {
    const c = text.replace(/\D/g, '').slice(0, 8);
    if (c.length >= 5) return `${c.slice(0, 2)}/${c.slice(2, 4)}/${c.slice(4)}`;
    if (c.length >= 3) return `${c.slice(0, 2)}/${c.slice(2)}`;
    return c;
  };
  const formatSSN = (text: string) => {
    const c = text.replace(/\D/g, '').slice(0, 9);
    if (c.length >= 6) return `${c.slice(0, 3)}-${c.slice(3, 5)}-${c.slice(5)}`;
    if (c.length >= 4) return `${c.slice(0, 3)}-${c.slice(3)}`;
    return c;
  };
  const maskSSN = (ssn: string) => {
    const clean = ssn.replace(/\D/g, '');
    if (clean.length >= 4) return `***-**-${clean.slice(-4)}`;
    return '***-**-****';
  };

  if (loading) {
    return (
      <SafeAreaView style={S.container}>
        <Stack.Screen options={{ title: t('personalData.title') }} />
        <ActivityIndicator color={Colors.primaryLight} size="large" style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  // ═══ VIEW MODE ═══
  if (!editing) {
    const hasSSN = !!profile.ssn_encrypted || !!ssn;
    return (
      <>
        <Stack.Screen options={{ title: t('personalData.title') }} />
        <SafeAreaView style={S.container} edges={['bottom']}>
          <ScrollView contentContainerStyle={S.scroll}>

            {/* Completeness indicator */}
            <ProfileCompleteness profile={profile} />

            {/* Identity */}
            <View style={S.viewSection}>
              <View style={S.viewSectionHeader}>
                <Ionicons name="person" size={18} color={Colors.primaryLight} />
                <Text style={S.viewSectionTitle}>{t('personalData.identity')}</Text>
              </View>
              <DataRow label={t("personalData.name")} value={`${firstName} ${lastName}`.trim() || t('personalData.notEntered')} />
              <DataRow label={t("personalData.dob")} value={dob || t('personalData.notEntered')} />
              <View style={S.ssnRow}>
                <View style={{ flex: 1 }}>
                  <Text style={S.dataLabel}>{t("personalData.ssn")}</Text>
                  <Text style={[S.dataValue, !hasSSN && { color: Colors.textMuted }]}>
                    {hasSSN
                      ? (ssnVisible ? formatSSN(ssn || profile.ssn_encrypted) : maskSSN(ssn || profile.ssn_encrypted))
                      : t('personalData.notEntered')}
                  </Text>
                </View>
                {hasSSN && (
                  <TouchableOpacity onPress={() => setSsnVisible(!ssnVisible)} style={S.eyeBtn}>
                    <Ionicons name={ssnVisible ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Contact */}
            <View style={S.viewSection}>
              <View style={S.viewSectionHeader}>
                <Ionicons name="call" size={18} color="#3B82F6" />
                <Text style={S.viewSectionTitle}>{t('personalData.contact')}</Text>
              </View>
              <DataRow label={t("personalData.phone")} value={phone || t('personalData.notEntered')} />
              <DataRow label={t("personalData.email")} value={email || t('personalData.notEntered')} />
            </View>

            {/* Address */}
            <View style={S.viewSection}>
              <View style={S.viewSectionHeader}>
                <Ionicons name="location" size={18} color="#F59E0B" />
                <Text style={S.viewSectionTitle}>{t('personalData.address')}</Text>
              </View>
              <DataRow label={t("personalData.street")} value={street || t('personalData.notEntered')} />
              <DataRow label={t("personalData.cityStateZip")} value={
                city || state || zip ? `${city}, ${state} ${zip}`.trim() : t('personalData.notEntered')
              } />
            </View>

            {/* Employment */}
            <View style={S.viewSection}>
              <View style={S.viewSectionHeader}>
                <Ionicons name="briefcase" size={18} color="#8B5CF6" />
                <Text style={S.viewSectionTitle}>{t('personalData.employment')}</Text>
              </View>
              <DataRow label={t("personalData.employer")} value={employer || t('personalData.notEntered')} />
              <DataRow label="Tipo" value={
                empType === 'full_time' ? t('personalData.fullTime') :
                empType === 'part_time' ? t('personalData.partTime') :
                empType === 'self_employed' ? t('personalData.selfEmployed') :
                empType || t('personalData.notEntered')
              } />
              <DataRow label={t("personalData.monthlyIncome")} value={income ? `$${income}` : t('personalData.notEntered')} />
            </View>

            {/* Edit Button */}
            <TouchableOpacity style={S.editMainBtn} onPress={() => setEditing(true)}>
              <Ionicons name="create-outline" size={20} color="#fff" />
              <Text style={S.editMainBtnText}>{t('personalData.editInfo')}</Text>
            </TouchableOpacity>

            <View style={S.infoBox}>
              <Ionicons name="shield-checkmark" size={16} color={Colors.primaryLight} />
              <Text style={S.infoText}>{t('personalData.infoProtected')}</Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </>
    );
  }

  // ═══ EDIT MODE ═══
  return (
    <>
      <Stack.Screen options={{ title: t('personalData.editTitle') }} />
      <SafeAreaView style={S.container} edges={['bottom']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={S.scroll} keyboardShouldPersistTaps="handled">

            {/* Identity Section */}
            <View style={S.editSection}>
              <View style={S.editSectionHeader}>
                <Ionicons name="person" size={18} color={Colors.primaryLight} />
                <Text style={S.editSectionTitle}>{t('personalData.identity')}</Text>
              </View>

              <View style={S.row}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={S.label}>{t('personalData.firstName')} *</Text>
                  <TextInput style={S.input} value={firstName} onChangeText={setFirstName}
                    placeholder="Juan" placeholderTextColor={Colors.textMuted} autoCapitalize="words" />
                </View>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={S.label}>{t('personalData.lastName')} *</Text>
                  <TextInput style={S.input} value={lastName} onChangeText={setLastName}
                    placeholder="Pérez" placeholderTextColor={Colors.textMuted} autoCapitalize="words" />
                </View>
              </View>

              <Text style={S.label}>{t('personalData.dob')}</Text>
              <TextInput style={S.input} value={dob}
                onChangeText={v => setDob(formatDOB(v))}
                placeholder="MM/DD/AAAA" placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad" maxLength={10} />

              <Text style={S.label}>{t('personalData.ssn')} *</Text>
              <View style={S.ssnInputRow}>
                <TextInput
                  style={[S.input, { flex: 1 }]}
                  value={ssnVisible ? formatSSN(ssn) : (ssn ? maskSSN(ssn) : '')}
                  onChangeText={v => { setSsn(v.replace(/\D/g, '').slice(0, 9)); setSsnVisible(true); }}
                  onFocus={() => setSsnVisible(true)}
                  placeholder="XXX-XX-XXXX"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={11}
                />
                <TouchableOpacity onPress={() => setSsnVisible(!ssnVisible)} style={S.eyeBtnEdit}>
                  <Ionicons name={ssnVisible ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
              <Text style={S.hint}>{t('personalData.ssnHint')}{ssn.length >= 4 ? ssn.slice(-4) : '****'}</Text>
            </View>

            {/* Contact */}
            <View style={S.editSection}>
              <View style={S.editSectionHeader}>
                <Ionicons name="call" size={18} color="#3B82F6" />
                <Text style={S.editSectionTitle}>{t('personalData.contact')}</Text>
              </View>
              <Text style={S.label}>{t('personalData.phone')} *</Text>
              <TextInput style={S.input} value={phone}
                onChangeText={v => setPhone(formatPhone(v))}
                placeholder="(806) 555-0123" placeholderTextColor={Colors.textMuted}
                keyboardType="phone-pad" maxLength={14} />
              <Text style={S.label}>{t('personalData.email')}</Text>
              <TextInput style={S.input} value={email} onChangeText={setEmail}
                placeholder="tu@email.com" placeholderTextColor={Colors.textMuted}
                keyboardType="email-address" autoCapitalize="none" />
            </View>

            {/* Address */}
            <View style={S.editSection}>
              <View style={S.editSectionHeader}>
                <Ionicons name="location" size={18} color="#F59E0B" />
                <Text style={S.editSectionTitle}>{t('personalData.address')}</Text>
              </View>
              <AddressAutocomplete
                label={t('personalData.street')}
                value={street}
                onChangeText={setStreet}
                placeholder="1234 Main St, Houston, TX..."
                onAddressSelected={(components) => {
                  setStreet(components.street);
                  if (components.city) setCity(components.city);
                  if (components.state) setState(components.state);
                  if (components.zip) setZip(components.zip);
                }}
              />
              <View style={S.row}>
                <View style={{ flex: 2, marginRight: 6 }}>
                  <Text style={S.label}>{t('personalData.city')}</Text>
                  <TextInput style={S.input} value={city} onChangeText={setCity}
                    placeholder="Houston" placeholderTextColor={Colors.textMuted} autoCapitalize="words" />
                </View>
                <View style={{ flex: 1, marginHorizontal: 3 }}>
                  <Text style={S.label}>{t('personalData.state')}</Text>
                  <TextInput style={S.input} value={state} onChangeText={v => setState(v.toUpperCase().slice(0, 2))}
                    placeholder="TX" placeholderTextColor={Colors.textMuted} maxLength={2} autoCapitalize="characters" />
                </View>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={S.label}>ZIP</Text>
                  <TextInput style={S.input} value={zip} onChangeText={v => setZip(v.replace(/\D/g, '').slice(0, 5))}
                    placeholder="77001" placeholderTextColor={Colors.textMuted} keyboardType="number-pad" maxLength={5} />
                </View>
              </View>
            </View>

            {/* Employment */}
            <View style={S.editSection}>
              <View style={S.editSectionHeader}>
                <Ionicons name="briefcase" size={18} color="#8B5CF6" />
                <Text style={S.editSectionTitle}>{t('personalData.employment')}</Text>
              </View>
              <Text style={S.label}>{t('personalData.employer')}</Text>
              <TextInput style={S.input} value={employer} onChangeText={setEmployer}
                placeholder="Nombre de la empresa" placeholderTextColor={Colors.textMuted} autoCapitalize="words" />
              <Text style={S.label}>{t('personalData.monthlyIncome')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ position: 'absolute', left: 14, zIndex: 1, color: Colors.primaryLight, fontWeight: '700' }}>$</Text>
                <TextInput style={[S.input, { flex: 1, paddingLeft: 28 }]} value={income}
                  onChangeText={v => setIncome(v.replace(/[^0-9.]/g, ''))}
                  placeholder="2,500" placeholderTextColor={Colors.textMuted} keyboardType="numeric" />
              </View>
            </View>

            {/* Save / Cancel */}
            <View style={S.btnRow}>
              <TouchableOpacity style={S.cancelBtn} onPress={() => { setEditing(false); fetchProfile(); }}>
                <Text style={S.cancelBtnText}>{t('personalData.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[S.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                    <Text style={S.saveBtnText}>{t('personalData.save')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={{ height: 30 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

// ═══ SUB COMPONENTS ═══
function DataRow({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation();
  const empty = value === t('personalData.notEntered');
  return (
    <View style={S.dataRow}>
      <Text style={S.dataLabel}>{label}</Text>
      <Text style={[S.dataValue, empty && { color: Colors.textMuted, fontStyle: 'italic' }]}>{value}</Text>
    </View>
  );
}

function ProfileCompleteness({ profile }: { profile: any }) {
  const { t } = useTranslation();
  const fields = ['first_name', 'last_name', 'phone', 'email', 'date_of_birth',
    'ssn_encrypted', 'address_street', 'address_city', 'employer', 'monthly_income'];
  const filled = fields.filter(f => !!profile[f]).length;
  const pct = Math.round((filled / fields.length) * 100);
  const color = pct >= 80 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444';

  return (
    <View style={S.completenessCard}>
      <View style={S.completenessHeader}>
        <Ionicons name={pct >= 80 ? 'checkmark-circle' : 'alert-circle'} size={20} color={color} />
        <Text style={S.completenessTitle}>{t('personalData.profileComplete', {pct})}</Text>
      </View>
      <View style={S.progressBar}>
        <View style={[S.progressFill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={S.completenessHint}>
        {pct < 100 ? t('personalData.completeProfile', {filled, total: fields.length}) : t('personalData.profileDone')}
      </Text>
    </View>
  );
}

// ═══ STYLES ═══
const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },

  // View Mode
  viewSection: {
    backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  viewSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  viewSectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  dataRow: { marginBottom: 12 },
  dataLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  dataValue: { fontSize: 15, color: Colors.text, fontWeight: '500' },
  ssnRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  eyeBtn: { padding: 8 },

  // Completeness
  completenessCard: {
    backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  completenessHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  completenessTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  progressBar: { height: 6, backgroundColor: Colors.surface, borderRadius: 3, marginBottom: 8, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  completenessHint: { fontSize: 12, color: Colors.textMuted, lineHeight: 17 },

  // Edit Mode
  editSection: {
    backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  editSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  editSectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },

  label: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, borderWidth: 1, borderColor: Colors.border, color: Colors.text,
  },
  row: { flexDirection: 'row' },
  hint: { fontSize: 11, color: Colors.textMuted, marginTop: 4, marginLeft: 4 },

  // SSN input
  ssnInputRow: { flexDirection: 'row', alignItems: 'center' },
  eyeBtnEdit: { marginLeft: -44, padding: 12 },

  // Buttons
  editMainBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 16, marginTop: 8, marginBottom: 16,
  },
  editMainBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: 16,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  cancelBtnText: { color: Colors.textMuted, fontWeight: '600', fontSize: 15 },
  saveBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 16,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Info
  infoBox: {
    flexDirection: 'row', gap: 10, backgroundColor: 'rgba(5,150,105,0.06)',
    borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(5,150,105,0.15)',
  },
  infoText: { flex: 1, fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
});
