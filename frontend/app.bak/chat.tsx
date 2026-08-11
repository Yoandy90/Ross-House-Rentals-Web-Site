import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard, Animated,
  Easing, Alert, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, API_URL } from '../src/constants/theme';
import { useAuth } from '../src/contexts/AuthContext';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';

interface Message {
  id: string;
  conversation_id: string;
  sender_type: 'user' | 'admin' | 'ai';
  sender_name: string;
  text: string;
  read: boolean;
  created_at: string;
  image_url?: string;
}

// ─── Animated typing dots ───
const TypingDots = () => {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 400, easing: Easing.ease, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 400, easing: Easing.ease, useNativeDriver: true }),
        ])
      );
    animate(dot1, 0).start();
    animate(dot2, 200).start();
    animate(dot3, 400).start();
  }, []);

  return (
    <View style={S.typingDotsRow}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View key={i} style={[S.typingDot, { opacity: dot, transform: [{ scale: dot }] }]} />
      ))}
    </View>
  );
};

// ─── Online pulse dot ───
const OnlineDot = ({ color = '#34D399' }: { color?: string }) => {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.6, duration: 1200, easing: Easing.ease, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.ease, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <View style={S.onlineDotWrap}>
      <Animated.View style={[S.onlinePulse, { backgroundColor: `${color}4D`, transform: [{ scale: pulse }] }]} />
      <View style={[S.onlineDotInner, { backgroundColor: color }]} />
    </View>
  );
};

export default function ChatScreen() {
  const { t } = useTranslation();
  const { user, token } = useAuth();

  // ─── Mode toggle: human advisor vs AI ───
  const [isAIMode, setIsAIMode] = useState(false);

  // ─── Human chat state ───
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [adminTyping, setAdminTyping] = useState(false);

  // ─── AI chat state ───
  const [aiMessages, setAiMessages] = useState<Message[]>([]);
  const [aiConversationHistory, setAiConversationHistory] = useState<Array<{ role: string; content: string }>>([]);
  const [aiThinking, setAiThinking] = useState(false);

  // ─── Shared state ───
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMessageTime = useRef<string | null>(null);
  const sendScale = useRef(new Animated.Value(1)).current;
  const modeAnim = useRef(new Animated.Value(0)).current;

  // Current messages based on mode
  const currentMessages = isAIMode ? aiMessages : messages;
  const isTyping = isAIMode ? aiThinking : adminTyping;

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }), [token]);

  // ─── Animate mode switch ───
  useEffect(() => {
    Animated.timing(modeAnim, {
      toValue: isAIMode ? 1 : 0,
      duration: 300,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [isAIMode]);

  useEffect(() => {
    loadMessages();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    if (!conversationId || isAIMode) return;
    pollRef.current = setInterval(pollNewMessages, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [conversationId, isAIMode]);

  // Stop polling when in AI mode, restart when in human mode
  useEffect(() => {
    if (isAIMode) {
      if (pollRef.current) clearInterval(pollRef.current);
    } else if (conversationId) {
      pollRef.current = setInterval(pollNewMessages, 3000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isAIMode]);

  const loadMessages = async () => {
    try {
      const res = await fetch(`${API_URL}/api/lending-chat/my-messages`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setConversationId(data.conversation_id || null);
        if (data.messages?.length > 0) {
          lastMessageTime.current = data.messages[data.messages.length - 1].created_at;
        }
      }
    } catch (e) { console.log('Load messages error:', e); }
    setLoading(false);
  };

  const pollNewMessages = async () => {
    try {
      let url = `${API_URL}/api/lending-chat/my-messages`;
      if (lastMessageTime.current) url += `?after=${encodeURIComponent(lastMessageTime.current)}`;
      const res = await fetch(url, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        if (data.messages?.length > 0) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newMsgs = data.messages.filter((m: Message) => !existingIds.has(m.id));
            if (newMsgs.length > 0) {
              lastMessageTime.current = newMsgs[newMsgs.length - 1].created_at;
              return [...prev, ...newMsgs];
            }
            return prev;
          });
        }
        if (data.conversation_id) setConversationId(data.conversation_id);
      }
      if (conversationId) {
        const convRes = await fetch(`${API_URL}/api/lending-chat/my-conversation`, { headers: headers() });
        if (convRes.ok) {
          const convData = await convRes.json();
          setAdminTyping(convData.admin_typing || false);
        }
      }
    } catch (e) { /* silent */ }
  };

  // ─── Send to Human Advisor ───
  const sendHumanMessage = async (text: string) => {
    const tempMsg: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: conversationId || '',
      sender_type: 'user',
      sender_name: user?.name || 'Yo',
      text,
      read: false,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      const res = await fetch(`${API_URL}/api/lending-chat/send`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ text, conversation_id: conversationId }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => prev.map(m => m.id === tempMsg.id ? { ...data, id: data.id } : m));
        if (data.conversation_id) setConversationId(data.conversation_id);
        lastMessageTime.current = data.created_at;
      }
    } catch (e) { console.log('Send error:', e); }
  };

  // ─── Send to AI Brain ───
  const sendAIMessage = async (text: string) => {
    const userMsg: Message = {
      id: `ai-user-${Date.now()}`,
      conversation_id: 'ai-conversation',
      sender_type: 'user',
      sender_name: user?.name || 'Yo',
      text,
      read: true,
      created_at: new Date().toISOString(),
    };
    setAiMessages(prev => [...prev, userMsg]);

    // Update conversation history for context
    const updatedHistory = [...aiConversationHistory, { role: 'user', content: text }];
    setAiConversationHistory(updatedHistory);

    setAiThinking(true);

    try {
      const res = await fetch(`${API_URL}/api/lending-brain/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversation_history: updatedHistory.slice(-10), // Last 10 messages for context
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.response) {
          const aiMsg: Message = {
            id: `ai-resp-${Date.now()}`,
            conversation_id: 'ai-conversation',
            sender_type: 'ai',
            sender_name: 'IA Ross Lending',
            text: data.response,
            read: true,
            created_at: new Date().toISOString(),
          };
          setAiMessages(prev => [...prev, aiMsg]);
          setAiConversationHistory(prev => [...prev, { role: 'assistant', content: data.response }]);
        } else {
          const errorMsg: Message = {
            id: `ai-err-${Date.now()}`,
            conversation_id: 'ai-conversation',
            sender_type: 'ai',
            sender_name: 'IA Ross Lending',
            text: data.response || t('chat.aiError', 'Lo siento, no pude procesar tu consulta. Intenta de nuevo.'),
            read: true,
            created_at: new Date().toISOString(),
          };
          setAiMessages(prev => [...prev, errorMsg]);
        }
      } else {
        const errorMsg: Message = {
          id: `ai-err-${Date.now()}`,
          conversation_id: 'ai-conversation',
          sender_type: 'ai',
          sender_name: 'IA Ross Lending',
          text: t('chat.aiUnavailable', 'El asistente de IA no está disponible en este momento. Por favor, intenta más tarde o contacta a un asesor.'),
          read: true,
          created_at: new Date().toISOString(),
        };
        setAiMessages(prev => [...prev, errorMsg]);
      }
    } catch (e) {
      console.log('AI Send error:', e);
      const errorMsg: Message = {
        id: `ai-err-${Date.now()}`,
        conversation_id: 'ai-conversation',
        sender_type: 'ai',
        sender_name: 'IA Ross Lending',
        text: t('chat.aiConnectionError', 'Error de conexión. Verifica tu internet e intenta de nuevo.'),
        read: true,
        created_at: new Date().toISOString(),
      };
      setAiMessages(prev => [...prev, errorMsg]);
    }
    setAiThinking(false);
  };

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    // Animate send button
    Animated.sequence([
      Animated.timing(sendScale, { toValue: 0.7, duration: 80, useNativeDriver: true }),
      Animated.timing(sendScale, { toValue: 1, duration: 150, easing: Easing.elastic(1.3), useNativeDriver: true }),
    ]).start();

    setSending(true);
    setInputText('');
    Keyboard.dismiss();

    if (isAIMode) {
      await sendAIMessage(text);
    } else {
      await sendHumanMessage(text);
    }

    setSending(false);
  };

  const handleAttach = () => {
    if (isAIMode) {
      Alert.alert(
        t('chat.aiOnly', 'Solo texto'),
        t('chat.aiTextOnly', 'El asistente de IA solo acepta mensajes de texto por el momento.')
      );
      return;
    }
    Alert.alert(
      t('chat.attachTitle', 'Adjuntar'),
      t('chat.attachDesc', '¿Qué deseas enviar?'),
      [
        {
          text: t('chat.takePhoto', '📷 Tomar Foto'),
          onPress: async () => {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (perm.granted) {
              const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
              if (!result.canceled) {
                Alert.alert(t('chat.comingSoon', 'Próximamente'), t('chat.attachSoon', 'El envío de imágenes estará disponible pronto.'));
              }
            }
          },
        },
        {
          text: t('chat.gallery', '🖼️ Galería'),
          onPress: async () => {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (perm.granted) {
              const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
              if (!result.canceled) {
                Alert.alert(t('chat.comingSoon', 'Próximamente'), t('chat.attachSoon', 'El envío de imágenes estará disponible pronto.'));
              }
            }
          },
        },
        { text: t('common.cancel', 'Cancelar'), style: 'cancel' },
      ]
    );
  };

  // ─── Helpers ───
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return t('chat.today', 'Hoy');
    if (date.toDateString() === yesterday.toDateString()) return t('chat.yesterday', 'Ayer');
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
  };

  const shouldShowDateHeader = (index: number) => {
    if (index === 0) return true;
    return new Date(currentMessages[index].created_at).toDateString() !== new Date(currentMessages[index - 1].created_at).toDateString();
  };

  const isFirstInGroup = (index: number) => {
    if (index === 0) return true;
    const curr = currentMessages[index];
    const prev = currentMessages[index - 1];
    if (curr.sender_type !== prev.sender_type) return true;
    const diff = new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime();
    return diff > 120000;
  };

  const isLastInGroup = (index: number) => {
    if (index === currentMessages.length - 1) return true;
    const curr = currentMessages[index];
    const next = currentMessages[index + 1];
    if (curr.sender_type !== next.sender_type) return true;
    const diff = new Date(next.created_at).getTime() - new Date(curr.created_at).getTime();
    return diff > 120000;
  };

  // ─── Render Message ───
  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isUser = item.sender_type === 'user';
    const isAI = item.sender_type === 'ai';
    const showDate = shouldShowDateHeader(index);
    const firstInGroup = isFirstInGroup(index);
    const lastInGroup = isLastInGroup(index);

    const getBubbleRadius = () => {
      const r = 20;
      const s = 6;
      if (isUser) {
        return {
          borderTopLeftRadius: r,
          borderTopRightRadius: firstInGroup ? r : s,
          borderBottomLeftRadius: r,
          borderBottomRightRadius: lastInGroup ? s : s,
        };
      } else {
        return {
          borderTopLeftRadius: firstInGroup ? r : s,
          borderTopRightRadius: r,
          borderBottomLeftRadius: lastInGroup ? s : s,
          borderBottomRightRadius: r,
        };
      }
    };

    return (
      <View>
        {showDate && (
          <View style={S.dateHeaderContainer}>
            <View style={S.dateHeaderLine} />
            <View style={S.dateHeaderBadge}>
              <Text style={S.dateHeaderText}>{formatDateHeader(item.created_at)}</Text>
            </View>
            <View style={S.dateHeaderLine} />
          </View>
        )}
        <View style={[
          S.messageRow,
          isUser && S.messageRowUser,
          { marginBottom: lastInGroup ? 12 : 3 },
          firstInGroup && !showDate && { marginTop: 4 },
        ]}>
          {/* Avatar - only show for admin/AI, only on last message of group */}
          {!isUser && (
            <View style={S.avatarSlot}>
              {lastInGroup ? (
                <View style={[S.advisorAvatar, isAI && S.aiAvatar]}>
                  <Ionicons
                    name={isAI ? 'sparkles' : 'headset'}
                    size={14}
                    color={isAI ? '#818CF8' : '#34D399'}
                  />
                </View>
              ) : null}
            </View>
          )}

          <View style={S.bubbleColumn}>
            <View style={[
              S.messageBubble,
              isUser ? S.userBubble : (isAI ? S.aiBubble : S.adminBubble),
              getBubbleRadius(),
            ]}>
              <Text style={[S.messageText, isUser && S.userMessageText]}>
                {item.text}
              </Text>
            </View>
            {lastInGroup && (
              <View style={[S.metaRow, isUser && S.metaRowUser]}>
                <Text style={S.metaTime}>{formatTime(item.created_at)}</Text>
                {isUser && !isAIMode && (
                  <Ionicons
                    name="checkmark-done"
                    size={14}
                    color={item.read ? '#34D399' : '#6B7280'}
                    style={{ marginLeft: 3 }}
                  />
                )}
                {isAI && (
                  <View style={S.aiLabelRow}>
                    <Ionicons name="sparkles" size={10} color="#818CF8" style={{ marginLeft: 6 }} />
                    <Text style={S.aiLabel}>IA</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  // ─── Mode toggle handler ───
  const handleModeToggle = () => {
    setIsAIMode(prev => !prev);
    setInputText('');
    // Scroll to end when switching modes
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // ─── Loading state ───
  if (loading) {
    return (
      <SafeAreaView style={S.container}>
        <View style={S.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primaryLight} />
          <Text style={S.loadingText}>{t('chat.loading', 'Cargando chat...')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={S.container} edges={['top']}>
      {/* ═══ Header ═══ */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()} style={S.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TouchableOpacity>

        <View style={S.headerCenter}>
          <View style={S.headerAvatarWrap}>
            <View style={[S.headerAvatar, isAIMode && S.headerAvatarAI]}>
              <Ionicons
                name={isAIMode ? 'sparkles' : 'headset'}
                size={18}
                color={isAIMode ? '#818CF8' : '#34D399'}
              />
            </View>
            <OnlineDot color={isAIMode ? '#818CF8' : '#34D399'} />
          </View>
          <View style={S.headerInfo}>
            <Text style={S.headerTitle}>
              {isAIMode
                ? t('chat.aiName', 'Asistente IA')
                : t('chat.advisorName', 'Asesor Ross Lending')}
            </Text>
            <Text style={[S.headerStatus, isAIMode && { color: '#818CF8' }]}>
              {isTyping
                ? t('chat.typing', 'escribiendo...')
                : isAIMode
                  ? t('chat.aiAlwaysOn', 'Disponible 24/7')
                  : t('chat.online', 'En línea')}
            </Text>
          </View>
        </View>

        {/* ─── Mode Toggle ─── */}
        <TouchableOpacity
          style={[S.modeToggle, isAIMode && S.modeToggleActive]}
          onPress={handleModeToggle}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isAIMode ? 'person' : 'sparkles'}
            size={16}
            color={isAIMode ? '#34D399' : '#818CF8'}
          />
          <Text style={[S.modeToggleText, isAIMode ? { color: '#34D399' } : { color: '#818CF8' }]}>
            {isAIMode ? t('chat.switchAdvisor', 'Asesor') : t('chat.switchAI', 'IA')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ─── AI Mode Banner ─── */}
      {isAIMode && aiMessages.length === 0 && (
        <View style={S.aiBanner}>
          <Ionicons name="information-circle" size={14} color="#818CF8" />
          <Text style={S.aiBannerText}>
            {t('chat.aiBannerInfo', 'Asistente con IA — respuestas instantáneas sobre préstamos y servicios')}
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* ═══ Messages List ═══ */}
        <FlatList
          ref={flatListRef}
          data={currentMessages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={S.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            isAIMode ? (
              <View style={S.emptyContainer}>
                <View style={S.emptyIconOuter}>
                  <View style={[S.emptyIconCircle, { backgroundColor: 'rgba(129,140,248,0.1)' }]}>
                    <Ionicons name="sparkles" size={36} color="#818CF8" />
                  </View>
                </View>
                <Text style={S.emptyTitle}>{t('chat.aiWelcome', '¡Hola!')} 🤖</Text>
                <Text style={S.emptySubtitle}>
                  {t('chat.aiEmptyDesc', 'Soy el asistente de IA de Ross Lending. Pregúntame sobre préstamos, tasas, requisitos o cualquier duda financiera.')}
                </Text>
                <View style={S.emptyHints}>
                  <View style={S.hintRow}>
                    <Ionicons name="flash-outline" size={16} color="#818CF8" />
                    <Text style={S.hintText}>{t('chat.aiInstant', 'Respuestas instantáneas')}</Text>
                  </View>
                  <View style={S.hintRow}>
                    <Ionicons name="time-outline" size={16} color="#818CF8" />
                    <Text style={S.hintText}>{t('chat.ai247', 'Disponible 24 horas, 7 días')}</Text>
                  </View>
                  <View style={S.hintRow}>
                    <Ionicons name="shield-checkmark-outline" size={16} color="#818CF8" />
                    <Text style={S.hintText}>{t('chat.aiSafe', 'Información regulada OCCC')}</Text>
                  </View>
                </View>

                {/* Quick prompts */}
                <View style={S.quickPromptsContainer}>
                  <Text style={S.quickPromptsTitle}>{t('chat.quickQuestions', 'Preguntas frecuentes:')}</Text>
                  {[
                    t('chat.prompt1', '¿Qué requisitos necesito para un préstamo?'),
                    t('chat.prompt2', '¿Cuáles son las tasas de interés?'),
                    t('chat.prompt3', '¿Cómo puedo hacer un pago?'),
                  ].map((prompt, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={S.quickPromptBtn}
                      onPress={() => {
                        setInputText(prompt);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={S.quickPromptText}>{prompt}</Text>
                      <Ionicons name="arrow-forward" size={14} color="#818CF8" />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : (
              <View style={S.emptyContainer}>
                <View style={S.emptyIconOuter}>
                  <View style={S.emptyIconCircle}>
                    <Ionicons name="chatbubbles" size={36} color="#34D399" />
                  </View>
                </View>
                <Text style={S.emptyTitle}>{t('chat.emptyTitle', '¡Hola!')} 👋</Text>
                <Text style={S.emptySubtitle}>
                  {t('chat.emptyDesc', 'Envía un mensaje para iniciar una conversación con tu asesor de préstamos.')}
                </Text>
                <View style={S.emptyHints}>
                  <View style={S.hintRow}>
                    <Ionicons name="time-outline" size={16} color={Colors.textMuted} />
                    <Text style={S.hintText}>{t('chat.responseTime', 'Respuesta en menos de 1 hora')}</Text>
                  </View>
                  <View style={S.hintRow}>
                    <Ionicons name="lock-closed-outline" size={16} color={Colors.textMuted} />
                    <Text style={S.hintText}>{t('chat.encrypted', 'Conversación segura y privada')}</Text>
                  </View>
                </View>
              </View>
            )
          }
          ListFooterComponent={
            isTyping ? (
              <View style={S.messageRow}>
                <View style={S.avatarSlot}>
                  <View style={[S.advisorAvatar, isAIMode && S.aiAvatar]}>
                    <Ionicons
                      name={isAIMode ? 'sparkles' : 'headset'}
                      size={14}
                      color={isAIMode ? '#818CF8' : '#34D399'}
                    />
                  </View>
                </View>
                <View style={S.bubbleColumn}>
                  <View style={[
                    S.messageBubble,
                    isAIMode ? S.aiBubble : S.adminBubble,
                    S.typingBubble,
                    { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomRightRadius: 20, borderBottomLeftRadius: 6 }
                  ]}>
                    <TypingDots />
                  </View>
                </View>
              </View>
            ) : null
          }
        />

        {/* ═══ Input Bar ═══ */}
        <View style={S.inputContainer}>
          {!isAIMode && (
            <TouchableOpacity style={S.attachBtn} onPress={handleAttach} activeOpacity={0.7}>
              <Ionicons name="add-circle-outline" size={26} color={Colors.textMuted} />
            </TouchableOpacity>
          )}

          <View style={[S.inputWrapper, isAIMode && S.inputWrapperAI]}>
            <TextInput
              style={S.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder={
                isAIMode
                  ? t('chat.aiPlaceholder', 'Pregúntale a la IA...')
                  : t('chat.placeholder', 'Escribe tu mensaje...')
              }
              placeholderTextColor="#4B5563"
              multiline
              maxLength={1000}
            />
          </View>

          <Animated.View style={{ transform: [{ scale: sendScale }] }}>
            <TouchableOpacity
              style={[
                S.sendBtn,
                isAIMode && S.sendBtnAI,
                !inputText.trim() && S.sendBtnDisabled,
              ]}
              onPress={sendMessage}
              disabled={!inputText.trim() || sending}
              activeOpacity={0.7}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="arrow-up" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════
const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080D14' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: Colors.textMuted, fontSize: 14 },

  // ─── Header ───
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#0D1420',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 4 },
  headerAvatarWrap: { position: 'relative' },
  headerAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(52,211,153,0.12)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: 'rgba(52,211,153,0.25)',
  },
  headerAvatarAI: {
    backgroundColor: 'rgba(129,140,248,0.12)',
    borderColor: 'rgba(129,140,248,0.25)',
  },
  onlineDotWrap: {
    position: 'absolute', bottom: 0, right: 0,
    width: 14, height: 14, justifyContent: 'center', alignItems: 'center',
  },
  onlinePulse: {
    position: 'absolute', width: 12, height: 12, borderRadius: 6,
    backgroundColor: 'rgba(52,211,153,0.3)',
  },
  onlineDotInner: {
    width: 9, height: 9, borderRadius: 5,
    backgroundColor: '#34D399',
    borderWidth: 1.5, borderColor: '#0D1420',
  },
  headerInfo: { marginLeft: 10, flex: 1 },
  headerTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  headerStatus: { fontSize: 11, color: '#34D399', marginTop: 1, fontWeight: '500' },
  headerAction: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center', alignItems: 'center',
  },

  // ─── Mode Toggle ───
  modeToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: 'rgba(129,140,248,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.2)',
  },
  modeToggleActive: {
    backgroundColor: 'rgba(52,211,153,0.08)',
    borderColor: 'rgba(52,211,153,0.2)',
  },
  modeToggleText: {
    fontSize: 12, fontWeight: '700',
  },

  // ─── AI Banner ───
  aiBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: 'rgba(129,140,248,0.06)',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(129,140,248,0.15)',
  },
  aiBannerText: {
    fontSize: 11, color: '#818CF8', fontWeight: '500', flex: 1,
  },

  // ─── Messages ───
  messagesList: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end' },
  messageRowUser: { justifyContent: 'flex-end' },

  avatarSlot: { width: 30, marginRight: 6, alignItems: 'center', justifyContent: 'flex-end' },
  advisorAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(52,211,153,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  aiAvatar: {
    backgroundColor: 'rgba(129,140,248,0.12)',
  },

  bubbleColumn: { maxWidth: '78%' },
  messageBubble: {
    paddingHorizontal: 14, paddingVertical: 10,
  },
  userBubble: {
    backgroundColor: '#059669',
  },
  adminBubble: {
    backgroundColor: '#151D2B',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  aiBubble: {
    backgroundColor: '#151828',
    borderWidth: 0.5,
    borderColor: 'rgba(129,140,248,0.15)',
  },
  messageText: { fontSize: 15, color: '#E5E7EB', lineHeight: 21 },
  userMessageText: { color: '#fff' },

  // ─── AI Label ───
  aiLabelRow: { flexDirection: 'row', alignItems: 'center' },
  aiLabel: { fontSize: 9, color: '#818CF8', fontWeight: '700', marginLeft: 2 },

  // ─── Meta (time + read) - outside bubble ───
  metaRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 3, marginLeft: 4, marginBottom: 0,
  },
  metaRowUser: { justifyContent: 'flex-end', marginRight: 4, marginLeft: 0 },
  metaTime: { fontSize: 10, color: '#6B7280', fontWeight: '500' },

  // ─── Date Header ───
  dateHeaderContainer: {
    flexDirection: 'row', alignItems: 'center',
    marginVertical: 16, paddingHorizontal: 8,
  },
  dateHeaderLine: { flex: 1, height: 0.5, backgroundColor: 'rgba(255,255,255,0.06)' },
  dateHeaderBadge: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 4,
    marginHorizontal: 10,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)',
  },
  dateHeaderText: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },

  // ─── Typing ───
  typingBubble: { paddingVertical: 14, paddingHorizontal: 20 },
  typingDotsRow: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  typingDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#6B7280',
  },

  // ─── Empty ───
  emptyContainer: {
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, paddingTop: 50,
  },
  emptyIconOuter: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: 'rgba(52,211,153,0.06)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  emptyIconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(52,211,153,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 21 },
  emptyHints: { marginTop: 24, gap: 12, width: '100%' },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hintText: { fontSize: 13, color: '#6B7280' },

  // ─── Quick Prompts ───
  quickPromptsContainer: {
    marginTop: 28, width: '100%',
  },
  quickPromptsTitle: {
    fontSize: 12, color: '#6B7280', fontWeight: '600', marginBottom: 10,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  quickPromptBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: 'rgba(129,140,248,0.06)',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(129,140,248,0.12)',
    marginBottom: 8,
  },
  quickPromptText: {
    fontSize: 13, color: '#D1D5DB', flex: 1, marginRight: 8,
  },

  // ─── Input ───
  inputContainer: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 10, paddingVertical: 8, gap: 6,
    backgroundColor: '#0D1420',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  attachBtn: {
    width: 40, height: 40,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 1 : 0,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 22,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    maxHeight: 120,
  },
  inputWrapperAI: {
    borderColor: 'rgba(129,140,248,0.15)',
  },
  textInput: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15, color: Colors.text, maxHeight: 100,
    lineHeight: 20,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#059669',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 1 : 0,
  },
  sendBtnAI: {
    backgroundColor: '#6366F1',
  },
  sendBtnDisabled: { backgroundColor: '#1F2937' },
});
