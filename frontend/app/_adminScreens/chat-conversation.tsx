/**
 * Chat Conversation Screen
 * Individual chat between admin and client
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  Alert,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import api from '../../services/api';

interface Message {
  message_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  content: string;
  created_at: string;
  is_read: boolean;
  attachment?: {
    file_name: string;
    file_data: string;
    file_type: string;
  };
}

const ChatConversation = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const conversationId = params.id as string;
  const clientName = params.name as string;
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiGlobalEnabled, setAiGlobalEnabled] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadMessages();
    loadAIStatus();
    // Polling cada 5 segundos
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadAIStatus = async () => {
    try {
      // Check global status
      const globalResponse = await api.get('/chat/ai/global-status');
      setAiGlobalEnabled(globalResponse.data.ai_enabled_global || false);
      
      // Check conversation-specific status
      const statusResponse = await api.get(`/chat/ai/status/${conversationId}`);
      setAiEnabled(statusResponse.data.ai_enabled || false);
    } catch (error) {
      console.error('Error loading AI status:', error);
    }
  };

  const toggleAI = async () => {
    try {
      const newValue = !aiEnabled;
      await api.post(`/chat/ai/toggle/${conversationId}`, { enabled: newValue });
      setAiEnabled(newValue);
      Alert.alert(
        'IA Automática',
        newValue 
          ? '🤖 IA activada para esta conversación. El asistente responderá automáticamente.' 
          : '✋ IA desactivada. Ahora responderás tú manualmente.'
      );
    } catch (error) {
      console.error('Error toggling AI:', error);
      Alert.alert('Error', 'No se pudo cambiar el estado de la IA');
    }
  };

  const toggleGlobalAI = async () => {
    try {
      const newValue = !aiGlobalEnabled;
      await api.post('/chat/ai/toggle-global', { enabled: newValue });
      setAiGlobalEnabled(newValue);
      Alert.alert(
        'IA Global',
        newValue 
          ? '🌐 IA activada globalmente para todas las conversaciones.' 
          : '🌐 IA desactivada globalmente.'
      );
    } catch (error) {
      console.error('Error toggling global AI:', error);
      Alert.alert('Error', 'No se pudo cambiar el estado global de la IA');
    }
  };

  const loadMessages = async () => {
    try {
      const response = await api.get(`/chat/conversations/${conversationId}/messages`);
      const newMessages = response.data.messages || [];
      setMessages(newMessages);
      
      // Marcar como leídos
      if (newMessages.length > 0) {
        const unreadIds = newMessages
          .filter((msg: Message) => !msg.is_read && msg.sender_role !== 'admin')
          .map((msg: Message) => msg.message_id);
        
        if (unreadIds.length > 0) {
          await api.post('/chat/messages/read', {
            conversation_id: conversationId,
            message_ids: unreadIds,
          });
        }
      }
      
      // Scroll to bottom on first load
      if (loading) {
        setTimeout(() => scrollToBottom(), 100);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    flatListRef.current?.scrollToEnd({ animated: true });
  };

  const handleAttachmentPress = () => {
    Alert.alert(
      'Adjuntar archivo',
      'Selecciona el tipo de archivo',
      [
        { text: '📷 Foto/Imagen', onPress: pickImage },
        { text: '📄 Documento', onPress: pickDocument },
        { text: 'Cancelar', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const file = result.assets[0];
        console.log('Documento seleccionado:', file);
        await sendAttachment(file.name, file.uri, 'document');
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'No se pudo seleccionar el documento');
    }
  };

  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para seleccionar imágenes');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const image = result.assets[0];
        console.log('Imagen seleccionada');
        await sendAttachment(
          `image_${Date.now()}.jpg`,
          `data:image/jpeg;base64,${image.base64}`,
          'image'
        );
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };

  const sendAttachment = async (fileName: string, fileUri: string, fileType: string) => {
    setSending(true);
    
    try {
      await api.post('/chat/messages', {
        conversation_id: conversationId,
        content: `[${fileType === 'image' ? '🖼️ Imagen' : '📄 Documento'}]: ${fileName}`,
        attachment: {
          file_name: fileName,
          file_data: fileUri,
          file_type: fileType,
        },
      });

      await loadMessages();
      setTimeout(() => scrollToBottom(), 100);
      Alert.alert('Éxito', 'Archivo enviado correctamente');
    } catch (error) {
      console.error('Error sending attachment:', error);
      Alert.alert('Error', 'No se pudo enviar el archivo');
    } finally {
      setSending(false);
    }
  };

  const sendMessage = async () => {
    if (!messageText.trim()) return;

    const tempMessage = messageText;
    setMessageText('');
    setSending(true);
    Keyboard.dismiss();

    try {
      await api.post('/chat/messages', {
        conversation_id: conversationId,
        content: tempMessage,
        message_type: 'text',
      });

      // Recargar mensajes inmediatamente
      await loadMessages();
      scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
      setMessageText(tempMessage);
    } finally {
      setSending(false);
    }
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isAdmin = item.sender_role === 'admin';
    const isAI = item.sender_name === 'Asistente IA' || item.sender_id === 'ai-assistant';
    
    // Detectar si el mensaje tiene una imagen adjunta
    const hasImage = item.attachment && item.attachment.file_type === 'image';
    const hasDocument = item.attachment && item.attachment.file_type === 'document';
    
    // También detectar URLs de imágenes en el contenido
    const imageUrlMatch = item.content?.match(/https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp)/i);
    const hasImageUrl = !!imageUrlMatch;
    
    return (
      <View style={[styles.messageContainer, isAdmin ? styles.messageRight : styles.messageLeft]}>
        <View style={[
          styles.messageBubble, 
          isAdmin ? styles.messageBubbleAdmin : styles.messageBubbleClient,
          isAI && styles.messageBubbleAI
        ]}>
          {!isAdmin && (
            <Text style={styles.senderName}>{item.sender_name}</Text>
          )}
          {isAI && (
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>🤖 IA</Text>
            </View>
          )}
          
          {/* Mostrar imagen adjunta */}
          {hasImage && item.attachment && (
            <TouchableOpacity 
              onPress={() => {
                if (item.attachment?.file_data) {
                  Linking.openURL(item.attachment.file_data).catch(() => {});
                }
              }}
              style={styles.attachmentContainer}
            >
              <Image 
                source={{ uri: item.attachment.file_data }}
                style={styles.attachmentImage}
                resizeMode="cover"
              />
              <Text style={styles.attachmentFileName}>{item.attachment.file_name}</Text>
            </TouchableOpacity>
          )}
          
          {/* Mostrar documento adjunto */}
          {hasDocument && item.attachment && (
            <TouchableOpacity 
              onPress={() => {
                if (item.attachment?.file_data) {
                  Linking.openURL(item.attachment.file_data).catch(() => {
                    Alert.alert('Error', 'No se pudo abrir el documento');
                  });
                }
              }}
              style={styles.documentContainer}
            >
              <Ionicons name="document-text" size={32} color="#6366f1" />
              <Text style={styles.documentFileName}>{item.attachment.file_name}</Text>
            </TouchableOpacity>
          )}
          
          {/* Mostrar imagen desde URL en el contenido */}
          {hasImageUrl && imageUrlMatch && (
            <TouchableOpacity 
              onPress={() => Linking.openURL(imageUrlMatch[0]).catch(() => {})}
              style={styles.attachmentContainer}
            >
              <Image 
                source={{ uri: imageUrlMatch[0] }}
                style={styles.attachmentImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          )}
          
          {/* Texto del mensaje (ocultar si solo es un indicador de imagen) */}
          {item.content && !item.content.startsWith('[🖼️') && !item.content.startsWith('[📄') && (
            <Text style={[styles.messageText, isAdmin && styles.messageTextAdmin]}>
              {item.content}
            </Text>
          )}
          
          <View style={styles.messageFooter}>
            <Text style={[styles.messageTime, isAdmin && styles.messageTimeAdmin]}>
              {formatMessageTime(item.created_at)}
            </Text>
            {isAdmin && (
              <Ionicons 
                name={item.is_read ? "checkmark-done" : "checkmark"} 
                size={14} 
                color={item.is_read ? "#10b981" : "#ffffff"} 
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <>
      <View style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        right: 0, 
        height: insets.top + 70,
        backgroundColor: '#1a1a2e',
        zIndex: -1
      }} />
      
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <LinearGradient
          colors={['#1a1a2e', '#1a1a2e']}
          style={[styles.headerGradient, { paddingTop: insets.top }]}
        >
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color="#ffffff" />
            </TouchableOpacity>
            
            <View style={styles.headerCenter}>
              <View style={styles.avatarSmall}>
                <Text style={styles.avatarSmallText}>
                  {clientName?.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={styles.headerTitle}>{clientName}</Text>
                <View style={styles.headerSubtitleContainer}>
                  <Text style={styles.headerSubtitle}>Cliente</Text>
                  {aiEnabled && (
                    <View style={styles.aiActiveBadge}>
                      <Text style={styles.aiActiveBadgeText}>🤖 IA</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
            
            <TouchableOpacity 
              style={styles.aiToggleButton}
              onPress={toggleAI}
            >
              <Ionicons 
                name={aiEnabled ? "flash" : "flash-outline"} 
                size={22} 
                color={aiEnabled ? "#10b981" : "#ffffff"} 
              />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4E79A7" />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.message_id}
              contentContainerStyle={styles.messagesList}
              onContentSizeChange={() => scrollToBottom()}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="chatbubble-ellipses-outline" size={64} color="#ccc" />
                  <Text style={styles.emptyText}>
                    Inicia la conversación con {clientName}
                  </Text>
                </View>
              }
              showsVerticalScrollIndicator={false}
            />
          )}

          <View style={styles.inputContainer}>
            <TouchableOpacity 
              style={styles.attachButton}
              onPress={handleAttachmentPress}
              disabled={sending}
            >
              <Ionicons name="add-circle-outline" size={28} color={sending ? "#ccc" : "#4E79A7"} />
            </TouchableOpacity>
            
            <TextInput
              style={styles.input}
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Escribe un mensaje..."
              placeholderTextColor="#9ca3af"
              multiline
              maxLength={1000}
            />
            
            <TouchableOpacity
              style={[styles.sendButton, (!messageText.trim() || sending) && styles.sendButtonDisabled]}
              onPress={sendMessage}
              disabled={!messageText.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  flex: {
    flex: 1,
  },
  headerGradient: {
    paddingBottom: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1a1a2e',
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginLeft: 8,
  },
  avatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4E79A7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarSmallText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: '80%',
  },
  messageLeft: {
    alignSelf: 'flex-start',
  },
  messageRight: {
    alignSelf: 'flex-end',
  },
  messageBubble: {
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageBubbleClient: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
  },
  messageBubbleAdmin: {
    backgroundColor: '#3b82f6',
    borderBottomRightRadius: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4E79A7',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    color: '#1f2937',
    lineHeight: 22,
  },
  messageTextAdmin: {
    color: '#ffffff',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  messageTime: {
    fontSize: 11,
    color: '#9ca3af',
  },
  messageTimeAdmin: {
    color: '#dbeafe',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 8,
  },
  attachButton: {
    padding: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    color: '#1f2937',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  // AI Styles
  headerSubtitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  aiActiveBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  aiActiveBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  aiToggleButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
  },
  messageBubbleAI: {
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#059669',
  },
  aiBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#1f2937',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#10b981',
  },
  // Estilos para adjuntos (imágenes y documentos)
  attachmentContainer: {
    marginVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
  },
  attachmentImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
  },
  attachmentFileName: {
    fontSize: 12,
    color: '#6b7280',
    padding: 6,
    textAlign: 'center',
  },
  documentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 12,
    marginVertical: 8,
    gap: 10,
  },
  documentFileName: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
});

export default ChatConversation;
