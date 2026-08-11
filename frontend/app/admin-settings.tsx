import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Share,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useColors, Spacing, FontSizes, BorderRadius } from '../src/constants/theme';
import { apiCall } from '../src/utils/api';
import { useAuth } from '../src/contexts/AuthContext';
import PaymentProcessorsAdmin from '../src/components/PaymentProcessorsAdmin';

const SETTINGS_KEY = '@admin_settings';

interface Settings {
  notifications: boolean;
  paymentReminders: boolean;
  maintenanceAlerts: boolean;
  autoReceipts: boolean;
}

export default function AdminSettingsScreen() {
  const Colors = useColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  const [settings, setSettings] = useState<Settings>({
    notifications: true,
    paymentReminders: true,
    maintenanceAlerts: true,
    autoReceipts: true,
  });

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch (err) {
      console.log('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (newSettings: Settings) => {
    setSettings(newSettings);
    setSaving(true);
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
      // Also save to backend for sync across devices
      await apiCall('/user/preferences', {
        method: 'POST',
        body: JSON.stringify({
          preferences: newSettings,
        }),
      }).catch(() => {}); // Silently fail if backend doesn't have this endpoint
    } catch (err) {
      console.log('Error saving settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const toggleSetting = (key: keyof Settings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    saveSettings(newSettings);
  };

  const toggleLanguage = async () => {
    const newLang = i18n.language === 'es' ? 'en' : 'es';
    await i18n.changeLanguage(newLang);
    await AsyncStorage.setItem('@app_language', newLang);
  };

  const handleExportReports = async () => {
    setExporting(true);
    try {
      // Fetch all data for the report
      const [propertiesData, paymentsData, tenantsData] = await Promise.all([
        apiCall('/admin/properties').catch(() => ({ properties: [] })),
        apiCall('/admin/rental-payments').catch(() => ({ payments: [] })),
        apiCall('/admin/tenants').catch(() => ({ tenants: [] })),
      ]);

      const properties = propertiesData.properties || propertiesData || [];
      const payments = paymentsData.payments || paymentsData || [];
      const tenants = tenantsData.tenants || tenantsData || [];

      // Generate CSV report
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      
      let csvContent = 'REPORTE DE ROSS HOUSE RENTALS\n';
      csvContent += `Generado: ${now.toLocaleString('es-MX')}\n\n`;
      
      // Properties section
      csvContent += '=== PROPIEDADES ===\n';
      csvContent += 'Nombre,Dirección,Estado,Renta Mensual\n';
      properties.forEach((p: any) => {
        csvContent += `"${p.name || ''}","${p.address || ''}","${p.status || ''}","$${p.rent_amount || 0}"\n`;
      });
      
      csvContent += '\n=== INQUILINOS ===\n';
      csvContent += 'Nombre,Email,Teléfono,Estado\n';
      tenants.forEach((t: any) => {
        const name = t.name || `${t.first_name || ''} ${t.last_name || ''}`;
        csvContent += `"${name}","${t.email || ''}","${t.phone || ''}","${t.status || ''}"\n`;
      });
      
      csvContent += '\n=== PAGOS RECIENTES ===\n';
      csvContent += 'Inquilino,Monto,Fecha,Estado\n';
      payments.slice(0, 50).forEach((p: any) => {
        csvContent += `"${p.tenant_name || ''}","$${p.amount || 0}","${p.date || ''}","${p.status || ''}"\n`;
      });

      // Summary
      const totalRent = properties.reduce((sum: number, p: any) => sum + (p.rent_amount || 0), 0);
      const totalCollected = payments.filter((p: any) => p.status === 'completed' || p.status === 'paid')
        .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
      
      csvContent += '\n=== RESUMEN ===\n';
      csvContent += `Total Propiedades: ${properties.length}\n`;
      csvContent += `Total Inquilinos: ${tenants.length}\n`;
      csvContent += `Renta Mensual Esperada: $${totalRent.toLocaleString()}\n`;
      csvContent += `Total Recaudado (visible): $${totalCollected.toLocaleString()}\n`;

      // Save and share file
      const fileName = `reporte_ross_house_${dateStr}.csv`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;
      
      await FileSystem.writeAsStringAsync(filePath, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Check if sharing is available
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'text/csv',
          dialogTitle: 'Exportar Reporte',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        // Fallback to share dialog
        await Share.share({
          message: csvContent,
          title: 'Reporte Ross House Rentals',
        });
      }

      Alert.alert('Éxito', 'Reporte exportado correctamente');
    } catch (err: any) {
      console.log('Export error:', err);
      Alert.alert('Error', 'No se pudo exportar el reporte. Intenta de nuevo.');
    } finally {
      setExporting(false);
    }
  };

  const handleBackup = () => {
    Alert.alert(
      'Respaldo de Datos',
      'Todos tus datos están seguros en la nube y se sincronizan automáticamente.\n\n¿Deseas enviar una copia del reporte por email?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar por Email',
          onPress: () => {
            const email = user?.email || 'admin@rosshouserentals.com';
            Linking.openURL(`mailto:${email}?subject=Respaldo%20Ross%20House%20Rentals&body=Solicito%20un%20respaldo%20de%20mis%20datos.`);
          },
        },
      ]
    );
  };

  const handleContactSupport = () => {
    Alert.alert(
      'Contactar Soporte',
      '¿Cómo prefieres contactarnos?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: '💬 Chat',
          onPress: () => router.push('/chat'),
        },
        {
          text: '📞 Llamar',
          onPress: () => Linking.openURL('tel:+18065550100'),
        },
        {
          text: '📧 Email',
          onPress: () => Linking.openURL('mailto:support@rosshouserentals.com'),
        },
      ]
    );
  };

  const SettingItem = ({ icon, label, description, value, onToggle, color = Colors.brandRed, disabled = false }: any) => (
    <View style={[styles.settingItem, disabled && { opacity: 0.5 }]}>
      <View style={[styles.settingIconWrap, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingLabel}>{label}</Text>
        {description && <Text style={styles.settingDesc}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: 'rgba(255,255,255,0.1)', true: `${color}50` }}
        thumbColor={value ? color : Colors.textMuted}
      />
    </View>
  );

  const MenuItem = ({ icon, label, onPress, color = Colors.textSecondary, loading: isLoading = false }: any) => (
    <TouchableOpacity 
      style={styles.menuItem} 
      onPress={onPress} 
      activeOpacity={0.7}
      disabled={isLoading}
    >
      <View style={[styles.settingIconWrap, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      {isLoading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.brandRed} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['rgba(6,182,212,0.08)', 'transparent']}
        style={styles.bgGradient}
      />
      
      <ScrollView
        style={[styles.container, { paddingTop: insets.top }]}
        contentContainerStyle={styles.content}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Configuración</Text>
            <Text style={styles.headerSubtitle}>Ajustes del Sistema</Text>
          </View>
          {saving && (
            <View style={styles.savingBadge}>
              <ActivityIndicator size="small" color={Colors.success} />
              <Text style={styles.savingText}>Guardando...</Text>
            </View>
          )}
        </View>

        {/* Notifications Section */}
        <Text style={styles.sectionTitle}>Notificaciones</Text>
        <View style={styles.settingsGroup}>
          <SettingItem
            icon="notifications"
            label="Notificaciones Push"
            description="Recibir alertas en el dispositivo"
            value={settings.notifications}
            onToggle={() => toggleSetting('notifications')}
            color="#3B82F6"
          />
          <SettingItem
            icon="calendar"
            label="Recordatorios de Pago"
            description="Alertas antes del vencimiento"
            value={settings.paymentReminders}
            onToggle={() => toggleSetting('paymentReminders')}
            color={Colors.success}
          />
          <SettingItem
            icon="construct"
            label="Alertas de Mantenimiento"
            description="Notificar nuevas solicitudes"
            value={settings.maintenanceAlerts}
            onToggle={() => toggleSetting('maintenanceAlerts')}
            color={Colors.warning}
          />
        </View>

        {/* Payment Processors Section */}
        <Text style={styles.sectionTitle}>Procesadores de Pago</Text>
        <PaymentProcessorsAdmin />

        {/* Automation Section */}
        <Text style={styles.sectionTitle}>Automatización</Text>
        <View style={styles.settingsGroup}>
          <SettingItem
            icon="receipt"
            label="Recibos Automáticos"
            description="Generar al recibir pagos"
            value={settings.autoReceipts}
            onToggle={() => toggleSetting('autoReceipts')}
            color="#8B5CF6"
          />
        </View>

        {/* Language Section */}
        <Text style={styles.sectionTitle}>Idioma</Text>
        <View style={styles.settingsGroup}>
          <TouchableOpacity style={styles.languageItem} onPress={toggleLanguage}>
            <View style={[styles.settingIconWrap, { backgroundColor: 'rgba(6,182,212,0.15)' }]}>
              <Ionicons name="globe" size={18} color="#06B6D4" />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Idioma de la App</Text>
              <Text style={styles.settingDesc}>
                {i18n.language === 'es' ? 'Español' : 'English'}
              </Text>
            </View>
            <View style={styles.languageBadge}>
              <Text style={styles.languageBadgeText}>
                {i18n.language.toUpperCase()}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Data Section */}
        <Text style={styles.sectionTitle}>Datos</Text>
        <View style={styles.settingsGroup}>
          <MenuItem
            icon="download"
            label="Exportar Reportes"
            onPress={handleExportReports}
            color="#06B6D4"
            loading={exporting}
          />
          <MenuItem
            icon="cloud-upload"
            label="Respaldo de Datos"
            onPress={handleBackup}
            color="#8B5CF6"
          />
        </View>

        {/* Support Section */}
        <Text style={styles.sectionTitle}>Soporte</Text>
        <View style={styles.settingsGroup}>
          <MenuItem
            icon="help-circle"
            label="Centro de Ayuda"
            onPress={() => router.push('/faq')}
            color="#3B82F6"
          />
          <MenuItem
            icon="chatbubbles"
            label="Contactar Soporte"
            onPress={handleContactSupport}
            color="#EC4899"
          />
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appInfoText}>Ross House Rentals v1.0.0</Text>
          <Text style={styles.appInfoText}>Build 59</Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.base },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  bgGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },
  
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: Spacing.md,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.glassLight,
    borderWidth: 1, borderColor: Colors.glassBorderLight,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: FontSizes['2xl'], fontWeight: '800', color: Colors.textPrimary },
  headerSubtitle: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 2 },
  
  savingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(16,185,129,0.15)',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  savingText: { fontSize: 10, color: Colors.success, fontWeight: '600' },

  sectionTitle: {
    fontSize: FontSizes.xs, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.2,
    marginBottom: 12, marginTop: Spacing.lg,
  },

  settingsGroup: {
    backgroundColor: Colors.glass,
    borderRadius: BorderRadius.card,
    borderWidth: 1, borderColor: Colors.glassBorder,
    overflow: 'hidden',
  },

  settingItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.glass,
  },
  settingIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  settingContent: { flex: 1 },
  settingLabel: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textPrimary },
  settingDesc: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 2 },

  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.glass,
  },
  menuLabel: { flex: 1, fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textPrimary },

  languageItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: Spacing.md,
  },
  languageBadge: {
    backgroundColor: 'rgba(6,182,212,0.15)',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  languageBadgeText: { fontSize: FontSizes.xs, fontWeight: '700', color: '#06B6D4' },

  appInfo: {
    alignItems: 'center', paddingVertical: Spacing.lg, marginTop: Spacing.lg,
  },
  appInfoText: { fontSize: FontSizes.xs, color: Colors.textMuted },
});
