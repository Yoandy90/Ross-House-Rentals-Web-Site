import { useTranslation } from 'react-i18next';
/**
 * AI Prompts Management Screen
 * Allows admin to view, edit, add and delete AI prompts
 */
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
  Modal,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';
import AdminHeader from '../../components/admin/AdminHeader';

const colors = {
  primary: '#6C1110',
  secondary: '#8B1A19',
  background: '#F5F5F5',
  surface: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#666666',
  border: '#E0E0E0',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
};

interface Prompt {
  id: string;
  name: string;
  key: string;
  description?: string;
  content: string;
  is_active: boolean;
  category: string;
  created_at: string;
  updated_at: string;
}

const categoryColors: { [key: string]: string } = {
  chat: colors.info,
  commands: colors.warning,
  fallback: colors.success,
  general: colors.textSecondary,
};

const categoryLabels: { [key: string]: string } = {
  chat: 'Chat',
  commands: 'Comandos',
  fallback: 'Fallback',
  general: 'General',
};

const AIPromptsScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [isNewPrompt, setIsNewPrompt] = useState(false);
  
  // Editor state
  const [editName, setEditName] = useState('');
  const [editKey, setEditKey] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('general');
  const [editIsActive, setEditIsActive] = useState(true);

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/prompts');
      setPrompts(response.data);
    } catch (error: any) {
      console.error('Error loading prompts:', error);
      Alert.alert('Error', 'No se pudieron cargar los prompts');
    } finally {
      setLoading(false);
    }
  };

  const openEditor = (prompt?: Prompt) => {
    if (prompt) {
      setSelectedPrompt(prompt);
      setEditName(prompt.name);
      setEditKey(prompt.key);
      setEditDescription(prompt.description || '');
      setEditContent(prompt.content);
      setEditCategory(prompt.category);
      setEditIsActive(prompt.is_active);
      setIsNewPrompt(false);
    } else {
      setSelectedPrompt(null);
      setEditName('');
      setEditKey('');
      setEditDescription('');
      setEditContent('');
      setEditCategory('general');
      setEditIsActive(true);
      setIsNewPrompt(true);
    }
    setShowEditor(true);
  };

  const closeEditor = () => {
    setShowEditor(false);
    setSelectedPrompt(null);
  };

  const savePrompt = async () => {
    if (!editName.trim() || !editContent.trim()) {
      Alert.alert('Error', 'El nombre y contenido son requeridos');
      return;
    }

    if (isNewPrompt && !editKey.trim()) {
      Alert.alert('Error', 'La clave única es requerida para nuevos prompts');
      return;
    }

    try {
      setSaving(true);
      
      if (isNewPrompt) {
        await api.post('/admin/prompts', {
          name: editName.trim(),
          key: editKey.trim().toLowerCase().replace(/\s+/g, '_'),
          description: editDescription.trim(),
          content: editContent,
          category: editCategory,
          is_active: editIsActive,
        });
        Alert.alert('Éxito', 'Prompt creado correctamente');
      } else if (selectedPrompt) {
        await api.put(`/admin/prompts/${selectedPrompt.id}`, {
          name: editName.trim(),
          description: editDescription.trim(),
          content: editContent,
          category: editCategory,
          is_active: editIsActive,
        });
        Alert.alert('Éxito', 'Prompt actualizado correctamente');
      }
      
      closeEditor();
      loadPrompts();
    } catch (error: any) {
      console.error('Error saving prompt:', error);
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo guardar el prompt');
    } finally {
      setSaving(false);
    }
  };

  const deletePrompt = async (prompt: Prompt) => {
    Alert.alert(
      'Eliminar Prompt',
      `¿Estás seguro de que deseas eliminar "${prompt.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/admin/prompts/${prompt.id}`);
              Alert.alert('Éxito', 'Prompt eliminado');
              loadPrompts();
            } catch (error) {
              Alert.alert('Error', 'No se pudo eliminar el prompt');
            }
          },
        },
      ]
    );
  };

  const togglePrompt = async (prompt: Prompt) => {
    try {
      await api.post(`/admin/prompts/${prompt.id}/toggle`);
      loadPrompts();
    } catch (error) {
      Alert.alert('Error', 'No se pudo cambiar el estado del prompt');
    }
  };

  const renderPromptCard = (prompt: Prompt) => (
    <TouchableOpacity
      key={prompt.id}
      style={styles.promptCard}
      onPress={() => openEditor(prompt)}
      activeOpacity={0.7}
    >
      <View style={styles.promptHeader}>
        <View style={styles.promptTitleRow}>
          <View style={[styles.categoryBadge, { backgroundColor: categoryColors[prompt.category] || colors.textSecondary }]}>
            <Text style={styles.categoryText}>{categoryLabels[prompt.category] || prompt.category}</Text>
          </View>
          <TouchableOpacity
            style={[styles.statusToggle, prompt.is_active ? styles.statusActive : styles.statusInactive]}
            onPress={() => togglePrompt(prompt)}
          >
            <Ionicons 
              name={prompt.is_active ? 'checkmark-circle' : 'close-circle'} 
              size={20} 
              color={prompt.is_active ? colors.success : colors.error} 
            />
          </TouchableOpacity>
        </View>
        <Text style={styles.promptName}>{prompt.name}</Text>
        {prompt.description && (
          <Text style={styles.promptDescription} numberOfLines={2}>{prompt.description}</Text>
        )}
      </View>
      
      <View style={styles.promptPreview}>
        <Text style={styles.promptContent} numberOfLines={3}>
          {prompt.content.substring(0, 150)}...
        </Text>
      </View>
      
      <View style={styles.promptFooter}>
        <Text style={styles.promptKey}>🔑 {prompt.key}</Text>
        <View style={styles.promptActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => openEditor(prompt)}
          >
            <Ionicons name="create-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => deletePrompt(prompt)}
          >
            <Ionicons name="trash-outline" size={20} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEditor = () => (
    <Modal
      visible={showEditor}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={closeEditor}
    >
      <SafeAreaView style={styles.editorContainer} edges={['top', 'bottom']}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.editorHeader}>
            <TouchableOpacity onPress={closeEditor} style={styles.editorBackButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.editorTitle}>
              {isNewPrompt ? 'Nuevo Prompt' : 'Editar Prompt'}
            </Text>
            <TouchableOpacity 
              onPress={savePrompt} 
              style={styles.saveButton}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.surface} />
              ) : (
                <Text style={styles.saveButtonText}>Guardar</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.editorContent} keyboardShouldPersistTaps="handled">
            <View style={styles.formGroup}>
              <Text style={styles.label}>Nombre *</Text>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder="Ej: Chat con Clientes"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            {isNewPrompt && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Clave Única *</Text>
                <TextInput
                  style={styles.input}
                  value={editKey}
                  onChangeText={setEditKey}
                  placeholder="Ej: chat_client"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                />
                <Text style={styles.hint}>Identificador único (sin espacios)</Text>
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.label}>Descripción</Text>
              <TextInput
                style={styles.input}
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder={t('admin.promptDescPlaceholder', 'Descripción breve del prompt')}
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Categoría</Text>
              <View style={styles.categorySelector}>
                {['chat', 'commands', 'fallback', 'general'].map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryOption,
                      editCategory === cat && styles.categoryOptionSelected,
                      { borderColor: categoryColors[cat] }
                    ]}
                    onPress={() => setEditCategory(cat)}
                  >
                    <Text style={[
                      styles.categoryOptionText,
                      editCategory === cat && { color: categoryColors[cat] }
                    ]}>
                      {categoryLabels[cat]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <View style={styles.switchRow}>
                <Text style={styles.label}>Estado</Text>
                <TouchableOpacity
                  style={[styles.toggleButton, editIsActive ? styles.toggleActive : styles.toggleInactive]}
                  onPress={() => setEditIsActive(!editIsActive)}
                >
                  <Text style={styles.toggleText}>
                    {editIsActive ? 'Activo ✓' : 'Inactivo'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Contenido del Prompt *</Text>
              <TextInput
                style={styles.contentInput}
                value={editContent}
                onChangeText={setEditContent}
                placeholder={t('admin.promptContentPlaceholder', 'Escribe el prompt aquí...')}
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={15}
                textAlignVertical="top"
              />
              <Text style={styles.hint}>{editContent.length} caracteres</Text>
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <AdminHeader title="Prompts de IA" showBack />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando prompts...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AdminHeader title="Prompts de IA" showBack />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color={colors.info} />
          <Text style={styles.infoText}>
            Los prompts definen cómo responde la IA. Modifícalos para personalizar el comportamiento del asistente.
          </Text>
        </View>

        {prompts.map(renderPromptCard)}

        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => openEditor()}
        >
          <Ionicons name="add-circle" size={24} color={colors.primary} />
          <Text style={styles.addButtonText}>Agregar Nuevo Prompt</Text>
        </TouchableOpacity>

        <View style={{ height: 50 }} />
      </ScrollView>

      {renderEditor()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#EBF5FF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'flex-start',
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.info,
    lineHeight: 20,
  },
  promptCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  promptHeader: {
    marginBottom: 12,
  },
  promptTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: '600',
  },
  statusToggle: {
    padding: 4,
  },
  statusActive: {},
  statusInactive: {
    opacity: 0.6,
  },
  promptName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  promptDescription: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  promptPreview: {
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  promptContent: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 18,
  },
  promptFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  promptKey: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  promptActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    gap: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  // Editor styles
  editorContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  editorBackButton: {
    padding: 4,
  },
  editorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '600',
  },
  editorContent: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
  },
  hint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  categorySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    backgroundColor: colors.surface,
  },
  categoryOptionSelected: {
    backgroundColor: colors.background,
  },
  categoryOptionText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  toggleActive: {
    backgroundColor: '#D1FAE5',
  },
  toggleInactive: {
    backgroundColor: '#FEE2E2',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  contentInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: colors.text,
    minHeight: 300,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});

export default AIPromptsScreen;
