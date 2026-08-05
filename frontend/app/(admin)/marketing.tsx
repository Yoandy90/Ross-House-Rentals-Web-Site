import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  FlatList,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../services/api';

interface MarketingClient {
  id: string;
  email: string;
  name: string;
  phone?: string;
  status: string;
  last_tax_year?: string;
  subscribed_at?: string;
  last_email_sent?: string;
  campaigns_sent: number;
}

interface Campaign {
  id: string;
  subject: string;
  total_recipients: number;
  sent: number;
  failed: number;
  status: string;
  created_at?: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  subject: string;
}

const TEMPLATE_CONTENTS: { [key: string]: string } = {
  'tax_tips_monthly': `
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background: linear-gradient(135deg, #6C1110 0%, #8B1A19 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="margin: 0;">💡 Tips Fiscales del Mes</h1>
  </div>
  <div style="background-color: #fff; padding: 30px; border-radius: 0 0 10px 10px;">
    <h2>Hola {{nombre}},</h2>
    <p>Aquí te compartimos algunos tips importantes para este mes:</p>
    <ul style="line-height: 2;">
      <li>📅 Guarda todos tus recibos de gastos deducibles</li>
      <li>💰 Si eres trabajador independiente, haz pagos estimados trimestrales</li>
      <li>🏠 Los intereses de hipoteca pueden ser deducibles</li>
      <li>👨‍👩‍👧 Verifica que tengas los Social Security de tus dependientes</li>
    </ul>
    <p style="background-color: #EFF6FF; padding: 15px; border-radius: 8px;">
      <strong>¿Tienes preguntas?</strong> Llámanos al (806) 934-2018
    </p>
    <p style="color: #888; font-size: 12px; text-align: center; margin-top: 30px;">
      Ross Tax Preparation | 305 Bruce Ave, Dumas, TX 79029
    </p>
  </div>
</body>
</html>
  `,
  'tax_season_reminder': `
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="margin: 0;">📅 ¡La Temporada de Impuestos Está Aquí!</h1>
  </div>
  <div style="background-color: #fff; padding: 30px; border-radius: 0 0 10px 10px;">
    <h2>Hola {{nombre}},</h2>
    <p>Es hora de preparar tu declaración de impuestos. ¡No dejes para mañana lo que puedes hacer hoy!</p>
    <div style="background-color: #D1FAE5; padding: 20px; border-radius: 10px; margin: 20px 0;">
      <h3 style="color: #065F46; margin-top: 0;">Beneficios de declarar temprano:</h3>
      <ul style="color: #047857;">
        <li>Recibe tu reembolso más rápido</li>
        <li>Evita la prisa de último momento</li>
        <li>Más tiempo para reunir documentos</li>
        <li>Mejor disponibilidad de citas</li>
      </ul>
    </div>
    <div style="text-align: center;">
      <a href="https://www.rosstaxpreparation.com/agendar" style="display: inline-block; background-color: #10B981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
        📆 Agendar Cita Ahora
      </a>
    </div>
    <p style="color: #888; font-size: 12px; text-align: center; margin-top: 30px;">
      Ross Tax Preparation | (806) 934-2018
    </p>
  </div>
</body>
</html>
  `,
  'document_checklist': `
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="margin: 0;">📋 Lista de Documentos para tu Declaración</h1>
  </div>
  <div style="background-color: #fff; padding: 30px; border-radius: 0 0 10px 10px;">
    <h2>Hola {{nombre}},</h2>
    <p>Asegúrate de tener estos documentos listos para tu cita:</p>
    <div style="background-color: #EFF6FF; padding: 20px; border-radius: 10px; margin: 20px 0;">
      <h3 style="color: #1E40AF; margin-top: 0;">✅ Documentos Necesarios:</h3>
      <ul style="color: #1E3A8A; line-height: 2;">
        <li>W-2 de todos tus empleadores</li>
        <li>1099 si trabajas por cuenta propia</li>
        <li>Identificación válida (ID o licencia)</li>
        <li>Social Security de todos los dependientes</li>
        <li>Información bancaria para depósito directo</li>
        <li>Declaración del año anterior (si es posible)</li>
      </ul>
    </div>
    <p style="background-color: #FEF3C7; padding: 15px; border-radius: 8px; color: #92400E;">
      <strong>💡 Tip:</strong> Mientras más documentos traigas, más deducciones podemos encontrar.
    </p>
    <p style="color: #888; font-size: 12px; text-align: center; margin-top: 30px;">
      Ross Tax Preparation | (806) 934-2018
    </p>
  </div>
</body>
</html>
  `,
  'early_bird_promo': `
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="margin: 0;">🎁 ¡Descuento Especial por Declarar Temprano!</h1>
  </div>
  <div style="background-color: #fff; padding: 30px; border-radius: 0 0 10px 10px;">
    <h2>Hola {{nombre}},</h2>
    <p>Por ser cliente de Ross Tax, tienes acceso a una promoción exclusiva:</p>
    <div style="background-color: #FEF3C7; padding: 30px; border-radius: 10px; margin: 20px 0; text-align: center;">
      <p style="color: #92400E; font-size: 18px; margin: 0;">Declara antes del 15 de febrero y recibe</p>
      <p style="color: #B45309; font-size: 48px; font-weight: bold; margin: 10px 0;">$20 OFF</p>
      <p style="color: #92400E; margin: 0;">en tu preparación de impuestos</p>
    </div>
    <div style="text-align: center;">
      <a href="https://www.rosstaxpreparation.com/agendar" style="display: inline-block; background-color: #F59E0B; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
        📆 Agendar y Ahorrar
      </a>
    </div>
    <p style="color: #888; font-size: 12px; text-align: center; margin-top: 30px;">
      *Promoción válida hasta el 15 de febrero. Ross Tax Preparation | (806) 934-2018
    </p>
  </div>
</body>
</html>
  `,
  'referral_reminder': `
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background: linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="margin: 0;">👥 Gana Dinero Refiriendo Amigos</h1>
  </div>
  <div style="background-color: #fff; padding: 30px; border-radius: 0 0 10px 10px;">
    <h2>Hola {{nombre}},</h2>
    <p>¿Sabías que puedes ganar dinero por cada persona que refieras a Ross Tax?</p>
    <div style="background-color: #EDE9FE; padding: 30px; border-radius: 10px; margin: 20px 0; text-align: center;">
      <p style="color: #5B21B6; font-size: 18px; margin: 0;">Por cada referido que complete su declaración:</p>
      <p style="color: #6D28D9; font-size: 48px; font-weight: bold; margin: 10px 0;">$25</p>
      <p style="color: #5B21B6; margin: 0;">para ti y $15 de descuento para tu amigo</p>
    </div>
    <p style="text-align: center; color: #555;">
      Solo dile a tus amigos que mencionen tu nombre cuando agenden su cita.
    </p>
    <p style="color: #888; font-size: 12px; text-align: center; margin-top: 30px;">
      Ross Tax Preparation | (806) 934-2018
    </p>
  </div>
</body>
</html>
  `,
};

export default function MarketingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [activeTab, setActiveTab] = useState<'clients' | 'campaigns' | 'compose'>('clients');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Clients data
  const [clients, setClients] = useState<MarketingClient[]>([]);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  
  // Campaigns data
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  
  // Templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  
  // Compose state
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailContent, setEmailContent] = useState('');
  const [sendToAll, setSendToAll] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [clientsRes, campaignsRes, templatesRes] = await Promise.all([
        api.get('/admin/marketing/list'),
        api.get('/admin/marketing/campaigns'),
        api.get('/admin/marketing/templates'),
      ]);
      
      if (clientsRes.data.success) setClients(clientsRes.data.clients || []);
      if (campaignsRes.data.success) setCampaigns(campaignsRes.data.campaigns || []);
      if (templatesRes.data.success) setTemplates(templatesRes.data.templates || []);
      
    } catch (error) {
      console.error('Error loading marketing data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, []);

  const toggleClientSelection = (id: string) => {
    const newSelection = new Set(selectedClients);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedClients(newSelection);
  };

  const selectAllClients = () => {
    if (selectedClients.size === clients.length) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(clients.map(c => c.id)));
    }
  };

  const selectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setEmailSubject(template.subject);
    setEmailContent(TEMPLATE_CONTENTS[template.id] || '');
    setShowTemplateModal(false);
    setActiveTab('compose');
  };

  const sendCampaign = async () => {
    if (!emailSubject || !emailContent) {
      Alert.alert('Error', 'Complete el asunto y contenido del email');
      return;
    }
    
    Alert.alert(
      'Confirmar Envío',
      `¿Enviar campaña a ${sendToAll ? clients.length : selectedClients.size} clientes?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Enviar', 
          onPress: async () => {
            setSending(true);
            try {
              const response = await api.post('/admin/marketing/send-campaign', {
                template_id: selectedTemplate?.id,
                subject: emailSubject,
                html_content: emailContent,
                client_ids: sendToAll ? [] : Array.from(selectedClients),
                send_to_all: sendToAll
              });
              
              if (response.data.success) {
                Alert.alert(
                  '✅ Campaña Enviada',
                  `Enviados: ${response.data.sent}\nFallidos: ${response.data.failed}`,
                  [{ text: 'OK', onPress: () => {
                    setActiveTab('campaigns');
                    loadData();
                  }}]
                );
              }
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Error al enviar campaña');
            } finally {
              setSending(false);
            }
          }
        }
      ]
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const renderClientItem = ({ item }: { item: MarketingClient }) => (
    <TouchableOpacity 
      style={[styles.clientCard, selectedClients.has(item.id) && styles.clientCardSelected]}
      onPress={() => toggleClientSelection(item.id)}
    >
      <View style={styles.clientCheckbox}>
        <Ionicons 
          name={selectedClients.has(item.id) ? "checkbox" : "square-outline"} 
          size={24} 
          color={selectedClients.has(item.id) ? "#10B981" : "#ccc"} 
        />
      </View>
      <View style={styles.clientInfo}>
        <Text style={styles.clientName}>{item.name || 'Sin nombre'}</Text>
        <Text style={styles.clientEmail}>{item.email}</Text>
        <View style={styles.clientMeta}>
          <Text style={styles.clientMetaText}>Año: {item.last_tax_year || '-'}</Text>
          <Text style={styles.clientMetaText}>Emails: {item.campaigns_sent}</Text>
        </View>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: item.status === 'active' ? '#D1FAE5' : '#FEE2E2' }]}>
        <Text style={[styles.statusText, { color: item.status === 'active' ? '#059669' : '#DC2626' }]}>
          {item.status === 'active' ? 'Activo' : 'Inactivo'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderCampaignItem = ({ item }: { item: Campaign }) => (
    <View style={styles.campaignCard}>
      <View style={styles.campaignHeader}>
        <Text style={styles.campaignSubject} numberOfLines={1}>{item.subject}</Text>
        <View style={[styles.campaignStatus, { backgroundColor: item.status === 'completed' ? '#D1FAE5' : '#FEF3C7' }]}>
          <Text style={[styles.campaignStatusText, { color: item.status === 'completed' ? '#059669' : '#D97706' }]}>
            {item.status === 'completed' ? 'Completada' : item.status}
          </Text>
        </View>
      </View>
      <View style={styles.campaignStats}>
        <View style={styles.statItem}>
          <Ionicons name="people" size={16} color="#6B7280" />
          <Text style={styles.statText}>{item.total_recipients} destinatarios</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          <Text style={styles.statText}>{item.sent} enviados</Text>
        </View>
        {item.failed > 0 && (
          <View style={styles.statItem}>
            <Ionicons name="close-circle" size={16} color="#EF4444" />
            <Text style={styles.statText}>{item.failed} fallidos</Text>
          </View>
        )}
      </View>
      <Text style={styles.campaignDate}>{formatDate(item.created_at)}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C1110" />
        <Text style={styles.loadingText}>Cargando marketing...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Marketing</Text>
          <Text style={styles.headerSubtitle}>{clients.length} clientes activos</Text>
        </View>
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'clients' && styles.tabActive]}
          onPress={() => setActiveTab('clients')}
        >
          <Ionicons name="people" size={18} color={activeTab === 'clients' ? '#6C1110' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'clients' && styles.tabTextActive]}>Clientes</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'campaigns' && styles.tabActive]}
          onPress={() => setActiveTab('campaigns')}
        >
          <Ionicons name="mail" size={18} color={activeTab === 'campaigns' ? '#6C1110' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'campaigns' && styles.tabTextActive]}>Campañas</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'compose' && styles.tabActive]}
          onPress={() => setActiveTab('compose')}
        >
          <Ionicons name="create" size={18} color={activeTab === 'compose' ? '#6C1110' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'compose' && styles.tabTextActive]}>Crear</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'clients' && (
        <View style={styles.content}>
          <View style={styles.clientsHeader}>
            <TouchableOpacity style={styles.selectAllBtn} onPress={selectAllClients}>
              <Ionicons 
                name={selectedClients.size === clients.length ? "checkbox" : "square-outline"} 
                size={20} 
                color="#6C1110" 
              />
              <Text style={styles.selectAllText}>
                {selectedClients.size === clients.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.selectedCount}>{selectedClients.size} seleccionados</Text>
          </View>
          
          <FlatList
            data={clients}
            renderItem={renderClientItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C1110" />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No hay clientes en la lista de marketing</Text>
              </View>
            }
          />
        </View>
      )}

      {activeTab === 'campaigns' && (
        <FlatList
          data={campaigns}
          renderItem={renderCampaignItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C1110" />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="mail-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No hay campañas enviadas</Text>
            </View>
          }
        />
      )}

      {activeTab === 'compose' && (
        <ScrollView style={styles.composeContainer}>
          <TouchableOpacity 
            style={styles.templateSelector}
            onPress={() => setShowTemplateModal(true)}
          >
            <Ionicons name="document-text" size={24} color="#6C1110" />
            <View style={styles.templateSelectorText}>
              <Text style={styles.templateLabel}>Plantilla</Text>
              <Text style={styles.templateValue}>
                {selectedTemplate?.name || 'Seleccionar plantilla...'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Asunto del Email</Text>
            <TextInput
              style={styles.input}
              value={emailSubject}
              onChangeText={setEmailSubject}
              placeholder="Ej: Tips Fiscales del Mes"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Contenido (HTML)</Text>
            <TextInput
              style={[styles.input, styles.contentInput]}
              value={emailContent}
              onChangeText={setEmailContent}
              placeholder="<html>...</html>"
              placeholderTextColor="#999"
              multiline
              numberOfLines={10}
            />
          </View>

          <View style={styles.recipientSection}>
            <Text style={styles.inputLabel}>Destinatarios</Text>
            <TouchableOpacity 
              style={styles.recipientOption}
              onPress={() => setSendToAll(true)}
            >
              <Ionicons 
                name={sendToAll ? "radio-button-on" : "radio-button-off"} 
                size={22} 
                color={sendToAll ? "#10B981" : "#999"} 
              />
              <Text style={styles.recipientText}>Todos los clientes activos ({clients.length})</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.recipientOption}
              onPress={() => {
                setSendToAll(false);
                setActiveTab('clients');
              }}
            >
              <Ionicons 
                name={!sendToAll ? "radio-button-on" : "radio-button-off"} 
                size={22} 
                color={!sendToAll ? "#10B981" : "#999"} 
              />
              <Text style={styles.recipientText}>
                Clientes seleccionados ({selectedClients.size})
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.sendButton, sending && styles.sendButtonDisabled]}
            onPress={sendCampaign}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="#fff" />
                <Text style={styles.sendButtonText}>Enviar Campaña</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Template Modal */}
      <Modal
        visible={showTemplateModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTemplateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Plantilla</Text>
              <TouchableOpacity onPress={() => setShowTemplateModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {templates.map((template) => (
                <TouchableOpacity
                  key={template.id}
                  style={styles.templateOption}
                  onPress={() => selectTemplate(template)}
                >
                  <View style={styles.templateIcon}>
                    <Ionicons 
                      name={
                        template.category === 'tips' ? 'bulb' :
                        template.category === 'news' ? 'newspaper' :
                        template.category === 'promotions' ? 'gift' :
                        template.category === 'reminders' ? 'alarm' : 'mail'
                      } 
                      size={24} 
                      color="#6C1110" 
                    />
                  </View>
                  <View style={styles.templateInfo}>
                    <Text style={styles.templateName}>{template.name}</Text>
                    <Text style={styles.templateDesc}>{template.description}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#ccc" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#6C1110',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  tabTextActive: {
    color: '#6C1110',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  clientsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectAllText: {
    fontSize: 14,
    color: '#6C1110',
  },
  selectedCount: {
    fontSize: 13,
    color: '#666',
  },
  listContent: {
    padding: 16,
  },
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  clientCardSelected: {
    borderWidth: 2,
    borderColor: '#10B981',
  },
  clientCheckbox: {
    marginRight: 12,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  clientEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  clientMeta: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 6,
  },
  clientMetaText: {
    fontSize: 12,
    color: '#999',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  campaignCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  campaignHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  campaignSubject: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 12,
  },
  campaignStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  campaignStatusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  campaignStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 13,
    color: '#666',
  },
  campaignDate: {
    fontSize: 12,
    color: '#999',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#999',
  },
  composeContainer: {
    flex: 1,
    padding: 16,
  },
  templateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  templateSelectorText: {
    flex: 1,
  },
  templateLabel: {
    fontSize: 12,
    color: '#666',
  },
  templateValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#333',
  },
  contentInput: {
    height: 200,
    textAlignVertical: 'top',
  },
  recipientSection: {
    marginBottom: 20,
  },
  recipientOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
    gap: 12,
  },
  recipientText: {
    fontSize: 15,
    color: '#333',
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
    marginBottom: 40,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  templateOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 12,
  },
  templateIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  templateDesc: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
});
