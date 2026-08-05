import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Conversation {
  id: string;
  phone_number: string;
  client_name?: string;
  status: 'active' | 'archived' | 'closed';
  last_message: string;
  last_message_at: string;
  unread_count: number;
  is_lead: boolean;
  lead_status?: string;
}

interface Message {
  id: string;
  message: string;
  direction: 'inbound' | 'outbound';
  created_at: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
}

const QUICK_REPLIES = [
  'Gracias por contactarnos',
  '¿En qué puedo ayudarte?',
  'Nos pondremos en contacto pronto',
  'Consulta sobre impuestos',
  'Horario de oficina: Lun-Vie 9AM-6PM',
];

export default function WhatsAppConversationsScreen() {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const messagesEndRef = useRef<ScrollView>(null);
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showQuickReplies, setShowQuickReplies] = useState(false);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    filterConversations();
  }, [searchQuery, conversations, statusFilter]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const loadConversations = async () => {
    try {
      const response = await api.get('/whatsapp/conversations');
      setConversations(response.data.conversations || []);
    } catch (error: any) {
      console.error('Error loading conversations:', error);
      Alert.alert('Error', 'No se pudieron cargar las conversaciones');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterConversations = () => {
    let filtered = conversations;

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === statusFilter);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.phone_number.includes(query) ||
        c.client_name?.toLowerCase().includes(query) ||
        c.last_message.toLowerCase().includes(query)
      );
    }

    setFilteredConversations(filtered);
  };

  const loadMessages = async (conversation: Conversation) => {
    try {
      const response = await api.get(`/whatsapp/conversations/${conversation.phone_number}/history`);
      setMessages(response.data.messages || []);
      setSelectedConversation(conversation);
      
      // Mark as read
      try {
        await api.post(`/whatsapp/conversations/${conversation.phone_number}/mark-read`);
        loadConversations();
      } catch (err) {
        console.error('Error marking as read:', err);
      }
    } catch (error: any) {
      console.error('Error loading messages:', error);
      Alert.alert('Error', 'No se pudieron cargar los mensajes');
    }
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !selectedConversation || sending) return;
    
    try {
      setSending(true);
      
      await api.post('/whatsapp/send', {
        phone_number: selectedConversation.phone_number,
        message: messageText.trim()
      });
      
      // Reload messages
      await loadMessages(selectedConversation);
      setMessageText('');
      setShowQuickReplies(false);
    } catch (error: any) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'No se pudo enviar el mensaje');
    } finally {
      setSending(false);
    }
  };

  const useQuickReply = (reply: string) => {
    setMessageText(reply);
    setShowQuickReplies(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadConversations();
    if (selectedConversation) {
      loadMessages(selectedConversation);
    }
  };

  const formatPhoneNumber = (phone: string) => {
    if (phone.length === 11 && phone.startsWith('1')) {
      return `+1 (${phone.slice(1, 4)}) ${phone.slice(4, 7)}-${phone.slice(7)}`;
    }
    return `+${phone}`;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return format(date, 'dd MMM', { locale: es });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#4CAF50';
      case 'archived': return '#999';
      case 'closed': return '#F44336';
      default: return '#2196F3';
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

  const renderConversationItem = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={[
        styles.conversationItem,
        selectedConversation?.id === item.id && styles.conversationItemActive
      ]}
      onPress={() => loadMessages(item)}
      activeOpacity={0.7}
    >
      <View style={styles.conversationLeft}>
        <View style={[
          styles.conversationAvatar,
          { borderColor: getStatusColor(item.status) }
        ]}>
          <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
        </View>
        {item.unread_count > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>
              {item.unread_count > 9 ? '9+' : item.unread_count}
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={styles.conversationName} numberOfLines={1}>
            {item.client_name || formatPhoneNumber(item.phone_number)}
          </Text>
          <Text style={styles.conversationTime}>
            {formatTime(item.last_message_at)}
          </Text>
        </View>
        
        {item.client_name && (
          <Text style={styles.conversationPhone}>
            {formatPhoneNumber(item.phone_number)}
          </Text>
        )}
        
        <Text style={styles.conversationLastMessage} numberOfLines={2}>
          {item.last_message}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderMessage = ({ item }: { item: Message }) => {
    const isOutbound = item.direction === 'outbound';
    
    return (
      <View style={[
        styles.messageBubble,
        isOutbound ? styles.messageBubbleOut : styles.messageBubbleIn
      ]}>
        <Text style={[
          styles.messageText,
          isOutbound && styles.messageTextOut
        ]}>
          {item.message}
        </Text>
        <View style={styles.messageFooter}>
          <Text style={[
            styles.messageTime,
            isOutbound && styles.messageTimeOut
          ]}>
            {format(new Date(item.created_at), 'HH:mm')}
          </Text>
          {isOutbound && (
            <Ionicons
              name={getMessageStatusIcon(item.status)}
              size={14}
              color={item.status === 'read' ? '#4FC3F7' : 'rgba(255,255,255,0.7)'}
              style={{ marginLeft: 4 }}
            />
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando conversaciones...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const activeConversations = conversations.filter(c => c.status === 'active').length;
  const unreadCount = conversations.reduce((sum, c) => sum + c.unread_count, 0);
  const leadsCount = conversations.filter(c => c.is_lead).length;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header */}
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Ionicons name="logo-whatsapp" size={32} color="#FFF" />
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>WhatsApp</Text>
              <Text style={styles.headerSubtitle}>
                {conversations.length} conversaciones
              </Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="chatbubbles" size={20} color="#FFF" />
            <Text style={styles.statValue}>{activeConversations}</Text>
            <Text style={styles.statLabel}>Activas</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="mail-unread" size={20} color="#FFF" />
            <Text style={styles.statValue}>{unreadCount}</Text>
            <Text style={styles.statLabel}>No leídos</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="person-add" size={20} color="#FFF" />
            <Text style={styles.statValue}>{leadsCount}</Text>
            <Text style={styles.statLabel}>Leads</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.mainContent}>
        {/* Conversations List */}
        <View style={styles.conversationsList}>
          {/* Search and Filters */}
          <View style={styles.searchSection}>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={18} color={colors.textGray} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Buscar conversaciones..."
                placeholderTextColor={colors.textGray}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={colors.textGray} />
                </TouchableOpacity>
              )}
            </View>

            {/* Status Filters */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersContainer}
            >
              {[
                { key: 'all', label: 'Todas', count: conversations.length },
                { key: 'active', label: 'Activas', count: activeConversations },
                { key: 'archived', label: 'Archivadas', count: conversations.filter(c => c.status === 'archived').length },
              ].map((filter) => (
                <TouchableOpacity
                  key={filter.key}
                  style={[
                    styles.filterChip,
                    statusFilter === filter.key && styles.filterChipActive
                  ]}
                  onPress={() => setStatusFilter(filter.key)}
                >
                  <Text style={[
                    styles.filterChipText,
                    statusFilter === filter.key && styles.filterChipTextActive
                  ]}>
                    {filter.label} ({filter.count})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Conversations */}
          <FlatList
            data={filteredConversations}
            renderItem={renderConversationItem}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="chatbubbles-outline" size={64} color={colors.textGray} />
                <Text style={styles.emptyText}>
                  {searchQuery ? 'No se encontraron conversaciones' : 'No hay conversaciones'}
                </Text>
              </View>
            }
          />
        </View>

        {/* Chat View */}
        {selectedConversation && (
          <KeyboardAvoidingView
            style={styles.chatContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            {/* Chat Header */}
            <View style={styles.chatHeader}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setSelectedConversation(null)}
              >
                <Ionicons name="arrow-back" size={24} color={colors.text} />
              </TouchableOpacity>
              
              <View style={styles.chatHeaderInfo}>
                <Text style={styles.chatHeaderName}>
                  {selectedConversation.client_name || formatPhoneNumber(selectedConversation.phone_number)}
                </Text>
                <Text style={styles.chatHeaderPhone}>
                  {selectedConversation.client_name ? formatPhoneNumber(selectedConversation.phone_number) : 'Cliente'}
                </Text>
              </View>

              <View style={[
                styles.statusIndicator,
                { backgroundColor: getStatusColor(selectedConversation.status) }
              ]} />
            </View>

            {/* Messages */}
            <ScrollView
              ref={messagesEndRef}
              style={styles.messagesContainer}
              contentContainerStyle={styles.messagesContent}
            >
              {messages.length === 0 ? (
                <View style={styles.emptyChat}>
                  <Ionicons name="chatbubble-outline" size={48} color={colors.textGray} />
                  <Text style={styles.emptyChatText}>No hay mensajes</Text>
                </View>
              ) : (
                messages.map((message) => (
                  <View key={message.id}>
                    {renderMessage({ item: message })}
                  </View>
                ))
              )}
            </ScrollView>

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

            {/* Input */}
            <View style={styles.inputContainer}>
              <TouchableOpacity
                style={styles.quickReplyButton}
                onPress={() => setShowQuickReplies(!showQuickReplies)}
              >
                <Ionicons
                  name={showQuickReplies ? "close" : "flash"}
                  size={20}
                  color={colors.primary}
                />
              </TouchableOpacity>

              <TextInput
                style={styles.input}
                value={messageText}
                onChangeText={setMessageText}
                placeholder="Escribe un mensaje..."
                placeholderTextColor={colors.textGray}
                multiline
                maxLength={1000}
              />

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
        )}
      </View>
    </SafeAreaView>
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
  // Main Content
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  // Conversations List
  conversationsList: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
  },
  searchSection: {
    padding: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
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
  filtersContainer: {
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  filterChipActive: {
    backgroundColor: colors.primary + '15',
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textGray,
  },
  filterChipTextActive: {
    color: colors.primary,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  conversationItemActive: {
    backgroundColor: colors.primary + '10',
  },
  conversationLeft: {
    position: 'relative',
  },
  conversationAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#F44336',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  conversationTime: {
    fontSize: 11,
    color: colors.textGray,
  },
  conversationPhone: {
    fontSize: 12,
    color: colors.textGray,
    marginBottom: 4,
  },
  conversationLastMessage: {
    fontSize: 13,
    color: colors.textGray,
    lineHeight: 18,
  },
  // Chat Container
  chatContainer: {
    flex: 2,
    backgroundColor: '#ECE5DD',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 4,
  },
  chatHeaderInfo: {
    flex: 1,
  },
  chatHeaderName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  chatHeaderPhone: {
    fontSize: 13,
    color: colors.textGray,
    marginTop: 2,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    gap: 8,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 10,
    borderRadius: 12,
    marginBottom: 4,
  },
  messageBubbleIn: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF',
  },
  messageBubbleOut: {
    alignSelf: 'flex-end',
    backgroundColor: '#DCF8C6',
  },
  messageText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  messageTextOut: {
    color: '#000',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    justifyContent: 'flex-end',
  },
  messageTime: {
    fontSize: 11,
    color: colors.textGray,
  },
  messageTimeOut: {
    color: '#667781',
  },
  emptyChat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyChatText: {
    fontSize: 14,
    color: colors.textGray,
    marginTop: 12,
  },
  // Quick Replies
  quickRepliesContainer: {
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingVertical: 8,
  },
  quickRepliesScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  quickReplyChip: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  quickReplyText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    padding: 12,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  quickReplyButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    color: colors.text,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textGray,
    marginTop: 16,
  },
});
