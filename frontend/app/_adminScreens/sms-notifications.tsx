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
  RefreshControl,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import AdminHeader from '../../components/admin/AdminHeader';
import { useTranslation } from 'react-i18next';

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
}

interface SMSLog {
  id: string;
  user_name: string;
  user_email: string;
  phone: string;
  message: string;
  status: 'sent' | 'failed' | 'pending';
  sent_at: string;
  type: string;
}

interface SMSTemplate {
  id: string;
  name: string;
  message: string;
  icon: string;
}

const SMS_TEMPLATES: SMSTemplate[] = [
  {
    id: 'appointment_reminder',
    name: 'Recordatorio de Cita',
    message: 'Hola {name}, te recordamos tu cita en Ross Tax Preparation mañana a las {time}. ¡Te esperamos!',
    icon: 'calendar',
  },
  {
    id: 'document_request',
    name: 'Solicitud de Documentos',
    message: 'Hola {name}, necesitamos que nos envíes {documents} para continuar con tu declaración de impuestos.',
    icon: 'document-text',
  },
  {
    id: 'tax_ready',
    name: 'Declaración Lista',
    message: 'Buenas noticias {name}! Tu declaración de impuestos está lista. Por favor contacta con nuestra oficina.',
    icon: 'checkmark-circle',
  },
  {
    id: 'payment_reminder',
    name: 'Recordatorio de Pago',
    message: 'Hola {name}, tienes un pago pendiente de ${amount}. Por favor realiza el pago lo antes posible.',
    icon: 'cash',
  },
];

export default function SMSNotificationsAdmin() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<SMSLog[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [searchUser, setSearchUser] = useState('');
  const [sendToAll, setSendToAll] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'send' | 'history' | 'templates'>('send');
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [usersResponse, logsResponse] = await Promise.all([
        api.get('/admin/sms/users'),
        api.get('/admin/sms/logs', { params: { limit: 50 } }),
      ]);
      
      setUsers(usersResponse.data.users || []);
      setLogs(logsResponse.data.logs || []);
    } catch (error: any) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'No se pudieron cargar los datos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const toggleUserSelection = (userId: string) => {
    const newSelection = new Set(selectedUsers);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      newSelection.add(userId);
    }
    setSelectedUsers(newSelection);
  };

  const selectAll = () => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(users.map(u => u.id)));
    }
  };

  const applyTemplate = (template: SMSTemplate) => {
    setMessage(template.message);
    setShowTemplates(false);
  };

  const handleSendSMS = async () => {
    console.log('🚀 handleSendSMS called');
    console.log('Message:', message);
    console.log('Send to all:', sendToAll);
    console.log('Selected users:', selectedUsers.size);
    
    if (!message.trim()) {
      Alert.alert('Error', 'Por favor ingresa un mensaje');
      return;
    }

    if (!sendToAll && selectedUsers.size === 0) {
      Alert.alert('Error', 'Selecciona al menos un usuario o activa "Enviar a Todos"');
      return;
    }

    const recipientsCount = sendToAll 
      ? users.filter(u => !roleFilter || u.role === roleFilter).length
      : selectedUsers.size;

    const segmentsCount = Math.ceil(message.length / 160);
    const warningMessage = segmentsCount > 1 
      ? `\n\n⚠️ El mensaje será enviado en ${segmentsCount} SMS (${message.length} caracteres)`
      : '';

    Alert.alert(
      'Confirmar Envío',
      `¿Enviar SMS a ${recipientsCount} usuario(s)?${warningMessage}\n\nMensaje: "${message}"`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          onPress: async () => {
            console.log('📤 Intentando enviar SMS...');
            setSending(true);
            try {
              // Construir URL con query params
              let url = `/admin/sms/send?message=${encodeURIComponent(message.trim())}&send_to_all=${sendToAll}`;
              
              if (roleFilter) {
                url += `&role_filter=${roleFilter}`;
              }
              
              if (!sendToAll && selectedUsers.size > 0) {
                const userIdsArray = Array.from(selectedUsers);
                console.log('👥 Usuarios seleccionados:', userIdsArray);
                userIdsArray.forEach(userId => {
                  url += `&user_ids=${userId}`;
                });
              }
              
              console.log('🌐 URL construida:', url);
              console.log('🚀 Haciendo POST...');
              
              const response = await api.post(url);
              
              console.log('✅ Respuesta recibida:', response.data);

              Alert.alert(
                '✅ Enviado',
                response.data.message || `SMS enviado a ${recipientsCount} usuario(s)`
              );

              // Reset form
              setMessage('');
              setSelectedUsers(new Set());
              setSendToAll(false);
              setRoleFilter(null);
              
              // Reload data
              loadData();
            } catch (error: any) {
              console.error('Error sending SMS:', error);
              Alert.alert(
                'Error',
                error.response?.data?.detail || 'No se pudo enviar el SMS'
              );
            } finally {
              setSending(false);
            }
          }
        }
      ]
    );
  };

  const filteredUsers = users.filter(user => {
    if (!searchUser.trim()) return true;
    const query = searchUser.toLowerCase();
    return (
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.phone.toLowerCase().includes(query)
    );
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return '#4CAF50';
      case 'failed': return '#F44336';
      case 'pending': return '#FF9800';
      default: return '#999';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'sent': return 'Enviado';
      case 'failed': return 'Fallido';
      case 'pending': return 'Pendiente';
      default: return status;
    }
  };

  const renderUserItem = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.userRow}
      onPress={() => toggleUserSelection(item.id)}
      activeOpacity={0.7}
    >
      <View style={[
        styles.checkbox,
        selectedUsers.has(item.id) && styles.checkboxChecked
      ]}>
        {selectedUsers.has(item.id) && (
          <Ionicons name="checkmark" size={18} color="#FFF" />
        )}
      </View>

      <View style={styles.userInfo}>
        <Text style={styles.userName} numberOfLines={1}>{item.name}</Text>
        <View style={styles.userContact}>
          <Ionicons name="mail-outline" size={12} color={colors.textGray} />
          <Text style={styles.userEmail} numberOfLines={1}>{item.email}</Text>
        </View>
        <View style={styles.userContact}>
          <Ionicons name="call-outline" size={12} color={colors.textGray} />
          <Text style={styles.userPhone} numberOfLines={1}>{item.phone}</Text>
        </View>
      </View>

      <View style={[
        styles.roleBadge,
        { backgroundColor: item.role === 'admin' ? colors.primary + '20' : '#2196F3' + '20' }
      ]}>
        <Text style={[
          styles.roleBadgeText,
          { color: item.role === 'admin' ? colors.primary : '#2196F3' }
        ]}>
          {item.role === 'admin' ? 'Admin' : 'Cliente'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderLogItem = ({ item }: { item: SMSLog }) => (
    <View style={styles.logCard}>
      <View style={styles.logHeader}>
        <View style={styles.logLeft}>
          <Text style={styles.logName}>{item.user_name}</Text>
          <Text style={styles.logPhone}>{item.phone}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {getStatusLabel(item.status)}
          </Text>
        </View>
      </View>
      
      <View style={styles.logMessage}>
        <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.textGray} />
        <Text style={styles.logMessageText} numberOfLines={2}>{item.message}</Text>
      </View>
      
      <View style={styles.logFooter}>
        <Ionicons name="time-outline" size={12} color={colors.textGray} />
        <Text style={styles.logDate}>
          {format(new Date(item.sent_at), 'dd MMM yyyy, HH:mm', { locale: es })}
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando datos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const clientUsers = users.filter(u => u.role === 'client');
  const adminUsers = users.filter(u => u.role === 'admin');
  const sentSMS = logs.filter(l => l.status === 'sent').length;
  const segmentsCount = Math.ceil(message.length / 160);

  return (
    <View style={{flex: 1, backgroundColor: colors.background}}>
      <AdminHeader title="Notificaciones SMS" />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        
      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'send' && styles.tabActive]}
          onPress={() => setActiveTab('send')}
        >
          <Ionicons 
            name="send" 
            size={20} 
            color={activeTab === 'send' ? colors.primary : colors.textGray} 
          />
          <Text style={[styles.tabText, activeTab === 'send' && styles.tabTextActive]}>
            Enviar
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'templates' && styles.tabActive]}
          onPress={() => setActiveTab('templates')}
        >
          <Ionicons 
            name="document-text" 
            size={20} 
            color={activeTab === 'templates' ? colors.primary : colors.textGray} 
          />
          <Text style={[styles.tabText, activeTab === 'templates' && styles.tabTextActive]}>
            Plantillas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
        >
          <Ionicons 
            name="time" 
            size={20} 
            color={activeTab === 'history' ? colors.primary : colors.textGray} 
          />
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
            Historial
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === 'send' ? (
          <>
            {/* Message Form */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>✍️ Escribir Mensaje</Text>

              <View style={styles.formGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Mensaje *</Text>
                  <TouchableOpacity
                    style={styles.templatesButton}
                    onPress={() => setShowTemplates(!showTemplates)}
                  >
                    <Ionicons name="document-text-outline" size={16} color={colors.primary} />
                    <Text style={styles.templatesButtonText}>Usar Plantilla</Text>
                  </TouchableOpacity>
                </View>
                
                {showTemplates && (
                  <View style={styles.templatesContainer}>
                    {SMS_TEMPLATES.map((template) => (
                      <TouchableOpacity
                        key={template.id}
                        style={styles.templateChip}
                        onPress={() => applyTemplate(template)}
                      >
                        <Ionicons name={template.icon as any} size={16} color={colors.primary} />
                        <Text style={styles.templateChipText}>{template.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={message}
                  onChangeText={setMessage}
                  placeholder={t('admin.smsPlaceholder', 'Escribe tu mensaje SMS aquí...')}
                  placeholderTextColor={colors.textGray}
                  multiline
                  numberOfLines={4}
                  maxLength={480}
                />
                <View style={styles.charInfo}>
                  <Text style={[
                    styles.charCount,
                    message.length > 160 && styles.charCountWarning
                  ]}>
                    {message.length} caracteres
                  </Text>
                  {message.length > 0 && (
                    <Text style={[
                      styles.segmentCount,
                      segmentsCount > 1 && styles.segmentCountWarning
                    ]}>
                      {segmentsCount} SMS
                    </Text>
                  )}
                </View>
                
                {message.length > 160 && (
                  <View style={styles.warningBox}>
                    <Ionicons name="warning" size={16} color="#FF9800" />
                    <Text style={styles.warningText}>
                      Tu mensaje será enviado en {segmentsCount} SMS separados
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Destinatarios */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📮 Destinatarios</Text>

              <TouchableOpacity
                style={styles.optionRow}
                onPress={() => {
                  setSendToAll(!sendToAll);
                  if (!sendToAll) {
                    setSelectedUsers(new Set());
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, sendToAll && styles.checkboxChecked]}>
                  {sendToAll && <Ionicons name="checkmark" size={18} color="#FFF" />}
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionText}>Enviar a todos los usuarios</Text>
                  <Text style={styles.optionSubtext}>
                    {users.length} usuarios recibirán el SMS
                  </Text>
                </View>
              </TouchableOpacity>

              {sendToAll && (
                <View style={styles.roleFilterContainer}>
                  <Text style={styles.filterLabel}>Filtrar por rol (opcional):</Text>
                  <View style={styles.roleButtons}>
                    <TouchableOpacity
                      style={[
                        styles.roleButton,
                        !roleFilter && styles.roleButtonActive
                      ]}
                      onPress={() => setRoleFilter(null)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.roleButtonText,
                        !roleFilter && styles.roleButtonTextActive
                      ]}>
                        Todos ({users.length})
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.roleButton,
                        roleFilter === 'client' && styles.roleButtonActive
                      ]}
                      onPress={() => setRoleFilter('client')}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.roleButtonText,
                        roleFilter === 'client' && styles.roleButtonTextActive
                      ]}>
                        Clientes ({clientUsers.length})
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.roleButton,
                        roleFilter === 'admin' && styles.roleButtonActive
                      ]}
                      onPress={() => setRoleFilter('admin')}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.roleButtonText,
                        roleFilter === 'admin' && styles.roleButtonTextActive
                      ]}>
                        Admins ({adminUsers.length})
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* User Selection */}
            {!sendToAll && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>👥 Seleccionar Usuarios</Text>
                  <TouchableOpacity onPress={selectAll} style={styles.selectAllButton}>
                    <Text style={styles.selectAllText}>
                      {selectedUsers.size === users.length ? 'Deseleccionar' : 'Todos'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Search */}
                <View style={styles.searchContainer}>
                  <Ionicons name="search" size={18} color={colors.textGray} />
                  <TextInput
                    style={styles.searchInput}
                    value={searchUser}
                    onChangeText={setSearchUser}
                    placeholder="Buscar usuario..."
                    placeholderTextColor={colors.textGray}
                  />
                  {searchUser.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchUser('')}>
                      <Ionicons name="close-circle" size={18} color={colors.textGray} />
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={styles.selectionInfo}>
                  {selectedUsers.size} de {users.length} seleccionados
                </Text>

                <FlatList
                  data={filteredUsers}
                  renderItem={renderUserItem}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  ItemSeparatorComponent={() => <View style={styles.separator} />}
                  ListEmptyComponent={
                    <View style={styles.emptySearch}>
                      <Ionicons name="search-outline" size={48} color={colors.textGray} />
                      <Text style={styles.emptySearchText}>No se encontraron usuarios</Text>
                    </View>
                  }
                />
              </View>
            )}

            {/* Info Box */}
            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={20} color="#2196F3" />
              <Text style={styles.infoText}>
                • SMS estándar: hasta 160 caracteres{'\n'}
                • Mensajes más largos se envían en múltiples SMS{'\n'}
                • Se requiere número de teléfono válido
              </Text>
            </View>

            {/* Send Button */}
            <TouchableOpacity
              style={[styles.sendButton, sending && styles.sendButtonDisabled]}
              onPress={handleSendSMS}
              disabled={sending}
              activeOpacity={0.8}
            >
              {sending ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Ionicons name="send" size={20} color="#FFF" />
                  <Text style={styles.sendButtonText}>
                    Enviar SMS
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : activeTab === 'templates' ? (
          // Templates Tab
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📝 Plantillas de SMS</Text>
            
            {SMS_TEMPLATES.map((template) => (
              <TouchableOpacity
                key={template.id}
                style={styles.templateCard}
                onPress={() => {
                  applyTemplate(template);
                  setActiveTab('send');
                }}
              >
                <View style={styles.templateIcon}>
                  <Ionicons name={template.icon as any} size={24} color={colors.primary} />
                </View>
                <View style={styles.templateContent}>
                  <Text style={styles.templateName}>{template.name}</Text>
                  <Text style={styles.templateMessage} numberOfLines={2}>
                    {template.message}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textGray} />
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          // History Tab
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📜 Historial de SMS</Text>
            
            {logs.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="time-outline" size={64} color={colors.textGray} />
                <Text style={styles.emptyText}>No hay historial aún</Text>
                <Text style={styles.emptySubtext}>
                  El historial de SMS enviados aparecerá aquí
                </Text>
              </View>
            ) : (
              <FlatList
                data={logs}
                renderItem={renderLogItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
              />
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textGray,
  },
  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerContent: {
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
  },
  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textGray,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  // Content
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#FFF',
    padding: 16,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  // Form
  formGroup: {
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  templatesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  templatesButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  templatesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  templateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.primary + '15',
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  templateChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 14,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  charInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  charCount: {
    fontSize: 12,
    color: colors.textGray,
  },
  charCountWarning: {
    color: '#FF9800',
    fontWeight: '600',
  },
  segmentCount: {
    fontSize: 12,
    color: colors.textGray,
  },
  segmentCountWarning: {
    color: '#FF9800',
    fontWeight: '600',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF3E0',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: '#F57C00',
  },
  // Options
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  optionSubtext: {
    fontSize: 13,
    color: colors.textGray,
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  // Role Filter
  roleFilterContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textGray,
    marginBottom: 8,
  },
  roleButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  roleButtonActive: {
    backgroundColor: colors.primary + '15',
    borderColor: colors.primary,
  },
  roleButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textGray,
  },
  roleButtonTextActive: {
    color: colors.primary,
  },
  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  // Users
  selectAllButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: colors.primary + '15',
  },
  selectAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  selectionInfo: {
    fontSize: 13,
    color: colors.textGray,
    marginBottom: 12,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  userContact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  userEmail: {
    fontSize: 12,
    color: colors.textGray,
  },
  userPhone: {
    fontSize: 12,
    color: colors.textGray,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  separator: {
    height: 1,
    backgroundColor: '#F0F0F0',
  },
  // Templates
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    marginBottom: 12,
  },
  templateIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  templateContent: {
    flex: 1,
  },
  templateName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  templateMessage: {
    fontSize: 13,
    color: colors.textGray,
    lineHeight: 18,
  },
  // Logs
  logCard: {
    backgroundColor: '#F9F9F9',
    padding: 14,
    borderRadius: 12,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  logLeft: {
    flex: 1,
  },
  logName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  logPhone: {
    fontSize: 12,
    color: colors.textGray,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  logMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 8,
  },
  logMessageText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  logFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  logDate: {
    fontSize: 11,
    color: colors.textGray,
  },
  // Info Box
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#1976D2',
    lineHeight: 18,
  },
  // Send Button
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    marginHorizontal: 16,
    marginBottom: 20,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textGray,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  emptySearch: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptySearchText: {
    fontSize: 14,
    color: colors.textGray,
    marginTop: 12,
  },
});
