import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeColors } from '../../constants/colors';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import AdminHeader from '../../components/admin/AdminHeader';

interface StripeConfig {
  test_mode: {
    secret_key_masked: string;
    publishable_key: string;
    webhook_secret_masked: string;
    has_secret_key: boolean;
    has_webhook_secret: boolean;
  };
  live_mode: {
    secret_key_masked: string;
    publishable_key: string;
    webhook_secret_masked: string;
    has_secret_key: boolean;
    has_webhook_secret: boolean;
  };
  active_mode: 'test' | 'live';
}

export default function StripeSettingsScreen() {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<StripeConfig | null>(null);
  const [activeTab, setActiveTab] = useState<'test' | 'live'>('test');

  // Test mode keys
  const [testSecretKey, setTestSecretKey] = useState('');
  const [testPublishableKey, setTestPublishableKey] = useState('');
  const [testWebhookSecret, setTestWebhookSecret] = useState('');

  // Live mode keys
  const [liveSecretKey, setLiveSecretKey] = useState('');
  const [livePublishableKey, setLivePublishableKey] = useState('');
  const [liveWebhookSecret, setLiveWebhookSecret] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/stripe-config');
      setConfig(response.data);
      
      // Load existing keys
      setTestPublishableKey(response.data.test_mode.publishable_key || '');
      setLivePublishableKey(response.data.live_mode.publishable_key || '');
      
      // Set active tab to current mode
      setActiveTab(response.data.active_mode);
    } catch (error: any) {
      console.error('Error loading config:', error);
      Alert.alert('Error', 'No se pudo cargar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveKeys = async () => {
    const mode = activeTab;
    const secretKey = mode === 'test' ? testSecretKey : liveSecretKey;
    const publishableKey = mode === 'test' ? testPublishableKey : livePublishableKey;
    const webhookSecret = mode === 'test' ? testWebhookSecret : liveWebhookSecret;

    if (!secretKey && !publishableKey && !webhookSecret) {
      Alert.alert('Error', 'Debes ingresar al menos una clave para actualizar');
      return;
    }

    // Validate key formats
    const secretPrefix = mode === 'test' ? 'sk_test_' : 'sk_live_';
    const publishablePrefix = mode === 'test' ? 'pk_test_' : 'pk_live_';

    if (secretKey && !secretKey.startsWith(secretPrefix)) {
      Alert.alert('Error', `La clave secreta debe comenzar con "${secretPrefix}"`);
      return;
    }

    if (publishableKey && !publishableKey.startsWith(publishablePrefix)) {
      Alert.alert('Error', `La clave pública debe comenzar con "${publishablePrefix}"`);
      return;
    }

    try {
      setSaving(true);
      const params = new URLSearchParams({ mode });
      if (secretKey) params.append('secret_key', secretKey);
      if (publishableKey) params.append('publishable_key', publishableKey);
      if (webhookSecret) params.append('webhook_secret', webhookSecret);

      await api.post(`/admin/stripe-config?${params.toString()}`);
      
      Alert.alert('Éxito', `Claves de modo ${mode.toUpperCase()} guardadas correctamente`);
      
      // Clear input fields
      if (mode === 'test') {
        setTestSecretKey('');
        setTestWebhookSecret('');
      } else {
        setLiveSecretKey('');
        setLiveWebhookSecret('');
      }
      
      // Reload config
      await loadConfig();
    } catch (error: any) {
      console.error('Error saving keys:', error);
      Alert.alert('Error', error.response?.data?.detail || 'No se pudieron guardar las claves');
    } finally {
      setSaving(false);
    }
  };

  const handleSwitchMode = async (newMode: 'test' | 'live') => {
    if (!config) return;

    if (newMode === config.active_mode) {
      return; // Already in this mode
    }

    // Check if keys exist for target mode
    const targetMode = newMode === 'test' ? config.test_mode : config.live_mode;
    if (!targetMode.has_secret_key || !targetMode.publishable_key) {
      Alert.alert(
        'Claves Faltantes',
        `Debes configurar las claves de modo ${newMode.toUpperCase()} antes de cambiar a este modo.`
      );
      return;
    }

    Alert.alert(
      'Confirmar Cambio',
      `¿Estás seguro de cambiar a modo ${newMode.toUpperCase()}?\n\nEsto afectará todas las transacciones de Stripe.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cambiar',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              const response = await api.post(`/admin/stripe-config/switch-mode?mode=${newMode}`);
              Alert.alert('Éxito', response.data.message);
              await loadConfig();
            } catch (error: any) {
              console.error('Error switching mode:', error);
              Alert.alert('Error', error.response?.data?.detail || 'No se pudo cambiar el modo');
            } finally {
              setSaving(false);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <AdminHeader title="Configuración de Stripe" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando configuración...</Text>
        </View>
      </View>
    );
  }

  const isTest = activeTab === 'test';
  const currentMode = isTest ? config?.test_mode : config?.live_mode;

  return (
    <View style={styles.container}>
      <AdminHeader title="Configuración de Stripe" />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>

        <View style={styles.content}>
          {/* Active Mode Banner */}
          <View style={[
            styles.modeBanner,
            { backgroundColor: config?.active_mode === 'live' ? colors.error + '15' : colors.warning + '15' }
          ]}>
            <Ionicons 
              name={config?.active_mode === 'live' ? "flash" : "flask"} 
              size={24} 
              color={config?.active_mode === 'live' ? colors.error : colors.warning}
            />
            <View style={styles.modeBannerText}>
              <Text style={styles.modeBannerTitle}>
                Modo Actual: {config?.active_mode === 'live' ? 'PRODUCCIÓN' : 'PRUEBA'}
              </Text>
              <Text style={styles.modeBannerSubtitle}>
                {config?.active_mode === 'live' 
                  ? 'Los pagos son reales y se procesan en vivo'
                  : 'Usa tarjetas de prueba para hacer transacciones de test'}
              </Text>
            </View>
          </View>

          {/* Tab Selector */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, isTest && styles.tabActive]}
              onPress={() => setActiveTab('test')}
            >
              <Ionicons name="flask" size={20} color={isTest ? '#FFF' : colors.text} />
              <Text style={[styles.tabText, isTest && styles.tabTextActive]}>
                Modo Test
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, !isTest && styles.tabActive]}
              onPress={() => setActiveTab('live')}
            >
              <Ionicons name="flash" size={20} color={!isTest ? '#FFF' : colors.text} />
              <Text style={[styles.tabText, !isTest && styles.tabTextActive]}>
                Modo Live
              </Text>
            </TouchableOpacity>
          </View>

          {/* Current Keys Status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Estado Actual</Text>
            
            <View style={styles.statusCard}>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Secret Key:</Text>
                <View style={styles.statusValue}>
                  <Ionicons 
                    name={currentMode?.has_secret_key ? "checkmark-circle" : "close-circle"} 
                    size={20} 
                    color={currentMode?.has_secret_key ? colors.success : colors.error}
                  />
                  <Text style={styles.statusText}>
                    {currentMode?.has_secret_key ? currentMode.secret_key_masked : 'No configurada'}
                  </Text>
                </View>
              </View>

              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Publishable Key:</Text>
                <View style={styles.statusValue}>
                  <Ionicons 
                    name={currentMode?.publishable_key ? "checkmark-circle" : "close-circle"} 
                    size={20} 
                    color={currentMode?.publishable_key ? colors.success : colors.error}
                  />
                  <Text style={styles.statusText}>
                    {currentMode?.publishable_key || 'No configurada'}
                  </Text>
                </View>
              </View>

              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Webhook Secret:</Text>
                <View style={styles.statusValue}>
                  <Ionicons 
                    name={currentMode?.has_webhook_secret ? "checkmark-circle" : "close-circle"} 
                    size={20} 
                    color={currentMode?.has_webhook_secret ? colors.success : colors.error}
                  />
                  <Text style={styles.statusText}>
                    {currentMode?.has_webhook_secret ? currentMode.webhook_secret_masked : 'No configurada'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Webhook URL Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚙️ Configurar Webhook en Stripe</Text>
            <Text style={styles.sectionSubtitle}>
              Antes de configurar el webhook secret, debes agregar este endpoint en Stripe:
            </Text>
            
            <View style={styles.webhookCard}>
              <View style={styles.webhookHeader}>
                <Ionicons name="link" size={20} color={colors.primary} />
                <Text style={styles.webhookTitle}>URL del Webhook</Text>
              </View>
              
              <View style={styles.webhookUrlContainer}>
                <Text style={styles.webhookUrl} selectable>
                  {Platform.OS === 'web' ? window.location.origin : 'https://tudominio.com'}/api/credits/stripe-webhook
                </Text>
              </View>
              
              <View style={styles.webhookSteps}>
                <Text style={styles.webhookStepTitle}>Pasos para configurar:</Text>
                <Text style={styles.webhookStep}>1. Ve a: https://dashboard.stripe.com/{isTest ? 'test/' : ''}webhooks</Text>
                <Text style={styles.webhookStep}>2. Clic en "Add endpoint" o "Agregar endpoint"</Text>
                <Text style={styles.webhookStep}>3. Pega la URL de arriba en "Endpoint URL"</Text>
                <Text style={styles.webhookStep}>4. Selecciona estos eventos:</Text>
                <Text style={styles.webhookStep}>   • checkout.session.completed</Text>
                <Text style={styles.webhookStep}>   • payment_intent.succeeded</Text>
                <Text style={styles.webhookStep}>   • payment_intent.payment_failed</Text>
                <Text style={styles.webhookStep}>5. Guarda el endpoint</Text>
                <Text style={styles.webhookStep}>6. Copia el "Signing secret" (whsec_...)</Text>
                <Text style={styles.webhookStep}>7. Pégalo abajo en "Webhook Secret"</Text>
              </View>
            </View>
          </View>

          {/* Update Keys Form */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Actualizar Claves API</Text>
            <Text style={styles.sectionSubtitle}>
              Obtén tus claves desde: https://dashboard.stripe.com/{isTest ? 'test/' : ''}apikeys
            </Text>

            <View style={styles.formCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Secret Key (sk_{isTest ? 'test' : 'live'}_...)</Text>
                <TextInput
                  style={styles.input}
                  value={isTest ? testSecretKey : liveSecretKey}
                  onChangeText={isTest ? setTestSecretKey : setLiveSecretKey}
                  placeholder={`sk_${isTest ? 'test' : 'live'}_...`}
                  secureTextEntry
                  placeholderTextColor={colors.textGray}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Publishable Key (pk_{isTest ? 'test' : 'live'}_...)</Text>
                <TextInput
                  style={styles.input}
                  value={isTest ? testPublishableKey : livePublishableKey}
                  onChangeText={isTest ? setTestPublishableKey : setLivePublishableKey}
                  placeholder={`pk_${isTest ? 'test' : 'live'}_...`}
                  placeholderTextColor={colors.textGray}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Webhook Secret (whsec_...) - Opcional</Text>
                <TextInput
                  style={styles.input}
                  value={isTest ? testWebhookSecret : liveWebhookSecret}
                  onChangeText={isTest ? setTestWebhookSecret : setLiveWebhookSecret}
                  placeholder="whsec_..."
                  secureTextEntry
                  placeholderTextColor={colors.textGray}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSaveKeys}
                disabled={saving}
              >
                <LinearGradient
                  colors={[colors.primary, colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.saveButtonGradient}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="save" size={20} color="#FFF" />
                      <Text style={styles.saveButtonText}>Guardar Claves</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* Switch Mode */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cambiar Modo Activo</Text>
            <Text style={styles.sectionSubtitle}>
              Cambia entre modo prueba y producción. Asegúrate de tener las claves configuradas primero.
            </Text>

            <View style={styles.switchCard}>
              <TouchableOpacity
                style={[
                  styles.switchButton,
                  config?.active_mode === 'test' && styles.switchButtonActive
                ]}
                onPress={() => handleSwitchMode('test')}
                disabled={saving}
              >
                <Ionicons name="flask" size={24} color={config?.active_mode === 'test' ? '#FFF' : colors.text} />
                <Text style={[
                  styles.switchButtonText,
                  config?.active_mode === 'test' && styles.switchButtonTextActive
                ]}>
                  Modo Test
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.switchButton,
                  config?.active_mode === 'live' && styles.switchButtonActive
                ]}
                onPress={() => handleSwitchMode('live')}
                disabled={saving}
              >
                <Ionicons name="flash" size={24} color={config?.active_mode === 'live' ? '#FFF' : colors.text} />
                <Text style={[
                  styles.switchButtonText,
                  config?.active_mode === 'live' && styles.switchButtonTextActive
                ]}>
                  Modo Live
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Info Card */}
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={24} color={colors.accent} />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>💡 Información Importante</Text>
              <Text style={styles.infoText}>
                • <Text style={styles.infoBold}>Modo Test:</Text> Usa tarjetas de prueba como 4242 4242 4242 4242
              </Text>
              <Text style={styles.infoText}>
                • <Text style={styles.infoBold}>Modo Live:</Text> Procesa pagos reales con tarjetas verdaderas
              </Text>
              <Text style={styles.infoText}>
                • Las claves son encriptadas y guardadas de forma segura
              </Text>
              <Text style={styles.infoText}>
                • El webhook secret es opcional pero recomendado
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textGray,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingTop: Platform.OS === 'web' ? 32 : 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
  },
  content: {
    padding: 20,
  },
  modeBanner: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 24,
  },
  modeBannerText: {
    flex: 1,
  },
  modeBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  modeBannerSubtitle: {
    fontSize: 14,
    color: colors.textGray,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundGray,
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  tabTextActive: {
    color: '#FFF',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.textGray,
    marginBottom: 16,
  },
  statusCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  statusRow: {
    gap: 8,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textGray,
  },
  statusValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 13,
    color: colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flex: 1,
  },
  formCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 20,
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  input: {
    backgroundColor: colors.backgroundGray,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  saveButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  switchCard: {
    flexDirection: 'row',
    gap: 12,
  },
  switchButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    gap: 8,
  },
  switchButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  switchButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  switchButtonTextActive: {
    color: '#FFF',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: colors.accent + '10',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.accent + '30',
  },
  infoContent: {
    flex: 1,
    gap: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  infoBold: {
    fontWeight: '700',
  },
  webhookCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 20,
    gap: 16,
    borderWidth: 2,
    borderColor: colors.primary + '30',
  },
  webhookHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  webhookTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  webhookUrlContainer: {
    backgroundColor: colors.backgroundGray,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  webhookUrl: {
    fontSize: 13,
    color: colors.primary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
  },
  webhookSteps: {
    backgroundColor: colors.accent + '10',
    padding: 12,
    borderRadius: 8,
    gap: 6,
  },
  webhookStepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  webhookStep: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
});