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
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeColors } from '../../constants/colors';
import AdminHeader from '../../components/admin/AdminHeader';
import api from '../../services/api';

interface Client {
  id: string;
  name: string;
  email: string;
}

export default function CampaignCreateScreen() {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [loadingClients, setLoadingClients] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  
  // Form state
  const [campaignName, setCampaignName] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  
  // Modal
  const [showClientsModal, setShowClientsModal] = useState(false);
  const [clientSearch, setClientSearch] = useState('');

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const response = await api.get('/admin/clients?limit=1000');
      const clientsData = Array.isArray(response.data) 
        ? response.data 
        : (response.data?.clients || []);
      setClients(clientsData);
    } catch (error) {
      console.error('Error loading clients:', error);
      Alert.alert('Error', 'No se pudieron cargar los clientes');
    } finally {
      setLoadingClients(false);
    }
  };

  const filteredClients = clients.filter(client => 
    client.name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
    client.email?.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const toggleClientSelection = (clientId: string) => {
    setSelectedClients(prev => 
      prev.includes(clientId) 
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedClients([]);
    } else {
      setSelectedClients(clients.map(c => c.id));
    }
    setSelectAll(!selectAll);
  };

  const handleCreateCampaign = async () => {
    // Validations
    if (!campaignName.trim()) {
      Alert.alert('Error', 'Por favor ingresa un nombre para la campaña');
      return;
    }
    if (!subject.trim()) {
      Alert.alert('Error', 'Por favor ingresa el asunto del email');
      return;
    }
    if (!content.trim()) {
      Alert.alert('Error', 'Por favor ingresa el contenido del email');
      return;
    }
    if (selectedClients.length === 0) {
      Alert.alert('Error', 'Por favor selecciona al menos un destinatario');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: campaignName.trim(),
        subject: subject.trim(),
        content: content.trim(),
        recipients: selectedClients,
        status: 'draft',
      };

      await api.post('/admin/campaigns/create', payload);
      
      Alert.alert('✅ Éxito', 'Campaña creada correctamente', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      console.error('Error creating campaign:', error);
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo crear la campaña');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!campaignName.trim()) {
      Alert.alert('Error', 'Por favor ingresa un nombre para guardar el borrador');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: campaignName.trim(),
        subject: subject.trim(),
        content: content.trim(),
        recipients: selectedClients,
        status: 'draft',
      };

      await api.post('/admin/campaigns/create', payload);
      
      Alert.alert('✅ Guardado', 'Borrador guardado correctamente', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo guardar el borrador');
    } finally {
      setLoading(false);
    }
  };

  // Templates
  const templates = [
    {
      name: '📢 Recordatorio Tax Season',
      subject: '¡Es hora de preparar tus impuestos!',
      content: 'Estimado cliente,\n\nLa temporada de impuestos está aquí. No esperes hasta el último momento.\n\nContáctanos hoy para programar tu cita.\n\nSaludos,\nRoss Tax Preparation'
    },
    {
      name: '📄 Documentos Pendientes',
      subject: 'Documentos necesarios para tu declaración',
      content: 'Estimado cliente,\n\nPara completar tu declaración de impuestos, necesitamos los siguientes documentos:\n- W-2\n- 1099\n- Identificación vigente\n\nPor favor súbelos a través de la app.\n\nGracias,\nRoss Tax Preparation'
    },
    {
      name: '🎉 Promoción Especial',
      subject: '¡Oferta especial para clientes!',
      content: 'Estimado cliente,\n\n¡Tenemos una promoción especial para ti!\n\nRefiere a un amigo y ambos recibirán un descuento.\n\nNo dejes pasar esta oportunidad.\n\nSaludos,\nRoss Tax Preparation'
    },
  ];

  const applyTemplate = (template: typeof templates[0]) => {
    setSubject(template.subject);
    setContent(template.content);
  };

  if (loadingClients) {
    return (
      <View style={styles.container}>
        <AdminHeader title="Crear Campaña" showBack />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AdminHeader title="Crear Campaña" showBack />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Campaign Name */}
        <View style={styles.section}>
          <Text style={styles.label}>Nombre de la Campaña *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Recordatorio Tax Season 2024"
            value={campaignName}
            onChangeText={setCampaignName}
            placeholderTextColor={colors.textLight}
          />
        </View>

        {/* Recipients */}
        <View style={styles.section}>
          <Text style={styles.label}>Destinatarios *</Text>
          <TouchableOpacity 
            style={styles.selector}
            onPress={() => setShowClientsModal(true)}
          >
            <Ionicons name="people" size={20} color={colors.primary} />
            <Text style={[styles.selectorText, selectedClients.length === 0 && styles.placeholderText]}>
              {selectedClients.length === 0 
                ? 'Seleccionar destinatarios'
                : `${selectedClients.length} cliente${selectedClients.length !== 1 ? 's' : ''} seleccionado${selectedClients.length !== 1 ? 's' : ''}`
              }
            </Text>
            <Ionicons name="chevron-down" size={20} color={colors.textGray} />
          </TouchableOpacity>
        </View>

        {/* Templates */}
        <View style={styles.section}>
          <Text style={styles.label}>Plantillas Rápidas</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {templates.map((template, index) => (
              <TouchableOpacity
                key={index}
                style={styles.templateCard}
                onPress={() => applyTemplate(template)}
              >
                <Text style={styles.templateName}>{template.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Subject */}
        <View style={styles.section}>
          <Text style={styles.label}>Asunto del Email *</Text>
          <TextInput
            style={styles.input}
            placeholder="Asunto del correo"
            value={subject}
            onChangeText={setSubject}
            placeholderTextColor={colors.textLight}
          />
        </View>

        {/* Content */}
        <View style={styles.section}>
          <Text style={styles.label}>Contenido del Email *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Escribe el contenido del email..."
            value={content}
            onChangeText={setContent}
            multiline
            numberOfLines={8}
            textAlignVertical="top"
            placeholderTextColor={colors.textLight}
          />
        </View>

        {/* Preview */}
        {(subject || content) && (
          <View style={styles.section}>
            <Text style={styles.label}>Vista Previa</Text>
            <View style={styles.previewCard}>
              <Text style={styles.previewSubject}>{subject || '(Sin asunto)'}</Text>
              <View style={styles.previewDivider} />
              <Text style={styles.previewContent}>{content || '(Sin contenido)'}</Text>
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.draftButton}
            onPress={handleSaveDraft}
            disabled={loading}
          >
            <Ionicons name="save-outline" size={20} color={colors.primary} />
            <Text style={styles.draftButtonText}>Guardar Borrador</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.createButton, loading && styles.buttonDisabled]}
            onPress={handleCreateCampaign}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="#FFF" />
                <Text style={styles.createButtonText}>Crear Campaña</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Clients Selection Modal */}
      <Modal
        visible={showClientsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowClientsModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Seleccionar Destinatarios</Text>
            <TouchableOpacity onPress={() => setShowClientsModal(false)}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.textGray} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar cliente..."
              value={clientSearch}
              onChangeText={setClientSearch}
              placeholderTextColor={colors.textLight}
            />
          </View>
          
          <TouchableOpacity style={styles.selectAllButton} onPress={handleSelectAll}>
            <Ionicons 
              name={selectAll ? "checkbox" : "square-outline"} 
              size={24} 
              color={colors.primary} 
            />
            <Text style={styles.selectAllText}>
              {selectAll ? 'Deseleccionar todos' : `Seleccionar todos (${clients.length})`}
            </Text>
          </TouchableOpacity>

          <FlatList
            data={filteredClients}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.clientItem}
                onPress={() => toggleClientSelection(item.id)}
              >
                <Ionicons 
                  name={selectedClients.includes(item.id) ? "checkbox" : "square-outline"} 
                  size={24} 
                  color={selectedClients.includes(item.id) ? colors.primary : colors.textGray} 
                />
                <View style={styles.clientInfo}>
                  <Text style={styles.clientName}>{item.name}</Text>
                  <Text style={styles.clientEmail}>{item.email}</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyList}>
                <Text style={styles.emptyText}>No se encontraron clientes</Text>
              </View>
            }
          />
          
          <TouchableOpacity 
            style={styles.confirmButton}
            onPress={() => setShowClientsModal(false)}
          >
            <Text style={styles.confirmButtonText}>
              Confirmar ({selectedClients.length} seleccionados)
            </Text>
          </TouchableOpacity>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textGray,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    height: 160,
    textAlignVertical: 'top',
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  selectorText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  placeholderText: {
    color: colors.textLight,
  },
  templateCard: {
    backgroundColor: colors.primary + '15',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
  },
  templateName: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  previewCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewSubject: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  previewDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  previewContent: {
    fontSize: 14,
    color: colors.textGray,
    lineHeight: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  draftButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '15',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  draftButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  createButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundGray,
    margin: 16,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 8,
    fontSize: 15,
    color: colors.text,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  selectAllText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  clientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  clientEmail: {
    fontSize: 13,
    color: colors.textGray,
  },
  emptyList: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textGray,
  },
  confirmButton: {
    backgroundColor: colors.primary,
    margin: 16,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});
