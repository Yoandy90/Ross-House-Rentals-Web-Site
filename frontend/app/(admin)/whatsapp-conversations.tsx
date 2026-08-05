import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Conversation {
  id: string;
  phone_number: string;
  client_name?: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  status: 'active' | 'archived' | 'closed';
  is_lead: boolean;
  manual_mode?: boolean;
}

interface Message {
  id: string;
  conversation_id: string;
  message: string;
  direction: 'inbound' | 'outbound';
  status: 'sent' | 'delivered' | 'read' | 'failed';
  created_at: string;
}

const QUICK_REPLIES = [
  '¡Hola! Gracias por contactarnos.',
  '¿En qué podemos ayudarte?',
  'Te responderemos pronto.',
  '¿Tienes alguna pregunta?',
  'Gracias por tu paciencia.',
];

export default function WhatsAppConversations() {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  
  const messagesEndRef = useRef<ScrollView>(null);

  const loadConversations = useCallback(async () => {
    try {
      const response = await api.get('/whatsapp/conversations');
      setConversations(response.data.conversations || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const loadMessages = async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setLoadingMessages(true);
    
    try {
      // Use phone_number instead of id for the endpoint
      const phoneNumber = conversation.phone_number.replace(/\D/g, '');
      const response = await api.get(`/whatsapp/conversations/${phoneNumber}/history`);
      setMessages(response.data.messages || []);
      
      // Mark as read
      await api.post(`/whatsapp/conversations/${phoneNumber}/mark-read`);
      
      // Update unread count
      setConversations(prev => 
        prev.map(c => c.id === conversation.id ? { ...c, unread_count: 0 } : c)
      );
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !selectedConversation) return;
    
    setSending(true);
    Keyboard.dismiss();
    
    try {
      // Use the correct endpoint with phone_number
      const phoneNumber = selectedConversation.phone_number.replace(/\D/g, '');
      await api.post('/whatsapp/send', {
        phone_number: phoneNumber,
        message: messageText.trim()
      });
      
      setMessageText('');
      setShowQuickReplies(false);
      
      // Reload messages
      const response = await api.get(`/whatsapp/conversations/${phoneNumber}/history`);
      setMessages(response.data.messages || []);
      
      setTimeout(() => {
        messagesEndRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const toggleAIMode = async () => {
    if (!selectedConversation) return;
    
    try {
      const phoneNumber = selectedConversation.phone_number.replace(/\D/g, '');
      const newManualMode = !selectedConversation.manual_mode;
      
      await api.post(`/whatsapp/conversations/${phoneNumber}/toggle-mode`, {
        manual_mode: newManualMode
      });
      
      // Update local state
      setSelectedConversation(prev => prev ? { ...prev, manual_mode: newManualMode } : null);
      setConversations(prev => 
        prev.map(c => c.id === selectedConversation.id ? { ...c, manual_mode: newManualMode } : c)
      );
    } catch (error) {
      console.error('Error toggling AI mode:', error);
    }
  };

  const formatPhoneNumber = (phone: string) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    if (cleaned.length === 10) {
      return `+1 (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        return format(date, 'HH:mm');
      } else if (diffDays === 1) {
        return 'Ayer';
      } else if (diffDays < 7) {
        return format(date, 'EEEE', { locale: es });
      } else {
        return format(date, 'dd/MM/yy');
      }
    } catch {
      return '';
    }
  };

  const getMessageStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return 'checkmark';
      case 'delivered': return 'checkmark-done';
      case 'read': return 'checkmark-done';
      case 'failed': return 'close';
      default: return 'time';
    }
  };

  const filteredConversations = conversations.filter(c => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      c.client_name?.toLowerCase().includes(query) ||
      c.phone_number.includes(query) ||
      c.last_message?.toLowerCase().includes(query)
    );
  });

  const useQuickReply = (reply: string) => {
    setMessageText(reply);
    setShowQuickReplies(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#25D366" />
          <Text style={styles.loadingText}>Cargando conversaciones...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Chat View - Full Screen
  if (selectedConversation) {
    return (
      <SafeAreaView style={styles.chatFullScreen} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          {/* Chat Header - WhatsApp Style */}
          <View style={styles.chatHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                setSelectedConversation(null);
                loadConversations();
              }}
            >
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            
            <View style={styles.chatHeaderAvatar}>
              <Ionicons name="person" size={24} color="#A0AAB0" />
            </View>
            
            <View style={styles.chatHeaderInfo}>
              <Text style={styles.chatHeaderName} numberOfLines={1}>
                {selectedConversation.client_name || formatPhoneNumber(selectedConversation.phone_number)}
              </Text>
              <Text style={styles.chatHeaderStatus}>
                {selectedConversation.client_name ? formatPhoneNumber(selectedConversation.phone_number) : 'toca para añadir'}
              </Text>
            </View>

            {/* AI Mode Toggle */}
            <TouchableOpacity 
              style={[
                styles.aiModeButton,
                selectedConversation.manual_mode && styles.aiModeButtonManual
              ]}
              onPress={toggleAIMode}
            >
              <Ionicons 
                name={selectedConversation.manual_mode ? "person" : "flash"} 
                size={16} 
                color="#FFF" 
              />
              <Text style={styles.aiModeText}>
                {selectedConversation.manual_mode ? 'Manual' : 'AI'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.headerIcon}>
              <Ionicons name="call" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Messages - WhatsApp Background */}
          <View style={styles.messagesWrapper}>
            {loadingMessages ? (
              <View style={styles.loadingMessages}>
                <ActivityIndicator size="large" color="#25D366" />
              </View>
            ) : (
              <ScrollView
                ref={messagesEndRef}
                style={styles.messagesContainer}
                contentContainerStyle={styles.messagesContent}
                onContentSizeChange={() => messagesEndRef.current?.scrollToEnd({ animated: false })}
              >
                {messages.length === 0 ? (
                  <View style={styles.emptyChat}>
                    <View style={styles.emptyChatBox}>
                      <Ionicons name="lock-closed" size={14} color="#8696A0" />
                      <Text style={styles.emptyChatText}>
                        Los mensajes están cifrados de extremo a extremo. Nadie fuera de este chat puede leerlos.
                      </Text>
                    </View>
                  </View>
                ) : (
                  messages.map((message) => {
                    const isOutbound = message.direction === 'outbound';
                    return (
                      <View
                        key={message.id}
                        style={[
                          styles.messageBubble,
                          isOutbound ? styles.messageBubbleOut : styles.messageBubbleIn
                        ]}
                      >
                        <Text style={styles.messageText}>{message.message}</Text>
                        <View style={styles.messageFooter}>
                          <Text style={styles.messageTime}>
                            {format(new Date(message.created_at), 'HH:mm')}
                          </Text>
                          {isOutbound && (
                            <Ionicons
                              name={getMessageStatusIcon(message.status)}
                              size={16}
                              color={message.status === 'read' ? '#53BDEB' : '#8696A0'}
                              style={{ marginLeft: 3 }}
                            />
                          )}
                        </View>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            )}
          </View>

          {/* Quick Replies */}
          {showQuickReplies && (
            <View style={styles.quickRepliesContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickRepliesScroll}
              >
                {QUICK_REPLIES.map((reply, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.quickReplyChip}
                    onPress={() => useQuickReply(reply)}
                  >
                    <Text style={styles.quickReplyText}>{reply}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Input - WhatsApp Style */}
          <View style={styles.inputContainer}>
            <TouchableOpacity style={styles.inputIcon}>
              <Ionicons name="happy-outline" size={24} color="#8696A0" />
            </TouchableOpacity>
            
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={messageText}
                onChangeText={setMessageText}
                placeholder="Mensaje"
                placeholderTextColor="#8696A0"
                multiline
                maxLength={1000}
              />
              <TouchableOpacity
                style={styles.inputIconRight}
                onPress={() => setShowQuickReplies(!showQuickReplies)}
              >
                <Ionicons name="flash" size={20} color="#8696A0" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.sendButton,
                (!messageText.trim() || sending) && styles.sendButtonDisabled
              ]}
              onPress={sendMessage}
              disabled={!messageText.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="send" size={20} color="#FFF" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Conversations List - Full Screen
  const activeConversations = conversations.filter(c => c.status === 'active').length;
  const unreadCount = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header - WhatsApp Style */}
      <View style={styles.listHeader}>
        <Text style={styles.listHeaderTitle}>WhatsApp</Text>
        <View style={styles.listHeaderIcons}>
          <TouchableOpacity style={styles.headerIconDark}>
            <Ionicons name="camera-outline" size={24} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconDark}>
            <Ionicons name="search" size={22} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconDark}>
            <Ionicons name="ellipsis-vertical" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Ionicons name="chatbubbles" size={18} color="#FFF" />
          <Text style={styles.statNumber}>{activeConversations}</Text>
          <Text style={styles.statText}>Activas</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="mail-unread" size={18} color="#FFF" />
          <Text style={styles.statNumber}>{unreadCount}</Text>
          <Text style={styles.statText}>No leídos</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="person-add" size={18} color="#FFF" />
          <Text style={styles.statNumber}>{conversations.filter(c => c.is_lead).length}</Text>
          <Text style={styles.statText}>Leads</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#8696A0" />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Buscar..."
            placeholderTextColor="#8696A0"
          />
        </View>
      </View>

      {/* Conversations List */}
      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.conversationItem}
            onPress={() => loadMessages(item)}
            activeOpacity={0.7}
          >
            {/* Avatar */}
            <View style={styles.avatar}>
              <Ionicons name="person" size={28} color="#CFD8DC" />
            </View>

            {/* Content */}
            <View style={styles.conversationContent}>
              <View style={styles.conversationTop}>
                <Text style={styles.conversationName} numberOfLines={1}>
                  {item.client_name || formatPhoneNumber(item.phone_number)}
                </Text>
                <Text style={[
                  styles.conversationTime,
                  item.unread_count > 0 && styles.conversationTimeUnread
                ]}>
                  {formatTime(item.last_message_at)}
                </Text>
              </View>
              <View style={styles.conversationBottom}>
                <View style={styles.lastMessageContainer}>
                  <Ionicons 
                    name="checkmark-done" 
                    size={16} 
                    color="#53BDEB" 
                    style={{ marginRight: 4 }}
                  />
                  <Text style={styles.lastMessage} numberOfLines={1}>
                    {item.last_message}
                  </Text>
                </View>
                {item.unread_count > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>
                      {item.unread_count > 99 ? '99+' : item.unread_count}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyList}>
            <Ionicons name="chatbubbles-outline" size={64} color="#8696A0" />
            <Text style={styles.emptyListText}>No hay conversaciones</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111B21',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111B21',
  },
  loadingText: {
    fontSize: 16,
    color: '#8696A0',
    marginTop: 12,
  },
  
  // List Header
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1F2C34',
  },
  listHeaderTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
  },
  listHeaderIcons: {
    flexDirection: 'row',
    gap: 20,
  },
  headerIconDark: {
    padding: 4,
  },
  
  // Stats Bar
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#1F2C34',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  statText: {
    fontSize: 12,
    color: '#FFF',
  },
  
  // Search
  searchBar: {
    backgroundColor: '#1F2C34',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111B21',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFF',
  },
  
  // List
  list: {
    flex: 1,
    backgroundColor: '#111B21',
  },
  listContent: {
    paddingBottom: 80,
  },
  
  // Conversation Item
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#222D34',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2A3942',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  conversationContent: {
    flex: 1,
  },
  conversationTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 17,
    fontWeight: '500',
    color: '#FFF',
    flex: 1,
    marginRight: 8,
  },
  conversationTime: {
    fontSize: 12,
    color: '#8696A0',
  },
  conversationTimeUnread: {
    color: '#25D366',
  },
  conversationBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  lastMessage: {
    fontSize: 14,
    color: '#8696A0',
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: '#25D366',
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  
  emptyList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyListText: {
    fontSize: 16,
    color: '#8696A0',
    marginTop: 16,
  },
  
  // Chat Full Screen
  chatFullScreen: {
    flex: 1,
    backgroundColor: '#0B141A',
  },
  
  // Chat Header
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2C34',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  backButton: {
    padding: 8,
  },
  chatHeaderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2A3942',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  chatHeaderInfo: {
    flex: 1,
  },
  chatHeaderName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFF',
  },
  chatHeaderStatus: {
    fontSize: 13,
    color: '#8696A0',
  },
  headerIcon: {
    padding: 10,
  },
  aiModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    gap: 4,
  },
  aiModeButtonManual: {
    backgroundColor: '#FF9500',
  },
  aiModeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  
  // Messages
  messagesWrapper: {
    flex: 1,
    backgroundColor: '#0B141A',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 8,
    paddingBottom: 16,
  },
  loadingMessages: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  emptyChat: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 40,
  },
  emptyChatBox: {
    backgroundColor: '#182229',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyChatText: {
    fontSize: 13,
    color: '#8696A0',
    flex: 1,
    textAlign: 'center',
  },
  
  // Message Bubbles
  messageBubble: {
    maxWidth: '80%',
    padding: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 2,
  },
  messageBubbleIn: {
    alignSelf: 'flex-start',
    backgroundColor: '#1F2C34',
    borderTopLeftRadius: 0,
  },
  messageBubbleOut: {
    alignSelf: 'flex-end',
    backgroundColor: '#005C4B',
    borderTopRightRadius: 0,
  },
  messageText: {
    fontSize: 15,
    color: '#FFF',
    lineHeight: 20,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 2,
  },
  messageTime: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
  },
  
  // Quick Replies
  quickRepliesContainer: {
    backgroundColor: '#1F2C34',
    paddingVertical: 8,
    borderTopWidth: 0.5,
    borderTopColor: '#222D34',
  },
  quickRepliesScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  quickReplyChip: {
    backgroundColor: '#25D366',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  quickReplyText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FFF',
  },
  
  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#1F2C34',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  inputIcon: {
    padding: 8,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#2A3942',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#FFF',
    maxHeight: 100,
    paddingVertical: 0,
  },
  inputIconRight: {
    paddingLeft: 8,
    paddingBottom: 2,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#00A884',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
});
