import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, ActivityIndicator, RefreshControl
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, FontSizes, BorderRadius, useColors } from '../../src/constants/theme';
import { apiCall } from '../../src/utils/api';

interface EmergencyContact {
  _id: string;
  name_es: string;
  name_en: string;
  phone: string;
  icon: string;
  color: string;
  available: string;
  order: number;
  is_active: boolean;
}

// Map icon names to Ionicons
const iconMap: { [key: string]: keyof typeof Ionicons.glyphMap } = {
  business: 'business',
  warning: 'warning',
  shield: 'shield-checkmark',
  flame: 'flame',
  medkit: 'medkit',
  'alert-circle': 'alert-circle',
  call: 'call',
};

export default function EmergencyScreen() {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isSpanish = i18n.language === 'es';

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      const data = await apiCall('/public/emergency-contacts');
      if (data.success && data.contacts) {
        setContacts(data.contacts);
      }
    } catch (err) {
      console.log('Error loading emergency contacts:', err);
      // Use fallback contacts if API fails — Dumas TX area essentials
      setContacts([
        { _id: '1', name_es: 'Emergencias 911', name_en: '911 Emergency', phone: '911', icon: 'warning', color: '#EF4444', available: '24/7', order: 1, is_active: true },
        { _id: '2', name_es: 'Policía de Dumas', name_en: 'Dumas Police Dept', phone: '8069354151', icon: 'shield', color: '#3B82F6', available: 'No-emergencia 24h', order: 2, is_active: true },
        { _id: '3', name_es: 'Bomberos de Dumas', name_en: 'Dumas Fire Dept', phone: '8069353151', icon: 'flame', color: '#F97316', available: 'No-emergencia 24h', order: 3, is_active: true },
        { _id: '4', name_es: 'Sheriff Moore County', name_en: 'Moore County Sheriff', phone: '8069354145', icon: 'shield-checkmark', color: '#6366F1', available: '24/7', order: 4, is_active: true },
        { _id: '5', name_es: 'Hospital Moore County', name_en: 'Moore County Hospital', phone: '8069357171', icon: 'medkit', color: '#10B981', available: '24/7 ER', order: 5, is_active: true },
        { _id: '6', name_es: 'Control de Envenenamiento', name_en: 'Poison Control', phone: '18002221222', icon: 'flask', color: '#A855F7', available: '24/7 nacional', order: 6, is_active: true },
        { _id: '7', name_es: 'Xcel Energy (apagón)', name_en: 'Xcel Energy (outage)', phone: '18008951999', icon: 'flash', color: '#FBBF24', available: '24/7', order: 7, is_active: true },
        { _id: '8', name_es: 'Atmos Energy (fuga de gas)', name_en: 'Atmos Energy (gas leak)', phone: '18663228667', icon: 'warning', color: '#DC2626', available: '24/7 EMERGENCIA', order: 8, is_active: true },
        { _id: '9', name_es: 'Agua Ciudad de Dumas', name_en: 'City of Dumas Water', phone: '8069355505', icon: 'water', color: '#0EA5E9', available: 'Lun-Vie 8am-5pm', order: 9, is_active: true },
        { _id: '10', name_es: 'Texas DPS (carretera)', name_en: 'Texas DPS Highway Patrol', phone: '8069356655', icon: 'car-sport', color: '#64748B', available: '24/7', order: 10, is_active: true },
        { _id: '11', name_es: 'Ross House Rentals', name_en: 'Ross House Rentals (Landlord)', phone: '8062227777', icon: 'home', color: '#F59E0B', available: '24/7 mantenimiento', order: 11, is_active: true },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadContacts();
  };

  const handleCall = (phone: string) => {
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleanPhone}`);
  };

  const getIconName = (icon: string): keyof typeof Ionicons.glyphMap => {
    return iconMap[icon] || 'call';
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={C.brandRed} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{isSpanish ? 'Emergencia' : 'Emergency'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Alert Banner */}
      <View style={styles.alertBanner}>
        <LinearGradient
          colors={['rgba(239, 68, 68, 0.15)', 'rgba(239, 68, 68, 0.05)']}
          style={StyleSheet.absoluteFill}
        />
        <Ionicons name="warning" size={24} color="#EF4444" />
        <Text style={styles.alertText}>
          {isSpanish 
            ? 'En caso de emergencia que ponga en peligro la vida, llame al 911 inmediatamente.'
            : 'For life-threatening emergencies, call 911 immediately.'}
        </Text>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.brandRed}
          />
        }
      >
        <Text style={styles.sectionTitle}>
          {isSpanish ? 'Contactos de Emergencia' : 'Emergency Contacts'}
        </Text>

        {contacts.map((contact) => (
          <TouchableOpacity
            key={contact._id}
            style={styles.contactCard}
            onPress={() => handleCall(contact.phone)}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[`${contact.color}15`, `${contact.color}05`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            
            <View style={[styles.iconWrap, { backgroundColor: `${contact.color}20` }]}>
              <Ionicons 
                name={getIconName(contact.icon)} 
                size={24} 
                color={contact.color} 
              />
            </View>
            
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>
                {isSpanish ? contact.name_es : contact.name_en}
              </Text>
              <Text style={styles.contactPhone}>{contact.phone}</Text>
              <Text style={styles.contactAvailable}>{contact.available}</Text>
            </View>
            
            <View style={[styles.callButton, { backgroundColor: contact.color }]}>
              <Ionicons name="call" size={20} color={C.white} />
            </View>
          </TouchableOpacity>
        ))}

        {contacts.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={48} color={C.textMuted} />
            <Text style={styles.emptyText}>
              {isSpanish 
                ? 'No hay contactos de emergencia disponibles.'
                : 'No emergency contacts available.'}
            </Text>
          </View>
        )}

        {/* Important info */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={20} color={C.textMuted} />
          <Text style={styles.infoText}>
            {isSpanish
              ? 'Mantenga estos números accesibles. Para emergencias de mantenimiento después de horas de oficina, use el número de emergencia 24/7.'
              : 'Keep these numbers accessible. For after-hours maintenance emergencies, use the 24/7 emergency number.'}
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  loadingContainer: { flex: 1, backgroundColor: C.background, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: Spacing.base, paddingBottom: 40 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  title: { fontSize: FontSizes['2xl'], fontWeight: '800', color: C.textPrimary, letterSpacing: -0.5 },

  // Alert Banner
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    overflow: 'hidden',
  },
  alertText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: '#EF4444',
    fontWeight: '500',
    lineHeight: 20,
  },

  // Section
  sectionTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },

  // Contact Card
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    borderColor: C.glassBorder,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: FontSizes.base,
    fontWeight: '700',
    color: C.textPrimary,
    marginBottom: 2,
  },
  contactPhone: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: C.textPrimary,
    marginBottom: 2,
  },
  contactAvailable: {
    fontSize: FontSizes.xs,
    color: C.textMuted,
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  emptyText: {
    fontSize: FontSizes.sm,
    color: C.textMuted,
    marginTop: Spacing.md,
    textAlign: 'center',
  },

  // Info Card
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: Spacing.md,
    backgroundColor: C.glass,
    borderRadius: BorderRadius.card,
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  infoText: {
    flex: 1,
    fontSize: FontSizes.xs,
    color: C.textMuted,
    lineHeight: 18,
  },
});
