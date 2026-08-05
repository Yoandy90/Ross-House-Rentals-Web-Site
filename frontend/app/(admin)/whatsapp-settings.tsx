/**
 * WhatsApp Settings Screen
 * Configure WhatsApp Business API, Bot, and Templates
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '../../constants/colors';
import { useRouter } from 'expo-router';
import api from '../../services/api';

interface WhatsAppConfig {
  is_configured: boolean;
  bot_enabled: boolean;
  phone_number_id: string;
  business_account_id: string;
  webhook_url: string;
  webhook_verified: boolean;
}

interface WhatsAppStats {
  total_conversations: number;
  active_conversations: number;
  messages_today: number;
  messages_this_week: number;
  response_rate: number;
  avg_response_time: string;
}

interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
  status: 'approved' | 'pending' | 'rejected';
}

const DEFAULT_TEMPLATES = [
  { id: '1', name: 'Bienvenida', content: '¡Hola {{name}}! Gracias por contactar a Ross Tax Preparation. ¿En qué podemos ayudarte hoy?', category: 'greeting', status: 'approved' as const },
  { id: '2', name: 'Confirmación de Cita', content: 'Tu cita ha sido confirmada para el {{date}} a las {{time}}. Te esperamos en nuestra oficina.', category: 'appointment', status: 'approved' as const },
  { id: '3', name: 'Recordatorio', content: 'Hola {{name}}, te recordamos que tienes una cita pendiente el {{date}}. ¿Confirmas tu asistencia?', category: 'reminder', status: 'approved' as const },
  { id: '4', name: 'Documentos Pendientes', content: 'Hola {{name}}, necesitamos los siguientes documentos para continuar con tu trámite: {{documents}}', category: 'documents', status: 'approved' as const },
  { id: '5', name: 'Servicio Completado', content: '¡Buenas noticias {{name}}! Tu {{service}} ha sido completado exitosamente. Gracias por confiar en nosotros.', category: 'completion', status: 'approved' as const },
];

export default function WhatsAppSettingsScreen() {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'stats' | 'templates' | 'bot'>('config');
  
  const [config, setConfig] = useState<WhatsAppConfig>({
    is_configured: false,
    bot_enabled: false,
    phone_number_id: '',
    business_account_id: '',
    webhook_url: '',
    webhook_verified: false,
  });
  
  const [stats, setStats] = useState<WhatsAppStats>({
    total_conversations: 0,
    active_conversations: 0,
    messages_today: 0,
    messages_this_week: 0,
    response_rate: 0,
    avg_response_time: '0m',
  });
  
  const [templates, setTemplates] = useState<MessageTemplate[]>(DEFAULT_TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: '', content: '', category: 'general' });

  // Bot settings
  const [botEnabled, setBotEnabled] = useState(true);
  const [autoReply, setAutoReply] = useState(true);
  const [businessHoursOnly, setBusinessHoursOnly] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState('¡Hola! Soy el asistente virtual de Ross Tax Preparation. ¿En qué puedo ayudarte?');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load config
      const configRes = await api.get('/whatsapp/config').catch(() => ({ data: null }));
      if (configRes.data) {
        setConfig(configRes.data);
        setBotEnabled(configRes.data.bot_enabled || false);
      }
      
      // Load stats
      const statsRes = await api.get('/whatsapp/stats').catch(() => ({ data: null }));
      if (statsRes.data) {
        setStats(statsRes.data);
      }
      
      // Load templates
      const templatesRes = await api.get('/whatsapp/templates').catch(() => ({ data: null }));
      if (templatesRes.data?.templates) {
        setTemplates(templatesRes.data.templates);
      }
      
    } catch (error) {
      console.error('Error loading WhatsApp data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      await api.put('/whatsapp/config', {
        bot_enabled: botEnabled,
        auto_reply: autoReply,
        business_hours_only: businessHoursOnly,
        welcome_message: welcomeMessage,
      });
      Alert.alert('Éxito', 'Configuración guardada correctamente');
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleTestWebhook = async () => {
    try {
      setSaving(true);
      const res = await api.post('/whatsapp/test-webhook');
      if (res.data.success) {
        Alert.alert('Éxito', 'Webhook verificado correctamente');
        setConfig(prev => ({ ...prev, webhook_verified: true }));
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo verificar el webhook');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestMessage = async () => {
    Alert.prompt(
      'Enviar Mensaje de Prueba',
      'Ingresa el número de teléfono (con código de país):',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          onPress: async (phone) => {
            if (!phone) return;
            try {
              setSaving(true);
              await api.post('/whatsapp/send-test', {
                phone_number: phone,
                message: 'Este es un mensaje de prueba de Ross Tax Preparation 🎉'
              });
              Alert.alert('Éxito', 'Mensaje de prueba enviado');
            } catch (error) {
              Alert.alert('Error', 'No se pudo enviar el mensaje');
            } finally {
              setSaving(false);
            }
          }
        }
      ],
      'plain-text',
      '+1'
    );
  };

  const handleSaveTemplate = async () => {
    if (!newTemplate.name || !newTemplate.content) {
      Alert.alert('Error', 'Completa todos los campos');
      return;
    }
    
    try {
      setSaving(true);
      const res = await api.post('/whatsapp/templates', newTemplate);
      setTemplates(prev => [...prev, res.data.template || { ...newTemplate, id: Date.now().toString(), status: 'pending' as const }]);
      setTemplateModalVisible(false);
      setNewTemplate({ name: '', content: '', category: 'general' });
      Alert.alert('Éxito', 'Plantilla creada correctamente');
    } catch (error) {
      // Si el endpoint no existe, agregar localmente
      setTemplates(prev => [...prev, { ...newTemplate, id: Date.now().toString(), status: 'pending' as const }]);
      setTemplateModalVisible(false);
      setNewTemplate({ name: '', content: '', category: 'general' });
    } finally {
      setSaving(false);
    }
  };

  const renderConfigTab = () => (
    <View style={styles.tabContent}>
      {/* Status Card */}
      <View style={styles.statusCard}>
        <LinearGradient
          colors={config.is_configured ? ['#10B981', '#059669'] : ['#F59E0B', '#D97706']}
          style={styles.statusGradient}
        >
          <Ionicons 
            name={config.is_configured ? "checkmark-circle" : "warning"} 
            size={32} 
            color="#fff" 
          />
          <View style={styles.statusTextContainer}>
            <Text style={styles.statusTitle}>
              {config.is_configured ? 'WhatsApp Configurado' : 'Configuración Pendiente'}
            </Text>
            <Text style={styles.statusSubtitle}>
              {config.is_configured 
                ? 'Tu WhatsApp Business está listo para usar' 
                : 'Completa la configuración para comenzar'}
            </Text>
          </View>
        </LinearGradient>
      </View>

      {/* Connection Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📱 Información de Conexión</Text>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Phone Number ID:</Text>
          <Text style={styles.infoValue}>{config.phone_number_id || 'No configurado'}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Business Account ID:</Text>
          <Text style={styles.infoValue}>{config.business_account_id || 'No configurado'}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Webhook URL:</Text>
          <Text style={styles.infoValueSmall} numberOfLines={2}>
            {config.webhook_url || 'https://tu-dominio.com/api/whatsapp/webhook'}
          </Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Webhook Status:</Text>
          <View style={[styles.statusBadge, { backgroundColor: config.webhook_verified ? '#10B98120' : '#F59E0B20' }]}>
            <Ionicons 
              name={config.webhook_verified ? "checkmark-circle" : "time"} 
              size={16} 
              color={config.webhook_verified ? '#10B981' : '#F59E0B'} 
            />
            <Text style={[styles.statusBadgeText, { color: config.webhook_verified ? '#10B981' : '#F59E0B' }]}>
              {config.webhook_verified ? 'Verificado' : 'Pendiente'}
            </Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚡ Acciones Rápidas</Text>
        
        <TouchableOpacity style={styles.actionButton} onPress={handleTestWebhook}>
          <Ionicons name="refresh-circle" size={24} color="#3B82F6" />
          <View style={styles.actionButtonText}>
            <Text style={styles.actionButtonTitle}>Verificar Webhook</Text>
            <Text style={styles.actionButtonSubtitle}>Comprobar conexión con Meta</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton} onPress={handleSendTestMessage}>
          <Ionicons name="paper-plane" size={24} color="#10B981" />
          <View style={styles.actionButtonText}>
            <Text style={styles.actionButtonTitle}>Enviar Mensaje de Prueba</Text>
            <Text style={styles.actionButtonSubtitle}>Verificar envío de mensajes</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={() => router.push('/_adminScreens/whatsapp-conversations')}
        >
          <Ionicons name="chatbubbles" size={24} color="#8B5CF6" />
          <View style={styles.actionButtonText}>
            <Text style={styles.actionButtonTitle}>Ver Conversaciones</Text>
            <Text style={styles.actionButtonSubtitle}>Gestionar chats de WhatsApp</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStatsTab = () => (
    <View style={styles.tabContent}>
      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <LinearGradient colors={['#3B82F6', '#2563EB']} style={styles.statGradient}>
            <Ionicons name="chatbubbles" size={28} color="#fff" />
          </LinearGradient>
          <Text style={styles.statValue}>{stats.total_conversations}</Text>
          <Text style={styles.statLabel}>Total Conversaciones</Text>
        </View>
        
        <View style={styles.statCard}>
          <LinearGradient colors={['#10B981', '#059669']} style={styles.statGradient}>
            <Ionicons name="pulse" size={28} color="#fff" />
          </LinearGradient>
          <Text style={styles.statValue}>{stats.active_conversations}</Text>
          <Text style={styles.statLabel}>Activas</Text>
        </View>
        
        <View style={styles.statCard}>
          <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.statGradient}>
            <Ionicons name="today" size={28} color="#fff" />
          </LinearGradient>
          <Text style={styles.statValue}>{stats.messages_today}</Text>
          <Text style={styles.statLabel}>Mensajes Hoy</Text>
        </View>
        
        <View style={styles.statCard}>
          <LinearGradient colors={['#8B5CF6', '#7C3AED']} style={styles.statGradient}>
            <Ionicons name="calendar" size={28} color="#fff" />
          </LinearGradient>
          <Text style={styles.statValue}>{stats.messages_this_week}</Text>
          <Text style={styles.statLabel}>Esta Semana</Text>
        </View>
      </View>

      {/* Performance */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 Rendimiento</Text>
        
        <View style={styles.performanceCard}>
          <View style={styles.performanceRow}>
            <View style={styles.performanceItem}>
              <Text style={styles.performanceLabel}>Tasa de Respuesta</Text>
              <Text style={[styles.performanceValue, { color: '#10B981' }]}>{stats.response_rate}%</Text>
            </View>
            <View style={styles.performanceDivider} />
            <View style={styles.performanceItem}>
              <Text style={styles.performanceLabel}>Tiempo Promedio</Text>
              <Text style={[styles.performanceValue, { color: '#3B82F6' }]}>{stats.avg_response_time}</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  const renderBotTab = () => (
    <View style={styles.tabContent}>
      {/* Bot Status */}
      <View style={styles.botStatusCard}>
        <View style={styles.botStatusHeader}>
          <View style={styles.botIconContainer}>
            <Ionicons name="hardware-chip" size={32} color="#8B5CF6" />
          </View>
          <View style={styles.botStatusText}>
            <Text style={styles.botStatusTitle}>Ross AI Bot</Text>
            <Text style={styles.botStatusSubtitle}>Asistente Virtual Inteligente</Text>
          </View>
          <Switch
            value={botEnabled}
            onValueChange={setBotEnabled}
            trackColor={{ false: '#E5E7EB', true: '#8B5CF620' }}
            thumbColor={botEnabled ? '#8B5CF6' : '#9CA3AF'}
          />
        </View>
      </View>

      {/* Bot Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚙️ Configuración del Bot</Text>
        
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Ionicons name="flash" size={20} color="#F59E0B" />
            <View style={styles.settingText}>
              <Text style={styles.settingTitle}>Respuesta Automática</Text>
              <Text style={styles.settingSubtitle}>Responder automáticamente a nuevos mensajes</Text>
            </View>
          </View>
          <Switch
            value={autoReply}
            onValueChange={setAutoReply}
            trackColor={{ false: '#E5E7EB', true: '#10B98120' }}
            thumbColor={autoReply ? '#10B981' : '#9CA3AF'}
          />
        </View>
        
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Ionicons name="time" size={20} color="#3B82F6" />
            <View style={styles.settingText}>
              <Text style={styles.settingTitle}>Solo Horario Laboral</Text>
              <Text style={styles.settingSubtitle}>Bot activo solo de 9AM a 6PM</Text>
            </View>
          </View>
          <Switch
            value={businessHoursOnly}
            onValueChange={setBusinessHoursOnly}
            trackColor={{ false: '#E5E7EB', true: '#3B82F620' }}
            thumbColor={businessHoursOnly ? '#3B82F6' : '#9CA3AF'}
          />
        </View>
      </View>

      {/* Welcome Message */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>👋 Mensaje de Bienvenida</Text>
        <TextInput
          style={styles.welcomeInput}
          value={welcomeMessage}
          onChangeText={setWelcomeMessage}
          multiline
          numberOfLines={4}
          placeholder="Escribe el mensaje de bienvenida..."
          placeholderTextColor="#9CA3AF"
        />
      </View>

      {/* Save Button */}
      <TouchableOpacity 
        style={styles.saveButton}
        onPress={handleSaveConfig}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="save" size={20} color="#fff" />
            <Text style={styles.saveButtonText}>Guardar Configuración</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderTemplatesTab = () => (
    <View style={styles.tabContent}>
      {/* Add Template Button */}
      <TouchableOpacity 
        style={styles.addTemplateButton}
        onPress={() => setTemplateModalVisible(true)}
      >
        <Ionicons name="add-circle" size={24} color="#fff" />
        <Text style={styles.addTemplateText}>Nueva Plantilla</Text>
      </TouchableOpacity>

      {/* Templates List */}
      {templates.map((template) => (
        <TouchableOpacity 
          key={template.id}
          style={styles.templateCard}
          onPress={() => {
            setSelectedTemplate(template);
            Alert.alert(template.name, template.content);
          }}
        >
          <View style={styles.templateHeader}>
            <View style={styles.templateIcon}>
              <Ionicons name="document-text" size={20} color="#3B82F6" />
            </View>
            <View style={styles.templateInfo}>
              <Text style={styles.templateName}>{template.name}</Text>
              <Text style={styles.templateCategory}>{template.category}</Text>
            </View>
            <View style={[
              styles.templateStatus,
              { backgroundColor: template.status === 'approved' ? '#10B98120' : template.status === 'pending' ? '#F59E0B20' : '#EF444420' }
            ]}>
              <Text style={[
                styles.templateStatusText,
                { color: template.status === 'approved' ? '#10B981' : template.status === 'pending' ? '#F59E0B' : '#EF4444' }
              ]}>
                {template.status === 'approved' ? 'Aprobada' : template.status === 'pending' ? 'Pendiente' : 'Rechazada'}
              </Text>
            </View>
          </View>
          <Text style={styles.templateContent} numberOfLines={2}>{template.content}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#25D366', '#128C7E']} style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: '#fff' }]}>WhatsApp Business</Text>
          <View style={{ width: 40 }} />
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando configuración...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#25D366', '#128C7E']} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: '#fff' }]}>WhatsApp Business</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabs}>
        {[
          { key: 'config', label: 'Configuración', icon: 'settings' },
          { key: 'stats', label: 'Estadísticas', icon: 'stats-chart' },
          { key: 'bot', label: 'Bot IA', icon: 'hardware-chip' },
          { key: 'templates', label: 'Plantillas', icon: 'document-text' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key as any)}
          >
            <Ionicons 
              name={tab.icon as any} 
              size={18} 
              color={activeTab === tab.key ? colors.primary : '#9CA3AF'} 
            />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />
        }
      >
        {activeTab === 'config' && renderConfigTab()}
        {activeTab === 'stats' && renderStatsTab()}
        {activeTab === 'bot' && renderBotTab()}
        {activeTab === 'templates' && renderTemplatesTab()}
      </ScrollView>

      {/* New Template Modal */}
      <Modal
        visible={templateModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setTemplateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nueva Plantilla</Text>
              <TouchableOpacity onPress={() => setTemplateModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Nombre de la plantilla"
              value={newTemplate.name}
              onChangeText={(text) => setNewTemplate(prev => ({ ...prev, name: text }))}
              placeholderTextColor="#9CA3AF"
            />
            
            <TextInput
              style={[styles.modalInput, styles.modalTextarea]}
              placeholder="Contenido del mensaje (usa {{variable}} para variables)"
              value={newTemplate.content}
              onChangeText={(text) => setNewTemplate(prev => ({ ...prev, content: text }))}
              multiline
              numberOfLines={4}
              placeholderTextColor="#9CA3AF"
            />
            
            <TouchableOpacity 
              style={styles.modalSaveButton}
              onPress={handleSaveTemplate}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalSaveButtonText}>Guardar Plantilla</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.card,
    gap: 6,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.background,
  },
  tabActive: {
    backgroundColor: colors.primary + '15',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  tabTextActive: {
    color: colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  tabContent: {
    gap: 16,
  },
  // Status Card
  statusCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  statusGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  statusSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  // Section
  section: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  // Info Row
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  infoValueSmall: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.text,
    maxWidth: 180,
    textAlign: 'right',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Action Button
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: colors.background,
    borderRadius: 12,
    marginBottom: 10,
    gap: 12,
  },
  actionButtonText: {
    flex: 1,
  },
  actionButtonTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  actionButtonSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '47%',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statGradient: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  // Performance
  performanceCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
  },
  performanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  performanceItem: {
    flex: 1,
    alignItems: 'center',
  },
  performanceDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  performanceLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  performanceValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  // Bot Status
  botStatusCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
  },
  botStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  botIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#8B5CF615',
    justifyContent: 'center',
    alignItems: 'center',
  },
  botStatusText: {
    flex: 1,
  },
  botStatusTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  botStatusSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  // Settings Row
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  settingSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  // Welcome Input
  welcomeInput: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: colors.text,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  // Save Button
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  // Templates
  addTemplateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#25D366',
    paddingVertical: 14,
    borderRadius: 12,
  },
  addTemplateText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  templateCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  templateIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#3B82F615',
    justifyContent: 'center',
    alignItems: 'center',
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  templateCategory: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  templateStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  templateStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  templateContent: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  modalInput: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: colors.text,
    marginBottom: 12,
  },
  modalTextarea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalSaveButton: {
    backgroundColor: '#25D366',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  modalSaveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
