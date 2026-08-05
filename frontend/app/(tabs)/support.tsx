/**
 * Client Support Chat - Premium Dark Mode Version
 * Features:
 * - Organized conversations with tickets
 * - Quick action buttons
 * - Typing indicator
 * - Satisfaction survey
 * - FAQ auto-responses
 * - Modern UI with agent photos
 * - Dynamic Dark Mode support
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
  Modal,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import api from '../../services/api';
import { websocketService } from '../../services/websocket';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { 
  registerForPushNotificationsAsync, 
  setupNotificationListeners,
  setBadgeCount 
} from '../../services/notificationService';
import { useRouter } from 'expo-router';
import { AppState } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../constants/colors';

const { width } = Dimensions.get('window');

interface Message {
  message_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  content: string;
  created_at: string;
  is_read: boolean;
  message_type: string;
  file_url?: string;
  file_name?: string;
}

interface QuickAction {
  id: string;
  icon: string;
  label: string;
  action: () => void;
}

// FAQ responses for common questions
const FAQ_RESPONSES: { [key: string]: string } = {
  'horario': '🕐 Nuestro horario de atención es:\n\nLunes a Viernes: 9:00 AM - 6:00 PM\nSábados: 10:00 AM - 2:00 PM\nDomingos: Cerrado\n\nPuedes agendar una cita en cualquier momento desde la app.',
  'precio': '💰 Nuestros precios varían según el servicio:\n\n• Declaración Personal: desde $180\n• Declaración de Negocios: desde $350\n• ITIN: $200\n• LLC: $350\n\nVisita nuestra sección de Servicios para ver todos los precios.',
  'cita': '📅 Para agendar una cita:\n\n1. Ve a la sección "Agendar Cita"\n2. Selecciona el tipo de servicio\n3. Elige fecha y hora\n4. Confirma tu cita\n\n¡Es muy fácil!',
  'documentos': '📄 Los documentos que necesitas dependen del servicio:\n\n• Declaración Personal: W-2, 1099, ID, Social Security\n• ITIN: Pasaporte, Acta de nacimiento\n• LLC: ID del propietario\n\nPuedes subir tus documentos en la sección "Documentos".',
  'estado': '📊 Para ver el estado de tu trámite:\n\n1. Ve a "Mis Trámites" en el menú\n2. Verás todos tus servicios activos\n3. Cada uno muestra su estado actual\n\n¿Necesitas más ayuda?',
};

const ClientSupportChat = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  
  const { user, refreshUser } = useAuth();
  const { incrementUnreadChatMessages, resetUnreadChatMessages } = useNotifications();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [adminTyping, setAdminTyping] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [ticketStatus, setTicketStatus] = useState<'open' | 'resolved' | 'pending'>('open');
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [surveyRating, setSurveyRating] = useState(0);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showHistoryMode, setShowHistoryMode] = useState(false);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingAnimation = useRef(new Animated.Value(0)).current;

  // Smart suggestion chips for common questions
  const suggestions = isEn ? [
    { text: 'How much does a tax return cost?', icon: 'cash-outline' },
    { text: 'What documents do I need?', icon: 'document-text-outline' },
    { text: 'I want to schedule an appointment', icon: 'calendar-outline' },
    { text: 'What are your office hours?', icon: 'time-outline' },
    { text: 'How do I scan my W-2?', icon: 'scan-outline' },
    { text: 'Status of my tax return', icon: 'analytics-outline' },
  ] : [
    { text: 'Cuánto cuesta hacer mi declaración?', icon: 'cash-outline' },
    { text: 'Qué documentos necesito?', icon: 'document-text-outline' },
    { text: 'Quiero agendar una cita', icon: 'calendar-outline' },
    { text: 'Cuál es el horario de atención?', icon: 'time-outline' },
    { text: 'Cómo escaneo mi W-2?', icon: 'scan-outline' },
    { text: 'Estado de mi declaración', icon: 'analytics-outline' },
  ];

  // Business hours
  const businessHours = {
    weekday: { start: 9, end: 18 },
    saturday: { start: 10, end: 14 },
    sunday: null,
  };

  const isWithinBusinessHours = () => {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    
    if (day === 0) return false; // Sunday
    if (day === 6) return hour >= 10 && hour < 14; // Saturday
    return hour >= 9 && hour < 18; // Weekday
  };

  // Typing animation
  useEffect(() => {
    if (adminTyping) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(typingAnimation, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(typingAnimation, { toValue: 0, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      typingAnimation.setValue(0);
    }
  }, [adminTyping]);

  // Setup notifications and app state listener
  useEffect(() => {
    registerForPushNotificationsAsync();

    const cleanup = setupNotificationListeners(
      (notification) => {
        if (notification.request.content.data?.type === 'chat_message') {
          loadMessages(false);
        }
      },
      (response) => {
        if (response.notification.request.content.data?.type === 'chat_message') {
          router.push('/(tabs)/support');
        }
      }
    );

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      setIsScreenFocused(nextAppState === 'active');
      if (nextAppState === 'active') {
        setBadgeCount(0);
        resetUnreadChatMessages();
      }
    });

    return () => {
      cleanup();
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    resetUnreadChatMessages();
  }, []);

  // Re-initialize chat when user ID becomes available (e.g. after refresh)
  const userId = user?.id || (user as any)?._id;
  
  useEffect(() => {
    if (!userId) return; // Wait until we have a valid user ID
    
    initializeChat();
    
    const connectWebSocket = async () => {
      const connected = await websocketService.connect();
      if (connected) {
        console.log('✅ WebSocket connected for chat');
      }
    };
    connectWebSocket();
    
    const unsubscribeNewMessage = websocketService.onMessage('new_message', (data) => {
      if (data.conversation_id === conversationId) {
        setMessages(prev => {
          if (prev.some(m => m.message_id === data.message.message_id)) {
            return prev;
          }
          return [...prev, data.message];
        });
        scrollToBottom();
        setAdminTyping(false);
      }
    });
    
    const unsubscribeTyping = websocketService.onMessage('typing', (data) => {
      if (data.conversation_id === conversationId && data.user_id !== userId) {
        setAdminTyping(data.is_typing);
      }
    });
    
    const interval = setInterval(() => {
      if (!websocketService.isConnected()) {
        loadMessages(false);
      }
    }, 15000);
    
    return () => {
      clearInterval(interval);
      unsubscribeNewMessage();
      unsubscribeTyping();
      if (conversationId) {
        websocketService.unsubscribeFromConversation(conversationId);
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [conversationId, userId]);

  const initializeChat = async () => {
    try {
      if (!user) {
        Alert.alert(t('common.error', 'Error'), t('supportChat.authError', 'Usuario no autenticado.'));
        setLoading(false);
        return;
      }

      let clientId = user.id || (user as any)._id;
      
      // If no ID found, try refreshing user data from the server
      if (!clientId) {
        console.log('⚠️ Chat: User ID missing, refreshing user data...');
        try {
          await refreshUser();
          setLoading(false);
          return;
        } catch (refreshError) {
          console.error('❌ Chat: Failed to refresh user:', refreshError);
          Alert.alert(t('common.error', 'Error'), t('supportChat.sessionError', 'Error con la sesión del usuario. Por favor cierra sesión e inicia de nuevo.'));
          setLoading(false);
          return;
        }
      }

      const convResponse = await api.post('/chat/conversations', {
        client_id: clientId,
        initial_message: null,
      });
      
      const newConversationId = convResponse.data.conversation_id;
      setConversationId(newConversationId);
      websocketService.subscribeToConversation(newConversationId);
      await loadMessages(true);
      
      // Send welcome message if no messages
      if (messages.length === 0) {
        setTimeout(() => {
          const userName = (user as any).first_name || user.name?.split(' ')[0] || 'amigo';
          const welcomeMessage: Message = {
            message_id: 'welcome',
            sender_id: 'ai_assistant',
            sender_name: 'Ross AI',
            sender_role: 'admin',
            content: isEn 
              ? `Hi ${userName}! I'm Ross AI, your intelligent virtual assistant. I can help you with:\n\n• Questions about services and pricing\n• Document requirements\n• Scheduling appointments\n• Tax return status\n• And much more\n\nHow can I help you today?`
              : `¡Hola ${userName}! Soy Ross AI, tu asistente virtual inteligente. Puedo ayudarte con:\n\n• Preguntas sobre servicios y precios\n• Información de documentos necesarios\n• Agendar citas\n• Estado de tu declaración\n• Y mucho más\n\n¿En qué puedo ayudarte hoy?`,
            created_at: new Date().toISOString(),
            is_read: true,
            message_type: 'text',
          };
          setMessages(prev => prev.length === 0 ? [welcomeMessage] : prev);
        }, 500);
      }
    } catch (error: any) {
      console.error('Error initializing chat:', error);
      Alert.alert(t('common.error', 'Error'), t('supportChat.connectionError', 'No se pudo conectar al chat. Verifica tu conexión.'));
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (showLoading = true) => {
    if (!conversationId) return;
    
    try {
      if (showLoading) setLoading(true);
      
      const response = await api.get(`/chat/conversations/${conversationId}/messages`);
      const allMsgs = response.data.messages || [];
      setAllMessages(allMsgs);
      
      // Filter to show only TODAY's messages unless history mode is on
      if (showHistoryMode) {
        setMessages(allMsgs);
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayMessages = allMsgs.filter((m: Message) => {
          const msgDate = new Date(m.created_at);
          return msgDate >= today;
        });
        setMessages(todayMessages);
        
        // Show quick actions and suggestions if today is a fresh start
        if (todayMessages.length <= 1) {
          setShowQuickActions(true);
          setShowSuggestions(true);
        }
      }
      
      scrollToBottom();
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleHistoryMode = () => {
    const newMode = !showHistoryMode;
    setShowHistoryMode(newMode);
    if (newMode) {
      setMessages(allMessages);
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayMessages = allMessages.filter((m: Message) => {
        const msgDate = new Date(m.created_at);
        return msgDate >= today;
      });
      setMessages(todayMessages);
    }
    scrollToBottom();
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // Check for FAQ keywords
  const checkForFAQ = (text: string): string | null => {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('horario') || lowerText.includes('hora') || lowerText.includes('abierto')) {
      return FAQ_RESPONSES['horario'];
    }
    if (lowerText.includes('precio') || lowerText.includes('costo') || lowerText.includes('cuanto')) {
      return FAQ_RESPONSES['precio'];
    }
    if (lowerText.includes('cita') || lowerText.includes('agendar') || lowerText.includes('reservar')) {
      return FAQ_RESPONSES['cita'];
    }
    if (lowerText.includes('documento') || lowerText.includes('necesito') || lowerText.includes('requisito')) {
      return FAQ_RESPONSES['documentos'];
    }
    if (lowerText.includes('estado') || lowerText.includes('tramite') || lowerText.includes('proceso')) {
      return FAQ_RESPONSES['estado'];
    }
    
    return null;
  };

  const sendMessage = async (text?: string, fileData?: any) => {
    const textToSend = text || messageText.trim();
    if (!textToSend && !fileData) return;
    if (!conversationId || !user) return;

    const clientId = user.id || (user as any)._id;
    if (!clientId) return;

    setSending(true);
    if (!fileData) setMessageText('');
    Keyboard.dismiss();
    setShowQuickActions(false);
    setShowSuggestions(false);

    try {
      const payload: any = {
        conversation_id: conversationId,
        sender_id: clientId,
        content: textToSend,
        message_type: fileData ? 'file' : 'text',
        language: i18n.language,
      };

      if (fileData) {
        payload.file_url = fileData.uri;
        payload.file_name = fileData.name;
        payload.file_size = fileData.size;
      }

      await api.post('/chat/messages', payload);
      
      if (!fileData) {
        setAiThinking(true);
        scrollToBottom();
      }
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      await loadMessages(false);
      setAiThinking(false);
    } catch (error: any) {
      console.error('Error sending message:', error);
      Alert.alert('Error', error.response?.data?.detail || t('support.couldNotSend'));
      if (!fileData) setMessageText(textToSend);
    } finally {
      setSending(false);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0];
        await sendMessage(`📄 ${file.name}`, {
          uri: file.uri,
          name: file.name,
          size: file.size,
        });
      }
    } catch (error) {
      console.error('Error picking document:', error);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
      });

      if (!result.canceled && result.assets[0]) {
        const image = result.assets[0];
        await sendMessage('📷 Imagen', {
          uri: image.uri,
          name: 'image.jpg',
          size: 0,
        });
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  };

  const showAttachmentOptions = () => {
    Alert.alert(
      isEn ? '📎 Attach' : '📎 Adjuntar',
      isEn ? 'Select file type' : 'Selecciona el tipo de archivo',
      [
        { text: isEn ? '📷 Photo' : '📷 Foto', onPress: pickImage },
        { text: isEn ? '📄 Document' : '📄 Documento', onPress: pickDocument },
        { text: isEn ? 'Cancel' : 'Cancelar', style: 'cancel' },
      ]
    );
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'appointment':
        router.push('/(tabs)/appointments');
        break;
      case 'documents':
        router.push('/(tabs)/documents');
        break;
      case 'services':
        router.push('/(tabs)/services');
        break;
      case 'status':
        sendMessage(isEn ? 'What is the status of my case?' : '¿Cuál es el estado de mi trámite?');
        break;
    }
  };

  const quickActions: QuickAction[] = [
    { id: 'appointment', icon: 'calendar', label: t('supportChat.scheduleAppt', 'Agendar Cita'), action: () => handleQuickAction('appointment') },
    { id: 'documents', icon: 'document-text', label: t('supportChat.myDocs', 'Mis Documentos'), action: () => handleQuickAction('documents') },
    { id: 'services', icon: 'briefcase', label: t('supportChat.viewServices', 'Ver Servicios'), action: () => handleQuickAction('services') },
    { id: 'status', icon: 'help-circle', label: t('supportChat.checkStatus', 'Estado Trámite'), action: () => handleQuickAction('status') },
  ];

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString(isEn ? 'en-US' : 'es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const formatMessageDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) return isEn ? 'Today' : 'Hoy';
    if (date.toDateString() === yesterday.toDateString()) return isEn ? 'Yesterday' : 'Ayer';
    return date.toLocaleDateString(isEn ? 'en-US' : 'es-ES', { day: 'numeric', month: 'short' });
  };

  const submitSurvey = async () => {
    try {
      await api.post('/chat/survey', {
        conversation_id: conversationId,
        rating: surveyRating,
      });
      Alert.alert(t('supportChat.thanks', '¡Gracias!'), t('supportChat.surveyThanks', 'Tu opinión nos ayuda a mejorar.'));
      setShowSurveyModal(false);
    } catch (error) {
      console.error('Error submitting survey:', error);
    }
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isClient = item.sender_role === 'client';
    const showDate = index === 0 || 
      formatMessageDate(item.created_at) !== formatMessageDate(messages[index - 1]?.created_at);
    
    // Check if it's an image message
    const isImage = item.message_type === 'image' || 
      (item.file_url && (item.file_url.includes('.jpg') || item.file_url.includes('.png') || item.file_url.includes('.jpeg')));
    
    return (
      <>
        {showDate && (
          <View style={styles.dateContainer}>
            <View style={styles.datePill}>
              <Text style={styles.dateText}>{formatMessageDate(item.created_at)}</Text>
            </View>
          </View>
        )}
        <View style={[styles.messageRow, isClient ? styles.messageRowRight : styles.messageRowLeft]}>
          {!isClient && (
            <View style={styles.avatarWrapper}>
              <LinearGradient
                colors={['#10b981', '#047857']}
                style={styles.avatarModern}
              >
                <Ionicons name="headset" size={16} color="#fff" />
              </LinearGradient>
            </View>
          )}
          <View style={[
            styles.bubbleWrapper,
            isClient ? styles.bubbleWrapperRight : styles.bubbleWrapperLeft
          ]}>
            <View style={[
              styles.bubbleModern,
              isClient ? styles.bubbleClient : styles.bubbleSupport,
            ]}>
              {!isClient && (
                <Text style={styles.agentName}>Ross AI</Text>
              )}
              {isImage && item.file_url ? (
                <View style={styles.imageMessageContainer}>
                  <Ionicons name="image" size={20} color={isClient ? "rgba(255,255,255,0.8)" : colors.textMuted} />
                  <Text style={[styles.imageMessageText, isClient && { color: 'rgba(255,255,255,0.9)' }]}>
                    {isEn ? 'Image' : 'Imagen'}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.bubbleText, isClient ? styles.textClient : styles.textSupport]}>
                  {item.content}
                </Text>
              )}
              <View style={styles.bubbleFooter}>
                <Text style={[styles.timeText, isClient && styles.timeTextClient]}>
                  {formatMessageTime(item.created_at)}
                </Text>
                {isClient && (
                  <View style={styles.readStatus}>
                    <Ionicons 
                      name={item.is_read ? "checkmark-done" : "checkmark"} 
                      size={14} 
                      color={item.is_read ? "#86EFAC" : "rgba(255,255,255,0.6)"} 
                    />
                  </View>
                )}
              </View>
            </View>
            {/* Bubble tail */}
            <View style={[
              styles.bubbleTail,
              isClient ? styles.tailRight : styles.tailLeft
            ]} />
          </View>
        </View>
      </>
    );
  };

  const renderTypingIndicator = () => {
    if (!adminTyping) return null;
    
    return (
      <View style={[styles.messageContainer, styles.messageLeft]}>
        <View style={styles.avatarContainer}>
          <LinearGradient colors={['#10b981', '#059669']} style={styles.avatar}>
            <Text style={styles.avatarText}>RT</Text>
          </LinearGradient>
        </View>
        <View style={[styles.messageBubble, styles.messageBubbleAdmin, styles.typingBubble]}>
          <View style={styles.typingDots}>
            <Animated.View style={[styles.typingDot, { opacity: typingAnimation }]} />
            <Animated.View style={[styles.typingDot, { opacity: typingAnimation }]} />
            <Animated.View style={[styles.typingDot, { opacity: typingAnimation }]} />
          </View>
        </View>
      </View>
    );
  };

  const renderQuickActions = () => {
    return (
      <View style={styles.quickActionsBar}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickActionsBarContent}
        >
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={styles.quickActionChip}
              onPress={action.action}
              activeOpacity={0.7}
            >
              <Ionicons name={action.icon as any} size={16} color={colors.primary} />
              <Text style={styles.quickActionChipLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderSuggestionChips = () => {
    const todayMsgCount = messages.filter(m => m.message_id !== 'welcome').length;
    if (todayMsgCount > 4 || !showSuggestions) return null;
    
    return (
      <View style={styles.suggestionsContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.suggestionsScroll}
        >
          {suggestions.map((suggestion, index) => (
            <TouchableOpacity
              key={index}
              style={styles.suggestionChip}
              onPress={() => sendMessage(suggestion.text)}
              activeOpacity={0.7}
            >
              <Ionicons name={suggestion.icon as any} size={14} color={colors.primary} />
              <Text style={styles.suggestionText}>{suggestion.text}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderAiThinking = () => {
    if (!aiThinking) return null;
    
    return (
      <View style={[styles.messageRow, styles.messageRowLeft]}>
        <View style={styles.avatarWrapper}>
          <LinearGradient
            colors={['#10b981', '#047857']}
            style={styles.avatarModern}
          >
            <Ionicons name="sparkles" size={14} color="#fff" />
          </LinearGradient>
        </View>
        <View style={styles.bubbleWrapperLeft}>
          <View style={[styles.bubbleModern, styles.bubbleSupport, { paddingVertical: 14 }]}>
            <Text style={styles.agentName}>Ross AI</Text>
            <View style={styles.aiThinkingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.aiThinkingText}>{isEn ? 'Thinking...' : 'Pensando...'}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  // Survey Modal
  const renderSurveyModal = () => (
    <Modal visible={showSurveyModal} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.surveyModal}>
          <Text style={styles.surveyTitle}>{isEn ? '⭐ How was your experience?' : '⭐ ¿Cómo fue tu experiencia?'}</Text>
          <Text style={styles.surveySubtitle}>{t('supportChat.surveySubtitle', 'Tu opinión nos ayuda a mejorar')}</Text>
          
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setSurveyRating(star)}>
                <Ionicons
                  name={star <= surveyRating ? "star" : "star-outline"}
                  size={40}
                  color={star <= surveyRating ? "#f59e0b" : colors.textMuted}
                />
              </TouchableOpacity>
            ))}
          </View>
          
          <View style={styles.surveyButtons}>
            <TouchableOpacity
              style={[styles.surveyButton, styles.surveyButtonCancel]}
              onPress={() => setShowSurveyModal(false)}
            >
              <Text style={styles.surveyButtonCancelText}>{t('supportChat.notNow', 'Ahora no')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.surveyButton, styles.surveyButtonSubmit]}
              onPress={submitSurvey}
              disabled={surveyRating === 0}
            >
              <Text style={styles.surveyButtonSubmitText}>{t('supportChat.send', 'Enviar')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (loading && messages.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>{isEn ? 'Connecting to support...' : 'Conectando al soporte...'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#10b981', '#059669']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerInfo}>
              <View style={styles.headerAvatar}>
                <Ionicons name="sparkles" size={20} color="#fff" />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerTitle}>Ross AI</Text>
                <View style={styles.statusContainer}>
                  <View style={[styles.statusDot, styles.statusOnline]} />
                  <Text style={styles.statusText}>
                    {aiThinking 
                      ? (isEn ? 'Thinking...' : 'Pensando...') 
                      : isWithinBusinessHours() 
                        ? (isEn ? 'Always online' : 'Siempre en línea') 
                        : (isEn ? 'Available 24/7' : 'Disponible 24/7')}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.headerActions}>
              {allMessages.length > messages.length && !showHistoryMode && (
                <TouchableOpacity onPress={toggleHistoryMode} style={styles.headerAction}>
                  <Ionicons name="time-outline" size={22} color="#fff" />
                </TouchableOpacity>
              )}
              {showHistoryMode && (
                <TouchableOpacity onPress={toggleHistoryMode} style={[styles.headerAction, { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12 }]}>
                  <Ionicons name="today-outline" size={22} color="#fff" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setShowSurveyModal(true)} style={styles.headerAction}>
                <Ionicons name="star-outline" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Business Hours Banner */}
      {!isWithinBusinessHours() && (
        <View style={styles.offlineBanner}>
          <Ionicons name="time-outline" size={18} color={colors.warning} />
          <Text style={styles.offlineBannerText}>
            {isEn ? 'Hours: Mon-Fri 9AM-6PM, Sat 10AM-2PM' : 'Horario: Lun-Vie 9AM-6PM, Sáb 10AM-2PM'}
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.chatContainer}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.message_id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={() => (
            <>
              {renderTypingIndicator()}
              {renderAiThinking()}
            </>
          )}
          onContentSizeChange={scrollToBottom}
        />

        {/* Suggestion Chips */}
        {renderSuggestionChips()}

        {/* Quick Actions */}
        {renderQuickActions()}

        {/* Input Area */}
        <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <TouchableOpacity onPress={showAttachmentOptions} style={styles.attachButton}>
            <Ionicons name="add-circle" size={28} color={colors.primary} />
          </TouchableOpacity>
          
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              placeholder={isEn ? 'Write a message...' : 'Escribe un mensaje...'}
              placeholderTextColor={colors.textMuted}
              value={messageText}
              onChangeText={setMessageText}
              multiline
              maxLength={1000}
            />
          </View>
          
          <TouchableOpacity
            onPress={() => sendMessage()}
            disabled={!messageText.trim() || sending}
            style={[styles.sendButton, (!messageText.trim() || sending) && styles.sendButtonDisabled]}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {renderSurveyModal()}
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary,
  },
  header: {
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  backButton: {
    padding: 4,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  headerTextContainer: {
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusOnline: {
    backgroundColor: '#34d399',
  },
  statusOffline: {
    backgroundColor: '#fbbf24',
  },
  statusText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
  },
  headerAction: {
    padding: 8,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warningLight,
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  offlineBannerText: {
    fontSize: 13,
    color: colors.warning,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dateContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  datePill: {
    backgroundColor: colors.cardBackground,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  messageRowLeft: {
    justifyContent: 'flex-start',
  },
  messageRowRight: {
    justifyContent: 'flex-end',
  },
  avatarWrapper: {
    marginRight: 6,
    marginTop: 2,
  },
  avatarModern: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubbleWrapper: {
    maxWidth: '78%',
    position: 'relative',
  },
  bubbleWrapperLeft: {
    marginLeft: 0,
  },
  bubbleWrapperRight: {
    marginRight: 0,
  },
  bubbleModern: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 80,
  },
  bubbleSupport: {
    backgroundColor: colors.cardBackground,
    borderTopLeftRadius: 4,
  },
  bubbleClient: {
    backgroundColor: '#DCF8C6',
    borderTopRightRadius: 4,
  },
  bubbleTail: {
    position: 'absolute',
    width: 0,
    height: 0,
    top: 0,
  },
  tailLeft: {
    left: -6,
    borderTopWidth: 8,
    borderRightWidth: 8,
    borderTopColor: colors.cardBackground,
    borderRightColor: 'transparent',
  },
  tailRight: {
    right: -6,
    borderTopWidth: 8,
    borderLeftWidth: 8,
    borderTopColor: '#DCF8C6',
    borderLeftColor: 'transparent',
  },
  agentName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 3,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 20,
  },
  textSupport: {
    color: colors.text,
  },
  textClient: {
    color: '#303030',
  },
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  timeText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  timeTextClient: {
    color: '#6B8A6E',
  },
  readStatus: {
    marginLeft: 2,
  },
  imageMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  imageMessageText: {
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  // Legacy styles kept for compatibility
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    maxWidth: '85%',
  },
  messageLeft: {
    alignSelf: 'flex-start',
  },
  messageRight: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  avatarContainer: {
    marginRight: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  messageBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    maxWidth: '100%',
  },
  messageBubbleAdmin: {
    backgroundColor: colors.cardBackground,
    borderTopLeftRadius: 4,
  },
  messageBubbleClient: {
    backgroundColor: colors.primary,
    borderTopRightRadius: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  messageTextAdmin: {
    color: colors.text,
  },
  messageTextClient: {
    color: '#fff',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
    color: colors.textMuted,
  },
  messageTimeClient: {
    color: 'rgba(255,255,255,0.8)',
  },
  typingBubble: {
    paddingVertical: 14,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textMuted,
  },
  quickActionsContainer: {
    backgroundColor: colors.cardBackground,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  quickActionsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 10,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.success + '40',
    gap: 6,
  },
  quickActionLabel: {
    fontSize: 13,
    color: colors.success,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 12,
    backgroundColor: colors.cardBackground,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  attachButton: {
    padding: 4,
    marginRight: 4,
    marginBottom: 6,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 100,
  },
  textInput: {
    fontSize: 15,
    color: colors.text,
    maxHeight: 80,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  sendButtonDisabled: {
    backgroundColor: colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  surveyModal: {
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    alignItems: 'center',
  },
  surveyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  surveySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  surveyButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  surveyButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  surveyButtonCancel: {
    backgroundColor: colors.backgroundGray,
  },
  surveyButtonCancelText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  surveyButtonSubmit: {
    backgroundColor: colors.primary,
  },
  surveyButtonSubmitText: {
    color: '#fff',
    fontWeight: '600',
  },
  // AI Chatbot styles
  suggestionsContainer: {
    paddingVertical: 6,
    backgroundColor: colors.cardBackground,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  suggestionsScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.successLight,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.success + '40',
  },
  suggestionText: {
    fontSize: 12,
    color: colors.success,
    fontWeight: '500',
  },
  aiThinkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
  },
  aiThinkingText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  // Quick Actions Bar (always visible above input)
  quickActionsBar: {
    backgroundColor: colors.cardBackground,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 8,
  },
  quickActionsBarContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  quickActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.successLight,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.success + '40',
  },
  quickActionChipLabel: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  // Header actions row
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});

export default ClientSupportChat;
