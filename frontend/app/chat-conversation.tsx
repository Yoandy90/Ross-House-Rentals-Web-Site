/**
 * Chat Conversation Screen (Admin)
 * Individual chat between admin and tenant
 * With AI toggle per conversation
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Alert,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { apiCall } from '../src/utils/api';
import { Spacing, FontSizes, BorderRadius, useColors } from '../src/constants/theme';

interface Message {
  _id: string;
  conversation_id: string;
  sender_type: 'tenant' | 'admin' | 'ai';
  sender_name: string;
  content: string;
  read: boolean;
  created_at: string;
}

export default function ChatConversationScreen() {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const conversationId = params.conversationId as string;
  const clientName = params.clientName as string;
  const clientId = params.clientId as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [aiEnabled, setAiEnabled] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadMessages();
    loadAIStatus();
    markAsRead();

    // Polling every 5 seconds
    pollRef.current = setInterval(loadMessages, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const loadAIStatus = async () => {
    try {
      const data = await apiCall(`/chat/ai/status/${conversationId}`);
      setAiEnabled(data.ai_enabled || false);
    } catch (error) {
      console.log('Error loading AI status');
    }
  };

  const toggleAI = async () => {
    try {
      const newValue = !aiEnabled;
      await apiCall(`/chat/ai/toggle/${conversationId}`, {
        method: 'POST',
        body: JSON.stringify({ enabled: newValue }),
      });
      setAiEnabled(newValue);
      Alert.alert(
        'IA Automática',
        newValue 
          ? '🤖 IA activada para esta conversación. El asistente responderá automáticamente a este inquilino.' 
          : '✋ IA desactivada. Tú responderás manualmente a este inquilino.'
      );
    } catch (error) {
      Alert.alert('Error', 'No se pudo cambiar el estado de la IA');
    }
  };

  const markAsRead = async () => {
    try {
      await apiCall(`/chat/conversations/${conversationId}/read`, { method: 'POST' });
    } catch (error) {
      console.log('Error marking as read');
    }
  };

  const loadMessages = useCallback(async () => {
    try {
      const data = await apiCall(`/chat/conversations/${conversationId}/messages`);
      if (data.messages) {
        setMessages(data.messages);
      }
    } catch (error) {
      console.log('Error loading messages');
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  const sendMessage = async () => {
    if (!messageText.trim() || sending) return;

    const text = messageText.trim();
    setMessageText('');
    setSending(true);

    // Optimistic update
    const tempMessage: Message = {
      _id: `temp-${Date.now()}`,
      conversation_id: conversationId,
      sender_type: 'admin',
      sender_name: 'Admin',
      content: text,
      read: true,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMessage]);
    
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      await apiCall('/chat/admin/send', {
        method: 'POST',
        body: JSON.stringify({ 
          conversation_id: conversationId,
          content: text,
          message_type: 'text'
        }),
      });
      loadMessages();
    } catch (error) {
      Alert.alert('Error', 'No se pudo enviar el mensaje');
      // Remove optimistic message
      setMessages(prev => prev.filter(m => m._id !== tempMessage._id));
      setMessageText(text);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Hoy';
    if (date.toDateString() === yesterday.toDateString()) return 'Ayer';
    return date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isAdmin = item.sender_type === 'admin';
    const isAI = item.sender_type === 'ai';
    const showDate = index === 0 || 
      formatDate(item.created_at) !== formatDate(messages[index - 1]?.created_at);

    return (
      <>
        {showDate && (
          <View style={styles.dateSeparator}>
            <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
          </View>
        )}
        <View style={[styles.messageContainer, (isAdmin || isAI) && styles.messageContainerRight]}>
          {isAI && (
            <View style={styles.aiBubbleIndicator}>
              <Ionicons name="flash" size={12} color={C.success} />
            </View>
          )}
          <View style={[
            styles.messageBubble,
            isAdmin && styles.adminBubble,
            isAI && styles.aiBubble,
          ]}>
            {isAI && <Text style={styles.aiLabel}>Respuesta IA</Text>}
            <Text style={[styles.messageText, (isAdmin || isAI) && styles.messageTextAdmin]}>
              {item.content}
            </Text>
            <View style={styles.messageFooter}>
              <Text style={[styles.messageTime, (isAdmin || isAI) && styles.messageTimeAdmin]}>
                {formatTime(item.created_at)}
              </Text>
              {(isAdmin || isAI) && (
                <Ionicons 
                  name={item.read ? "checkmark-done" : "checkmark"} 
                  size={14} 
                  color={item.read ? "#3B82F6" : "rgba(255,255,255,0.5)"} 
                  style={{ marginLeft: 4 }}
                />
              )}
            </View>
          </View>
        </View>
      </>
    );
  };

  // Quick Response Templates
  const QUICK_RESPONSES = [
    { label: '👋 Bienvenida', text: '¡Hola! Gracias por contactarnos. ¿En qué puedo ayudarte hoy?' },
    { label: '✅ Recibido', text: 'Tu solicitud ha sido recibida. La estamos procesando y te responderemos pronto.' },
    { label: '🔧 En proceso', text: 'Estamos trabajando en tu solicitud. Te notificaremos cuando tengamos una actualización.' },
    { label: '💳 Pago confirmado', text: 'Confirmamos que tu pago ha sido recibido exitosamente. ¡Gracias!' },
    { label: '📅 Agendar', text: '¿Te gustaría agendar una cita? Tenemos disponibilidad esta semana.' },
    { label: '⏰ Recordatorio', text: 'Te recordamos que tu pago de renta vence pronto. Por favor asegúrate de realizarlo a tiempo.' },
  ];

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={C.brandRed} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.textPrimary} />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{clientName?.charAt(0).toUpperCase() || 'U'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{clientName || 'Inquilino'}</Text>
            <View style={styles.headerStatus}>
              {aiEnabled ? (
                <>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>IA activa</Text>
                </>
              ) : (
                <Text style={styles.statusTextMuted}>Respuestas manuales</Text>
              )}
            </View>
          </View>
        </View>

        <TouchableOpacity onPress={() => setShowAIPanel(!showAIPanel)} style={styles.aiBtn}>
          <Ionicons name="flash" size={20} color={aiEnabled ? C.success : C.textMuted} />
        </TouchableOpacity>
      </View>

      {/* AI Control Panel */}
      {showAIPanel && (
        <View style={styles.aiPanel}>
          <View style={styles.aiPanelContent}>
            <View style={styles.aiPanelLeft}>
              <Ionicons name="flash" size={24} color={aiEnabled ? C.success : C.textMuted} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={styles.aiPanelTitle}>🤖 IA para esta conversación</Text>
                <Text style={styles.aiPanelSubtitle}>
                  {aiEnabled 
                    ? 'La IA responderá automáticamente' 
                    : 'Tú respondes manualmente'}
                </Text>
              </View>
            </View>
            <Switch
              value={aiEnabled}
              onValueChange={toggleAI}
              trackColor={{ false: '#4B5563', true: C.success }}
              thumbColor="#fff"
            />
          </View>
        </View>
      )}

      {/* Messages */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Ionicons name="chatbubble-ellipses-outline" size={48} color={C.textMuted} />
              <Text style={styles.emptyChatText}>No hay mensajes aún</Text>
              <Text style={styles.emptyChatSubtext}>Empieza la conversación con el inquilino</Text>
            </View>
          }
        />

        {/* Quick Responses */}
        <View style={styles.quickResponsesContainer}>
          <FlatList
            horizontal
            data={QUICK_RESPONSES}
            keyExtractor={(item, idx) => idx.toString()}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickResponsesList}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.quickResponseBtn}
                onPress={() => setMessageText(item.text)}
              >
                <Text style={styles.quickResponseText}>{item.label}</Text>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Input */}
        <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            style={styles.input}
            placeholder="Escribe un mensaje..."
            placeholderTextColor={C.textMuted}
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity 
            style={[styles.sendBtn, (!messageText.trim() || sending) && styles.sendBtnDisabled]}
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
    </View>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
    backgroundColor: C.glass,
    borderBottomWidth: 1,
    borderBottomColor: C.glassBorder,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: C.glassLight,
    borderWidth: 1, borderColor: C.glassBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 12 },
  headerAvatar: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: C.brandRed,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 10,
  },
  headerAvatarText: { color: C.textPrimary, fontSize: FontSizes.md, fontWeight: '700' },
  headerTitle: { fontSize: FontSizes.md, fontWeight: '700', color: C.textPrimary },
  headerStatus: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.success, marginRight: 6 },
  statusText: { fontSize: FontSizes.xs, color: C.success },
  statusTextMuted: { fontSize: FontSizes.xs, color: C.textMuted },
  aiBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: C.glassLight,
    borderWidth: 1, borderColor: C.glassBorder,
    justifyContent: 'center', alignItems: 'center',
  },

  aiPanel: {
    backgroundColor: C.glass,
    borderBottomWidth: 1,
    borderBottomColor: C.glassBorder,
    padding: Spacing.md,
  },
  aiPanelContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aiPanelLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  aiPanelTitle: { fontSize: FontSizes.sm, fontWeight: '600', color: C.textPrimary },
  aiPanelSubtitle: { fontSize: FontSizes.xs, color: C.textMuted, marginTop: 2 },

  messagesList: { padding: Spacing.base, paddingBottom: 100 },

  dateSeparator: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateText: {
    fontSize: FontSizes.xs,
    color: C.textMuted,
    backgroundColor: C.glassLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },

  messageContainer: {
    flexDirection: 'row',
    marginBottom: 8,
    maxWidth: '80%',
  },
  messageContainerRight: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },

  aiBubbleIndicator: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(16,185,129,0.1)',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 6, alignSelf: 'flex-end', marginBottom: 4,
  },

  messageBubble: {
    backgroundColor: C.glassLight,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    padding: 12,
  },
  adminBubble: {
    backgroundColor: C.brandRed,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: 'rgba(16,185,129,0.2)',
    borderColor: 'rgba(16,185,129,0.3)',
    borderWidth: 1,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 4,
  },
  aiLabel: {
    fontSize: 10,
    color: C.success,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  messageText: {
    fontSize: FontSizes.sm,
    color: C.white,
    lineHeight: 20,
  },
  messageTextAdmin: {
    color: C.textPrimary,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 10,
    color: C.textMuted,
  },
  messageTimeAdmin: {
    color: C.textSecondary,
  },

  emptyChat: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyChatText: {
    fontSize: FontSizes.md,
    color: C.textMuted,
    marginTop: 16,
  },
  emptyChatSubtext: {
    fontSize: FontSizes.sm,
    color: C.textDim,
    marginTop: 4,
  },

  quickResponsesContainer: {
    borderTopWidth: 1,
    borderTopColor: C.glassBorder,
    backgroundColor: C.glass,
  },
  quickResponsesList: {
    paddingHorizontal: Spacing.base,
    paddingVertical: 10,
  },
  quickResponseBtn: {
    backgroundColor: C.glassLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    marginRight: 8,
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  quickResponseText: {
    fontSize: FontSizes.xs,
    color: C.textSecondary,
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: Spacing.base,
    backgroundColor: C.glass,
    borderTopWidth: 1,
    borderTopColor: C.glassBorder,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: C.glassLight,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: C.textPrimary,
    fontSize: FontSizes.sm,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.brandRed,
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
});
