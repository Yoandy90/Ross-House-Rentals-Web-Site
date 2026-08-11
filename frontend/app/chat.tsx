import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { apiCall } from '../src/utils/api';
import { useAuth } from '../src/contexts/AuthContext';
import { Spacing, FontSizes, BorderRadius, Shadows, useColors } from '../src/constants/theme';

interface Message {
  _id: string;
  conversation_id: string;
  sender_type: 'tenant' | 'admin' | 'ai';
  sender_name: string;
  message_type: 'text' | 'image' | 'file';
  content: string;
  file_name?: string;
  read: boolean;
  created_at: string;
}

export default function ChatScreen() {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const lang = i18n.language;
  const flatListRef = useRef<FlatList>(null);
  const role = user?.role || 'tenant';

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [aiEnabled, setAiEnabled] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Quick Actions by Role ──
  const QUICK_ACTIONS: Record<string, { icon: string; label_es: string; label_en: string; message_es: string; message_en: string; color: string }[]> = {
    tenant: [
      { icon: 'card-outline', label_es: 'Mi pago', label_en: 'My payment', message_es: 'Hola, ¿cuándo es mi próximo pago de renta y cuánto debo?', message_en: 'Hi, when is my next rent payment and how much do I owe?', color: C.brandRed },
      { icon: 'construct-outline', label_es: 'Mantenimiento', label_en: 'Maintenance', message_es: 'Necesito reportar un problema de mantenimiento en mi propiedad.', message_en: 'I need to report a maintenance issue at my property.', color: C.warning },
      { icon: 'document-text-outline', label_es: 'Mi contrato', label_en: 'My lease', message_es: 'Tengo una pregunta sobre mi contrato de arrendamiento.', message_en: 'I have a question about my lease agreement.', color: C.info },
      { icon: 'receipt-outline', label_es: 'Recibo de pago', label_en: 'Payment receipt', message_es: 'Necesito un recibo de mi último pago de renta, por favor.', message_en: 'I need a receipt for my last rent payment, please.', color: C.success },
      { icon: 'home-outline', label_es: 'Mudanza', label_en: 'Move out', message_es: '¿Cuál es el proceso para dar aviso de desocupación?', message_en: 'What is the process to give a move-out notice?', color: C.violet },
      { icon: 'help-circle-outline', label_es: 'Pregunta general', label_en: 'General question', message_es: 'Hola, tengo una consulta general sobre mi alquiler.', message_en: 'Hi, I have a general question about my rental.', color: C.warmGold },
    ],
    landlord: [
      { icon: 'stats-chart-outline', label_es: 'Mis ingresos', label_en: 'My income', message_es: '¿Cuál es el resumen de ingresos de mis propiedades este mes?', message_en: 'What is the income summary for my properties this month?', color: C.success },
      { icon: 'business-outline', label_es: 'Mis propiedades', label_en: 'My properties', message_es: 'Necesito una actualización sobre el estado de mis propiedades.', message_en: 'I need an update on the status of my properties.', color: C.info },
      { icon: 'people-outline', label_es: 'Mis inquilinos', label_en: 'My tenants', message_es: '¿Tienen algún reporte de mis inquilinos actuales?', message_en: 'Do you have any reports from my current tenants?', color: C.violet },
      { icon: 'construct-outline', label_es: 'Mantenimiento', label_en: 'Maintenance', message_es: 'Necesito solicitar mantenimiento en una de mis propiedades.', message_en: 'I need to request maintenance on one of my properties.', color: C.warning },
      { icon: 'document-text-outline', label_es: 'Contratos', label_en: 'Contracts', message_es: 'Necesito ayuda con la renovación de un contrato de arrendamiento.', message_en: 'I need help renewing a lease agreement.', color: C.brandRed },
      { icon: 'wallet-outline', label_es: 'Pagos pendientes', label_en: 'Pending payments', message_es: '¿Hay algún pago de renta pendiente de mis inquilinos?', message_en: 'Are there any pending rent payments from my tenants?', color: C.warmGold },
    ],
    admin: [
      { icon: 'shield-checkmark-outline', label_es: 'Bienvenida', label_en: 'Welcome', message_es: '¡Hola! Bienvenido a Ross House Rentals. ¿En qué puedo ayudarle hoy?', message_en: 'Hello! Welcome to Ross House Rentals. How can I help you today?', color: C.brandRed },
      { icon: 'checkmark-circle-outline', label_es: 'Recibido', label_en: 'Received', message_es: 'Su solicitud ha sido recibida. La estamos procesando y le responderemos pronto.', message_en: 'Your request has been received. We are processing it and will respond soon.', color: C.success },
      { icon: 'time-outline', label_es: 'En proceso', label_en: 'Processing', message_es: 'Estamos trabajando en su solicitud. Le notificaremos cuando tengamos una actualización.', message_en: 'We are working on your request. We will notify you when we have an update.', color: C.info },
      { icon: 'calendar-outline', label_es: 'Agendar visita', label_en: 'Schedule visit', message_es: '¿Le gustaría agendar una visita a la propiedad? Tenemos disponibilidad esta semana.', message_en: 'Would you like to schedule a property visit? We have availability this week.', color: C.violet },
      { icon: 'card-outline', label_es: 'Pago confirmado', label_en: 'Payment confirmed', message_es: 'Confirmamos que su pago ha sido recibido exitosamente. Gracias.', message_en: 'We confirm your payment has been received successfully. Thank you.', color: C.success },
      { icon: 'alert-circle-outline', label_es: 'Recordatorio', label_en: 'Reminder', message_es: 'Le recordamos que su pago de renta vence en los próximos días. Por favor, asegúrese de realizarlo a tiempo.', message_en: 'We remind you that your rent payment is due in the coming days. Please make sure to pay on time.', color: C.warning },
    ],
    buyer: [
      { icon: 'search-outline', label_es: 'Buscar propiedad', label_en: 'Find property', message_es: 'Estoy buscando una propiedad para alquilar. ¿Qué opciones tienen disponibles?', message_en: 'I am looking for a property to rent. What options do you have available?', color: C.info },
      { icon: 'location-outline', label_es: 'Ubicación', label_en: 'Location', message_es: '¿Tienen propiedades disponibles en mi zona?', message_en: 'Do you have properties available in my area?', color: C.brandRed },
      { icon: 'calendar-outline', label_es: 'Agendar visita', label_en: 'Schedule visit', message_es: 'Me gustaría agendar una visita para ver una propiedad.', message_en: 'I would like to schedule a visit to see a property.', color: C.violet },
      { icon: 'cash-outline', label_es: 'Precios', label_en: 'Pricing', message_es: '¿Cuáles son los precios de renta mensuales disponibles?', message_en: 'What are the available monthly rent prices?', color: C.warmGold },
      { icon: 'document-outline', label_es: 'Requisitos', label_en: 'Requirements', message_es: '¿Cuáles son los requisitos para aplicar a una propiedad?', message_en: 'What are the requirements to apply for a property?', color: C.success },
      { icon: 'help-circle-outline', label_es: 'Pregunta', label_en: 'Question', message_es: 'Hola, tengo una consulta sobre el proceso de alquiler.', message_en: 'Hi, I have a question about the rental process.', color: C.warning },
    ],
  };

  const quickActions = QUICK_ACTIONS[role] || QUICK_ACTIONS.tenant;

  // Fetch messages
  const fetchMessages = useCallback(async (silent = false) => {
    try {
      // Ensure conversation exists
      await apiCall('/chat/conversation');
      const data = await apiCall('/chat/messages?limit=50');
      if (data.success) {
        setMessages(data.messages || []);
      }
    } catch (err) {
      if (!silent) console.log('Chat fetch error:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
    // Poll for new messages every 4 seconds
    pollRef.current = setInterval(() => fetchMessages(true), 4000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const handleAIAction = async (action: {
    type: string;
    label: string;
    payload?: { route?: string; endpoint?: string; filename_hint?: string };
  }) => {
    try {
      if (action.type === 'open_screen' && action.payload?.route) {
        router.push(action.payload.route as any);
        return;
      }
      if (action.type === 'download_pdf' && action.payload?.endpoint) {
        // Strip /api prefix if apiCall adds it
        const endpoint = action.payload.endpoint.replace(/^\/api/, '');
        const res = await apiCall(endpoint);
        if (!res?.success || !res?.pdf_base64) {
          Alert.alert('Error', res?.detail || 'No se pudo generar el PDF');
          return;
        }
        const filename = res.filename || action.payload.filename_hint || 'recibo.pdf';
        if (Platform.OS === 'web') {
          const dataUrl = `data:application/pdf;base64,${res.pdf_base64}`;
          if (typeof window !== 'undefined') window.open(dataUrl, '_blank');
        } else {
          const fileUri = `${FileSystem.cacheDirectory}${filename}`;
          await FileSystem.writeAsStringAsync(fileUri, res.pdf_base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
              mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: filename,
            });
          }
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'No se pudo procesar la acción');
    }
  };

  const sendMessage = async (content: string, type: 'text' | 'image' | 'file' = 'text', fileName?: string) => {
    if (!content.trim() && type === 'text') return;
    setSending(true);
    try {
      const body: any = {
        content: content.trim(),
        message_type: type,
      };
      if (fileName) body.file_name = fileName;

      const result = await apiCall('/chat/send', { method: 'POST', body });
      if (result.success) {
        // Add user message
        setMessages(prev => [...prev, result.message]);
        setInputText('');
        setShowAttach(false);
        
        // If AI responded, add the AI message after a small delay for better UX
        if (result.ai_response) {
          setTimeout(() => {
            setMessages(prev => [...prev, result.ai_response]);
          }, 500);
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSending(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Error', lang === 'es' ? 'Se necesita permiso para acceder a fotos' : 'Photo permission required');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const base64 = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
      sendMessage(base64, 'image', 'foto.jpg');
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Error', lang === 'es' ? 'Se necesita permiso de cámara' : 'Camera permission required');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.6,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const base64 = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
      sendMessage(base64, 'image', 'foto.jpg');
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const doc = result.assets[0];
        sendMessage(doc.uri, 'file', doc.name);
      }
    } catch (err) {
      console.log('Document pick error:', err);
    }
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString(lang === 'es' ? 'es' : 'en', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const formatDateSeparator = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      if (days === 0) return lang === 'es' ? 'Hoy' : 'Today';
      if (days === 1) return lang === 'es' ? 'Ayer' : 'Yesterday';
      return date.toLocaleDateString(lang === 'es' ? 'es' : 'en', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const shouldShowDate = (index: number): boolean => {
    if (index === 0) return true;
    const current = new Date(messages[index].created_at).toDateString();
    const prev = new Date(messages[index - 1].created_at).toDateString();
    return current !== prev;
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.sender_type === 'tenant';
    const isAI = item.sender_type === 'ai';
    const showDate = shouldShowDate(index);

    return (
      <View>
        {showDate && (
          <View style={styles.dateSeparator}>
            <View style={styles.dateLine} />
            <Text style={styles.dateText}>{formatDateSeparator(item.created_at)}</Text>
            <View style={styles.dateLine} />
          </View>
        )}
        <View style={[styles.messageRow, isMe && styles.messageRowMe]}>
          {!isMe && (
            <View style={[styles.adminAvatar, isAI && styles.aiAvatar]}>
              <Ionicons 
                name={isAI ? "sparkles" : "shield-checkmark"} 
                size={14} 
                color={C.white} 
              />
            </View>
          )}
          <View style={[styles.bubble, isMe ? styles.bubbleMe : (isAI ? styles.bubbleAI : styles.bubbleAdmin)]}>
            {!isMe && (
              <Text style={[styles.senderName, isAI && styles.senderNameAI]}>
                {isAI ? '🤖 Ross AI' : 'Ross House'}
              </Text>
            )}

            {item.message_type === 'image' ? (
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: item.content }}
                  style={styles.chatImage}
                  resizeMode="cover"
                />
              </View>
            ) : item.message_type === 'file' ? (
              <View style={styles.fileContainer}>
                <Ionicons name="document-attach" size={20} color={isMe ? C.white : C.brandRed} />
                <Text style={[styles.fileName, isMe && { color: 'rgba(255,255,255,0.9)' }]}>
                  {item.file_name || 'Archivo'}
                </Text>
              </View>
            ) : (
              <Text style={[styles.messageText, isMe && styles.messageTextMe]}>
                {item.content}
              </Text>
            )}

            {/* AI Action Chips — appear below AI text messages when the
                backend attached contextual actions (download PDF, open
                screen, etc.) */}
            {isAI && Array.isArray((item as any).actions) && (item as any).actions.length > 0 && (
              <View style={styles.actionsRow}>
                {((item as any).actions as Array<{
                  type: string; label: string;
                  payload?: { route?: string; endpoint?: string; filename_hint?: string };
                  style?: string;
                }>).map((act, idx) => (
                  <TouchableOpacity
                    key={`act-${idx}`}
                    style={[styles.actionChip, act.style === 'primary' && styles.actionChipPrimary]}
                    onPress={() => handleAIAction(act)}
                    activeOpacity={0.75}
                    testID={`ai-action-${idx}`}
                  >
                    <Text style={[styles.actionChipText, act.style === 'primary' && styles.actionChipTextPrimary]}>
                      {act.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.timeRow}>
              <Text style={[styles.timeText, isMe && styles.timeTextMe]}>
                {formatTime(item.created_at)}
              </Text>
              {isMe && (
                <Ionicons
                  name={item.read ? 'checkmark-done' : 'checkmark'}
                  size={14}
                  color={item.read ? '#60A5FA' : 'rgba(255,255,255,0.5)'}
                  style={{ marginLeft: 4 }}
                />
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={C.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.headerAvatar}>
            <LinearGradient
              colors={['#E11D48', '#9B1B30']}
              style={styles.headerAvatarGrad}
            >
              <Ionicons name="shield-checkmark" size={18} color={C.white} />
            </LinearGradient>
          </View>
          <View>
            <Text style={styles.headerTitle}>Ross House Rentals</Text>
            <View style={styles.onlineRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>
                {lang === 'es' ? 'Soporte activo' : 'Active support'}
              </Text>
            </View>
          </View>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {/* Header glow */}
      <LinearGradient
        colors={['rgba(200,16,46,0.06)', 'transparent']}
        style={styles.headerGlow}
      />

      {/* Messages */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={C.brandRed} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item._id}
          renderItem={renderMessage}
          contentContainerStyle={[
            styles.messagesList,
            messages.length === 0 && styles.emptyList,
          ]}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="chatbubbles-outline" size={48} color={C.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>
                {lang === 'es' ? '¡Hola! ¿En qué podemos ayudarte?' : 'Hi! How can we help?'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {lang === 'es'
                  ? 'Selecciona una opción rápida o escribe tu mensaje'
                  : 'Select a quick option or type your message'}
              </Text>
              {/* Quick Action Cards */}
              <View style={styles.quickActionsGrid}>
                {quickActions.map((action, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.quickActionCard}
                    onPress={() => {
                      const msg = lang === 'es' ? action.message_es : action.message_en;
                      sendMessage(msg, 'text');
                      setShowQuickActions(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.quickActionIcon, { backgroundColor: `${action.color}14` }]}>
                      <Ionicons name={action.icon as any} size={20} color={action.color} />
                    </View>
                    <Text style={styles.quickActionLabel} numberOfLines={2}>
                      {lang === 'es' ? action.label_es : action.label_en}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          }
          onContentSizeChange={() => {
            if (messages.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: false });
            }
          }}
        />
      )}

      {/* Scrollable Quick Suggestions (shows when conversation has messages) */}
      {messages.length > 0 && showQuickActions && !showAttach && (
        <View style={styles.suggestionsBar}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={quickActions.slice(0, 4)}
            keyExtractor={(_, i) => `suggestion-${i}`}
            contentContainerStyle={styles.suggestionsContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.suggestionChip}
                onPress={() => {
                  const msg = lang === 'es' ? item.message_es : item.message_en;
                  sendMessage(msg, 'text');
                }}
                activeOpacity={0.7}
              >
                <Ionicons name={item.icon as any} size={14} color={item.color} />
                <Text style={styles.suggestionText}>
                  {lang === 'es' ? item.label_es : item.label_en}
                </Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity
            style={styles.suggestionsClose}
            onPress={() => setShowQuickActions(false)}
          >
            <Ionicons name="close" size={16} color={C.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Attachment Options */}
      {showAttach && (
        <View style={styles.attachMenu}>
          <TouchableOpacity style={styles.attachOption} onPress={takePhoto}>
            <View style={[styles.attachIcon, { backgroundColor: C.brandRedLight }]}>
              <Ionicons name="camera" size={22} color={C.brandRed} />
            </View>
            <Text style={styles.attachLabel}>{lang === 'es' ? 'Cámara' : 'Camera'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachOption} onPress={pickImage}>
            <View style={[styles.attachIcon, { backgroundColor: C.infoBg }]}>
              <Ionicons name="images" size={22} color={C.info} />
            </View>
            <Text style={styles.attachLabel}>{lang === 'es' ? 'Galería' : 'Gallery'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachOption} onPress={pickDocument}>
            <View style={[styles.attachIcon, { backgroundColor: C.violetBg }]}>
              <Ionicons name="document" size={22} color={C.violet} />
            </View>
            <Text style={styles.attachLabel}>{lang === 'es' ? 'Archivo' : 'File'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Input Bar */}
      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity
          style={styles.attachBtn}
          onPress={() => setShowAttach(!showAttach)}
        >
          <Ionicons
            name={showAttach ? 'close' : 'add-circle'}
            size={26}
            color={showAttach ? C.textMuted : C.brandRed}
          />
        </TouchableOpacity>

        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder={lang === 'es' ? 'Escribe un mensaje...' : 'Type a message...'}
            placeholderTextColor={C.textMuted}
            multiline
            maxLength={2000}
            onFocus={() => setShowAttach(false)}
          />
        </View>

        <TouchableOpacity
          style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
          onPress={() => sendMessage(inputText)}
          disabled={sending || !inputText.trim()}
        >
          {sending ? (
            <ActivityIndicator size="small" color={C.white} />
          ) : (
            <Ionicons name="send" size={18} color={C.white} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: { borderRadius: 14, overflow: 'hidden' },
  headerAvatarGrad: {
    width: 40, height: 40, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: FontSizes.base, fontWeight: '800', color: C.textPrimary, letterSpacing: -0.3 },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.success },
  onlineText: { fontSize: FontSizes.xs, color: C.success, fontWeight: '600' },
  headerGlow: { height: 20 },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Messages
  messagesList: { paddingHorizontal: Spacing.base, paddingVertical: 12 },
  emptyList: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Date Separator
  dateSeparator: {
    flexDirection: 'row', alignItems: 'center', marginVertical: 16, gap: 10,
  },
  dateLine: { flex: 1, height: 1, backgroundColor: C.border },
  dateText: {
    fontSize: FontSizes.xs, color: C.textMuted, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },

  // Message Row
  messageRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    marginBottom: 8, maxWidth: '85%',
    gap: 8,
  },
  messageRowMe: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },

  adminAvatar: {
    width: 28, height: 28, borderRadius: 10,
    backgroundColor: 'rgba(200,16,46,0.15)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 2,
  },

  // Bubble
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '100%',
  },
  bubbleMe: {
    backgroundColor: C.brandRed,
    borderBottomRightRadius: 6,
  },
  bubbleAdmin: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderBottomLeftRadius: 6,
  },
  bubbleAI: {
    backgroundColor: 'rgba(99, 91, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(99, 91, 255, 0.25)',
    borderBottomLeftRadius: 6,
  },
  aiAvatar: {
    backgroundColor: 'rgba(99, 91, 255, 0.25)',
  },

  // ─── AI action chips ───
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  actionChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: C.glassLight,
    borderWidth: 1,
    borderColor: C.glassBorderLight,
  },
  actionChipPrimary: {
    backgroundColor: 'rgba(200,16,46,0.20)',
    borderColor: 'rgba(200,16,46,0.55)',
  },
  actionChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textPrimary,
    letterSpacing: 0.2,
  },
  actionChipTextPrimary: {
    color: C.brandRed,
  },

  senderName: {
    fontSize: 10, fontWeight: '700', color: C.brandRed,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: 4,
  },
  senderNameAI: {
    color: '#635BFF',
  },
  messageText: { fontSize: FontSizes.base, color: C.textPrimary, lineHeight: 22 },
  messageTextMe: { color: C.white },

  // Time
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  timeText: { fontSize: 10, color: C.textMuted, fontWeight: '500' },
  timeTextMe: { color: C.textSecondary },

  // Image Message
  imageContainer: {
    borderRadius: 12, overflow: 'hidden', marginBottom: 2,
  },
  chatImage: { width: 200, height: 150, borderRadius: 12 },

  // File Message
  fileContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 4,
  },
  fileName: { fontSize: FontSizes.sm, color: C.textPrimary, fontWeight: '600' },

  // Empty State
  emptyContainer: { alignItems: 'center', paddingHorizontal: 20 },
  emptyIconWrap: {
    width: 88, height: 88, borderRadius: 24,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  emptyTitle: {
    fontSize: FontSizes.lg, fontWeight: '800', color: C.textPrimary,
    textAlign: 'center', letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: FontSizes.sm, color: C.textSecondary,
    textAlign: 'center', marginTop: 8, lineHeight: 20, marginBottom: 20,
  },

  // Quick Action Grid (empty state)
  quickActionsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 10, justifyContent: 'center',
    width: '100%', marginTop: 4,
  },
  quickActionCard: {
    width: '30%',
    backgroundColor: C.surface,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 6,
  },
  quickActionIcon: {
    width: 38, height: 38, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  quickActionLabel: {
    fontSize: 10, fontWeight: '700', color: C.textSecondary,
    textAlign: 'center', lineHeight: 13,
  },

  // Suggestions Bar (with messages present)
  suggestionsBar: {
    flexDirection: 'row', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: C.border,
    backgroundColor: C.surfaceLight,
    paddingVertical: 8,
  },
  suggestionsContent: {
    paddingHorizontal: Spacing.sm,
    gap: 8,
  },
  suggestionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: C.surface,
    borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: C.border,
  },
  suggestionText: {
    fontSize: FontSizes.xs, color: C.textSecondary, fontWeight: '600',
  },
  suggestionsClose: {
    width: 32, height: 32, justifyContent: 'center', alignItems: 'center',
    marginRight: 4,
  },

  // Attachment Menu
  attachMenu: {
    flexDirection: 'row', justifyContent: 'center', gap: 24,
    paddingVertical: 16, paddingHorizontal: Spacing.base,
    borderTopWidth: 1, borderTopColor: C.border,
    backgroundColor: C.surfaceLight,
  },
  attachOption: { alignItems: 'center', gap: 6 },
  attachIcon: {
    width: 52, height: 52, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  attachLabel: { fontSize: FontSizes.xs, color: C.textMuted, fontWeight: '600' },

  // Input Bar
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: Spacing.sm, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: C.border,
    backgroundColor: C.background,
    gap: 6,
  },
  attachBtn: {
    width: 44, height: 44, justifyContent: 'center', alignItems: 'center',
  },
  inputWrap: {
    flex: 1, backgroundColor: C.surface,
    borderRadius: 22, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    maxHeight: 120,
  },
  input: {
    fontSize: FontSizes.base, color: C.textPrimary,
    minHeight: 24,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.brandRed,
    justifyContent: 'center', alignItems: 'center',
    ...Shadows.button,
  },
  sendBtnDisabled: {
    backgroundColor: C.surfaceLight,
    shadowOpacity: 0,
  },
});
