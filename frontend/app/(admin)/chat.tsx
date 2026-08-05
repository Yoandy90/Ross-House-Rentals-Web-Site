/**
 * Admin Chat - Lista de Conversaciones
 * Vista principal del chat para admins
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  TextInput,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';

import AsyncStorage from '@react-native-async-storage/async-storage';

interface Conversation {
  conversation_id: string;
  client_name: string;
  client_email: string;
  last_message: string;
  last_message_at: string;
  last_message_sender: string;
  unread_count_admin: number;
  status: string;
}

const CACHE_KEY = 'admin_conversations_cache';

const AdminChatList = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [aiGlobalEnabled, setAiGlobalEnabled] = useState(false);

  useEffect(() => {
    // Cargar caché primero para mostrar datos inmediatamente
    loadFromCache();
    // Luego actualizar desde el servidor
    loadConversations();
    loadAIStatus();
    // Polling cada 10 segundos
    const interval = setInterval(loadConversations, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadFromCache = async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        setConversations(data.conversations || []);
        setFilteredConversations(data.conversations || []);
        setTotalUnread(data.total_unread || 0);
        // Si hay caché, quitar el loading inmediatamente
        if (data.conversations?.length > 0) {
          setLoading(false);
        }
        console.log('📦 Loaded from cache:', data.conversations?.length, 'conversations');
      }
    } catch (error) {
      console.log('Cache not available');
    }
  };

  const saveToCache = async (convs: Conversation[], unread: number) => {
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
        conversations: convs,
        total_unread: unread,
        cached_at: new Date().toISOString()
      }));
    } catch (error) {
      console.log('Error saving cache');
    }
  };

  const loadAIStatus = async () => {
    try {
      const response = await api.get('/chat/ai/global-status');
      setAiGlobalEnabled(response.data.ai_enabled_global || false);
      console.log('✅ AI Status loaded:', response.data);
    } catch (error: any) {
      console.error('❌ Error loading AI status:', error.response?.status, error.response?.data);
      // Don't show error to user for initial load, just default to false
    }
  };

  const toggleGlobalAI = async () => {
    try {
      const newValue = !aiGlobalEnabled;
      console.log('🔄 Toggling AI to:', newValue);
      
      const response = await api.post('/chat/ai/toggle-global', { enabled: newValue });
      console.log('✅ Toggle response:', response.data);
      
      setAiGlobalEnabled(newValue);
      Alert.alert(
        '🤖 IA Global',
        newValue 
          ? 'IA activada para todas las conversaciones nuevas. Activa individualmente para conversaciones existentes.' 
          : 'IA desactivada globalmente.'
      );
    } catch (error: any) {
      console.error('❌ Error toggling global AI:', error);
      console.error('❌ Error details:', error.response?.data);
      console.error('❌ Error status:', error.response?.status);
      Alert.alert(
        'Error', 
        error.response?.data?.detail || 'No se pudo cambiar el estado global de la IA. Verifica que tengas permisos de admin.'
      );
    }
  };

  const loadConversations = async () => {
    try {
      console.log('🔄 Cargando conversaciones...');
      const response = await api.get('/chat/conversations');
      const convs = response.data.conversations || [];
      console.log(`✅ ${convs.length} conversaciones cargadas`);
      setConversations(convs);
      
      // Guardar en caché para próxima vez
      saveToCache(convs, response.data.total_unread || 0);
      
      // Reapply search filter if exists
      if (searchQuery.trim()) {
        const filtered = convs.filter((conv: Conversation) =>
          conv.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          conv.client_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          conv.last_message?.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setFilteredConversations(filtered);
      } else {
        setFilteredConversations(convs);
      }
      
      setTotalUnread(response.data.total_unread || 0);
    } catch (error: any) {
      console.error('❌ Error loading conversations:', error?.message || error);
      // Set empty arrays on error to show "no conversations" instead of infinite loading
      if (conversations.length === 0) {
        setConversations([]);
        setFilteredConversations([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredConversations(conversations);
      return;
    }

    const filtered = conversations.filter((conv) =>
      conv.client_name.toLowerCase().includes(query.toLowerCase()) ||
      conv.client_email.toLowerCase().includes(query.toLowerCase()) ||
      conv.last_message?.toLowerCase().includes(query.toLowerCase())
    );
    setFilteredConversations(filtered);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadConversations();
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 24) {
      return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } else if (hours < 48) {
      return 'Ayer';
    } else {
      return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    }
  };

  const renderConversationCard = ({ item }: { item: Conversation }) => {
    const hasUnread = item.unread_count_admin > 0;
    
    return (
      <TouchableOpacity
        style={[styles.conversationCard, hasUnread && styles.conversationCardUnread]}
        onPress={() => router.push(`/_adminScreens/chat-conversation?id=${item.conversation_id}&name=${item.client_name}`)}
      >
        <View style={styles.avatarContainer}>
          <LinearGradient
            colors={['#4E79A7', '#6B9BD1']}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>
              {item.client_name.charAt(0).toUpperCase()}
            </Text>
          </LinearGradient>
          {hasUnread && <View style={styles.onlineDot} />}
        </View>

        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={[styles.clientName, hasUnread && styles.clientNameBold]}>
              {item.client_name}
            </Text>
            <Text style={styles.timestamp}>{formatTime(item.last_message_at)}</Text>
          </View>
          
          <View style={styles.messageRow}>
            {item.last_message_sender === 'admin' && (
              <Ionicons name="checkmark-done" size={16} color="#3b82f6" style={{ marginRight: 4 }} />
            )}
            <Text
              style={[styles.lastMessage, hasUnread && styles.lastMessageBold]}
              numberOfLines={1}
            >
              {item.last_message || 'Sin mensajes'}
            </Text>
          </View>
        </View>

        {hasUnread && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{item.unread_count_admin}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4E79A7" />
        <Text style={styles.loadingText}>Cargando conversaciones...</Text>
      </View>
    );
  }

  return (
    <>
      <View style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        right: 0, 
        height: insets.top + 80,
        backgroundColor: '#1a1a2e',
        zIndex: -1
      }} />
      
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <LinearGradient
          colors={['#1a1a2e', '#1a1a2e']}
          style={[styles.headerGradient, { paddingTop: insets.top }]}
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="chatbubbles" size={28} color="#ffffff" />
              <Text style={styles.headerTitle}>Mensajes</Text>
            </View>
            {totalUnread > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{totalUnread}</Text>
              </View>
            )}
          </View>
        </LinearGradient>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar conversaciones..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Ionicons name="close-circle" size={20} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>

        {/* AI Toggle Card */}
        <View style={styles.aiToggleCard}>
          <View style={styles.aiToggleContent}>
            <View style={styles.aiToggleLeft}>
              <Ionicons 
                name="flash" 
                size={24} 
                color={aiGlobalEnabled ? "#10b981" : "#6b7280"} 
              />
              <View style={styles.aiToggleTextContainer}>
                <Text style={styles.aiToggleTitle}>🤖 Asistente IA Automático</Text>
                <Text style={styles.aiToggleSubtitle}>
                  {aiGlobalEnabled 
                    ? "Activo - La IA responde automáticamente" 
                    : "Inactivo - Respuestas manuales"}
                </Text>
              </View>
            </View>
            <Switch
              value={aiGlobalEnabled}
              onValueChange={toggleGlobalAI}
              trackColor={{ false: '#d1d5db', true: '#10b981' }}
              thumbColor={aiGlobalEnabled ? '#ffffff' : '#f3f4f6'}
            />
          </View>
        </View>

        <FlatList
          data={filteredConversations}
          renderItem={renderConversationCard}
          keyExtractor={(item) => item.conversation_id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
              <Text style={styles.emptyTitle}>No hay conversaciones</Text>
              <Text style={styles.emptyText}>
                Las conversaciones con clientes aparecerán aquí
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  headerGradient: {
    paddingBottom: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#94A3B8',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    margin: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#F1F5F9',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  conversationCard: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  conversationCardUnread: {
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#fff',
  },
  conversationContent: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  clientName: {
    fontSize: 16,
    color: '#F1F5F9',
  },
  clientNameBold: {
    fontWeight: 'bold',
  },
  timestamp: {
    fontSize: 12,
    color: '#64748B',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    color: '#94A3B8',
    flex: 1,
  },
  lastMessageBold: {
    fontWeight: '600',
    color: '#CBD5E1',
  },
  unreadBadge: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginLeft: 8,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#F1F5F9',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  // AI Toggle Card
  aiToggleCard: {
    backgroundColor: '#1E293B',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  aiToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aiToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  aiToggleTextContainer: {
    flex: 1,
  },
  aiToggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F1F5F9',
    marginBottom: 2,
  },
  aiToggleSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
  },
});

export default AdminChatList;
