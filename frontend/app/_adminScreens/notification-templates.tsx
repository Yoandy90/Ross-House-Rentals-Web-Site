import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import AdminHeader from '../../components/admin/AdminHeader';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';

interface NotificationTemplate {
  id: string;
  type: string;
  category: string;
  name: string;
  description: string;
  subject?: string;
  template_content: string;
  variables: string[];
  is_active: boolean;
}

export default function NotificationTemplatesScreen() {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Edit state
  const [editSubject, setEditSubject] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  
  // Test state
  const [showTestModal, setShowTestModal] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testPhone, setTestPhone] = useState('');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/notification-templates');
      setTemplates(response.data);
    } catch (error: any) {
      console.error('Error loading templates:', error);
      Alert.alert('Error', error.response?.data?.detail || 'No se pudieron cargar las plantillas');
    } finally {
      setLoading(false);
    }
  };

  const initializeTemplates = async () => {
    try {
      setLoading(true);
      const response = await api.post('/admin/notification-templates/initialize');
      Alert.alert('Éxito', response.data.message);
      loadTemplates();
    } catch (error: any) {
      console.error('Error initializing templates:', error);
      Alert.alert('Error', error.response?.data?.detail || 'No se pudieron inicializar las plantillas');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (template: NotificationTemplate) => {
    setSelectedTemplate(template);
    setEditSubject(template.subject || '');
    setEditContent(template.template_content);
    setEditIsActive(template.is_active);
    setShowEditModal(true);
  };

  const saveTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      setLoading(true);
      await api.put(`/admin/notification-templates/${selectedTemplate.id}`, {
        subject: editSubject,
        template_content: editContent,
        is_active: editIsActive,
      });
      
      Alert.alert('Éxito', 'Plantilla actualizada correctamente');
      setShowEditModal(false);
      loadTemplates();
    } catch (error: any) {
      console.error('Error saving template:', error);
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo guardar la plantilla');
    } finally {
      setLoading(false);
    }
  };

  const openTestModal = (template: NotificationTemplate) => {
    setSelectedTemplate(template);
    setTestEmail('');
    setTestPhone('');
    setShowTestModal(true);
  };

  const sendTestNotification = async () => {
    if (!selectedTemplate) return;
    
    if (!testEmail && !testPhone) {
      Alert.alert('Error', 'Ingresa un email o teléfono para enviar la prueba');
      return;
    }

    try {
      setLoading(true);
      
      // Create test variables
      const testVariables: any = {
        user_name: 'Usuario de Prueba',
        company_name: 'Ross Tax Preparation',
        company_phone: '(123) 456-7890',
        company_email: 'info@rosstaxpreparation.com',
        loan_amount: '5,000.00',
        loan_term: '12',
        monthly_payment: '450.00',
        application_id: 'TEST123',
        rejection_reason: 'Motivo de prueba',
      };

      const response = await api.post(`/admin/notification-templates/${selectedTemplate.id}/test`, {
        template_id: selectedTemplate.id,
        test_email: testEmail || undefined,
        test_phone: testPhone || undefined,
        test_variables: testVariables,
      });

      let message = 'Notificación de prueba enviada:\n';
      if (response.data.email_sent) message += '✅ Email enviado\n';
      if (response.data.sms_sent) message += '✅ SMS enviado\n';
      if (response.data.email_error) message += `❌ Error email: ${response.data.email_error}\n`;
      if (response.data.sms_error) message += `❌ Error SMS: ${response.data.sms_error}\n`;

      Alert.alert('Resultado', message);
      setShowTestModal(false);
    } catch (error: any) {
      console.error('Error sending test:', error);
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo enviar la prueba');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'loan': return '#10B981';
      case 'appointment': return '#3B82F6';
      case 'credit': return '#F59E0B';
      default: return colors.primary;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'loan': return 'cash';
      case 'appointment': return 'calendar';
      case 'credit': return 'wallet';
      default: return 'mail';
    }
  };

  return (
    <View style={styles.container}>
      <AdminHeader title="Plantillas de Notificaciones" />
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="mail" size={32} color={colors.primary} />
        <Text style={styles.headerTitle}>Plantillas de Notificaciones</Text>
      </View>

      {loading && templates.length === 0 ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : (
        <ScrollView style={styles.content}>
          {templates.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={64} color={colors.textGray} />
              <Text style={styles.emptyText}>No hay plantillas configuradas</Text>
              <TouchableOpacity style={styles.initButton} onPress={initializeTemplates}>
                <Ionicons name="add-circle" size={24} color="#FFF" />
                <Text style={styles.initButtonText}>Inicializar Plantillas por Defecto</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={24} color="#3B82F6" />
                <Text style={styles.infoText}>
                  Personaliza las plantillas de email y SMS. Usa variables como {'{user_name}'}, {'{loan_amount}'}, etc.
                </Text>
              </View>

              {templates.map((template) => (
                <View key={template.id} style={styles.templateCard}>
                  <View style={styles.templateHeader}>
                    <View style={styles.templateInfo}>
                      <View style={styles.templateTitleRow}>
                        <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(template.category) + '20' }]}>
                          <Ionicons 
                            name={getCategoryIcon(template.category)} 
                            size={16} 
                            color={getCategoryColor(template.category)} 
                          />
                        </View>
                        <Text style={styles.templateName}>{template.name}</Text>
                        {!template.is_active && (
                          <View style={styles.inactiveBadge}>
                            <Text style={styles.inactiveText}>Inactivo</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.templateDescription}>{template.description}</Text>
                      <View style={styles.templateMeta}>
                        <View style={styles.metaItem}>
                          <Ionicons name={template.type === 'email' ? 'mail' : 'chatbubble'} size={14} color={colors.textGray} />
                          <Text style={styles.metaText}>{template.type === 'email' ? 'Email' : 'SMS'}</Text>
                        </View>
                        <View style={styles.metaItem}>
                          <Ionicons name="code" size={14} color={colors.textGray} />
                          <Text style={styles.metaText}>{template.variables.length} variables</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {template.subject && (
                    <View style={styles.subjectContainer}>
                      <Text style={styles.subjectLabel}>Asunto:</Text>
                      <Text style={styles.subjectText}>{template.subject}</Text>
                    </View>
                  )}

                  <View style={styles.variablesContainer}>
                    <Text style={styles.variablesLabel}>Variables disponibles:</Text>
                    <View style={styles.variablesList}>
                      {template.variables.map((variable) => (
                        <View key={variable} style={styles.variableTag}>
                          <Text style={styles.variableText}>{`{${variable}}`}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.editButton]}
                      onPress={() => openEditModal(template)}
                    >
                      <Ionicons name="create" size={20} color="#FFF" />
                      <Text style={styles.actionButtonText}>Editar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionButton, styles.testButton]}
                      onPress={() => openTestModal(template)}
                    >
                      <Ionicons name="send" size={20} color="#FFF" />
                      <Text style={styles.actionButtonText}>Probar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Plantilla</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color={colors.textDark} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {selectedTemplate?.type === 'email' && (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Asunto:</Text>
                  <TextInput
                    style={styles.formInput}
                    value={editSubject}
                    onChangeText={setEditSubject}
                    placeholder="Asunto del email"
                    placeholderTextColor={colors.textGray}
                  />
                </View>
              )}

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Contenido:</Text>
                <TextInput
                  style={[styles.formInput, styles.contentInput]}
                  value={editContent}
                  onChangeText={setEditContent}
                  placeholder={selectedTemplate?.type === 'email' ? 'Contenido HTML' : 'Contenido del SMS'}
                  placeholderTextColor={colors.textGray}
                  multiline
                  numberOfLines={20}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.formLabel}>Plantilla activa:</Text>
                <TouchableOpacity
                  style={[styles.switch, editIsActive && styles.switchActive]}
                  onPress={() => setEditIsActive(!editIsActive)}
                >
                  <View style={[styles.switchThumb, editIsActive && styles.switchThumbActive]} />
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={saveTemplate}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                    <Text style={styles.saveButtonText}>Guardar</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Test Modal */}
      <Modal
        visible={showTestModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTestModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Enviar Prueba</Text>
              <TouchableOpacity onPress={() => setShowTestModal(false)}>
                <Ionicons name="close" size={24} color={colors.textDark} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.testInfo}>
                Envía una notificación de prueba con datos ficticios para verificar el formato.
              </Text>

              {selectedTemplate?.type === 'email' && (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Email de prueba:</Text>
                  <TextInput
                    style={styles.formInput}
                    value={testEmail}
                    onChangeText={setTestEmail}
                    placeholder="correo@ejemplo.com"
                    placeholderTextColor={colors.textGray}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              )}

              {selectedTemplate?.type === 'sms' && (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Teléfono de prueba:</Text>
                  <TextInput
                    style={styles.formInput}
                    value={testPhone}
                    onChangeText={setTestPhone}
                    placeholder="+1234567890"
                    placeholderTextColor={colors.textGray}
                    keyboardType="phone-pad"
                  />
                </View>
              )}
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowTestModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={sendTestNotification}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="send" size={20} color="#FFF" />
                    <Text style={styles.saveButtonText}>Enviar</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textDark,
  },
  loader: {
    marginTop: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textGray,
    marginTop: 12,
    marginBottom: 24,
  },
  initButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  initButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
  },
  templateCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  templateHeader: {
    marginBottom: 16,
  },
  templateInfo: {
    flex: 1,
  },
  templateTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  categoryBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.textDark,
  },
  inactiveBadge: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  inactiveText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
  templateDescription: {
    fontSize: 14,
    color: colors.textGray,
    marginBottom: 8,
  },
  templateMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: colors.textGray,
  },
  subjectContainer: {
    backgroundColor: colors.backgroundGray,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  subjectLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textGray,
    marginBottom: 4,
  },
  subjectText: {
    fontSize: 14,
    color: colors.textDark,
  },
  variablesContainer: {
    marginBottom: 16,
  },
  variablesLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textGray,
    marginBottom: 8,
  },
  variablesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  variableTag: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  variableText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#6B7280',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
  },
  editButton: {
    backgroundColor: colors.primary,
  },
  testButton: {
    backgroundColor: '#10B981',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    width: '100%',
    maxWidth: 800,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textDark,
  },
  modalBody: {
    padding: 20,
    maxHeight: 500,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: colors.backgroundGray,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: colors.textDark,
    borderWidth: 1,
    borderColor: colors.border,
  },
  contentInput: {
    minHeight: 300,
    textAlignVertical: 'top',
    fontFamily: 'monospace',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  switch: {
    width: 50,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#D1D5DB',
    padding: 2,
    justifyContent: 'center',
  },
  switchActive: {
    backgroundColor: colors.primary,
  },
  switchThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  testInfo: {
    fontSize: 14,
    color: colors.textGray,
    marginBottom: 20,
    lineHeight: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: colors.backgroundGray,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textDark,
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});