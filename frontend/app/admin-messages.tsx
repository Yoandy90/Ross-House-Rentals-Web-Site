/**
 * Admin Messages - Lista de Conversaciones con Inquilinos
 * Con Tabs (App vs Web) y Swipe to Delete
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Switch,
  Alert,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiCall } from '../src/utils/api';
import { useColors, Spacing, FontSizes, BorderRadius } from '../src/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Conversation {
  _id: string;
  conversation_id?: string;
  client_id?: string;
  tenant_id?: string;
  client_name?: string;
  tenant_name?: string;
  client_email?: string;
  tenant_email?: string;
  client_phone?: string;
  property_address?: string;
  last_message: string;
  last_message_at: string;
  last_message_sender?: 'tenant' | 'admin' | 'ai';
  unread_count?: number;
  unread_admin?: number;
  ai_enabled: boolean;
  status?: 'active' | 'archived';
  source?: 'app' | 'web' | 'mobile';
}

const CACHE_KEY = 'admin_rental_conversations_cache';

// Swipeable Row Component
function SwipeableRow({ 
  children, 
  onDelete, 
  onDeleteBoth 
}: { 
  children: React.ReactNode; 
  onDelete: () => void;
  onDeleteBoth: () => void;
}) {
  const themeColors = useColors();
  const translateX = useRef(new Animated.Value(0)).current;
  const [isOpen, setIsOpen] = useState(false);

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => {
      return Math.abs(gestureState.dx) > 15 && Math.abs(gestureState.dy) < 10;
    },
    onPanResponderMove: (_, gestureState) => {
      if (gestureState.dx < 0) {
        translateX.setValue(Math.max(gestureState.dx, -140));
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dx < -60) {
        Animated.spring(translateX, {
          toValue: -140,
          useNativeDriver: true,
          friction: 8,
        }).start();
        setIsOpen(true);
      } else {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          friction: 8,
        }).start();
        setIsOpen(false);
      }
    },
  });

  const closeRow = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
    setIsOpen(false);
  };

  return (
    <View style={swipeStyles.container}>
      {/* Delete Buttons - Behind the card */}
      <View style={swipeStyles.actionsContainer}>
        <TouchableOpacity 
          style={swipeStyles.actionBtn}
          onPress={() => { closeRow(); onDelete(); }}
        >
          <View style={[swipeStyles.actionBtnInner, { backgroundColor: '#F59E0B' }]}>
            <Ionicons name="eye-off" size={18} color="#fff" />
            <Text style={swipeStyles.actionBtnText}>Ocultar</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity 
          style={swipeStyles.actionBtn}
          onPress={() => { closeRow(); onDeleteBoth(); }}
        >
          <View style={[swipeStyles.actionBtnInner, { backgroundColor: '#EF4444' }]}>
            <Ionicons name="trash" size={18} color="#fff" />
            <Text style={swipeStyles.actionBtnText}>Eliminar</Text>
          </View>
        </TouchableOpacity>
      </View>
      
      {/* Main Content - Slides over the buttons */}
      <Animated.View 
        style={[swipeStyles.content, { backgroundColor: themeColors.background, transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const swipeStyles = StyleSheet.create({
  container: {
    marginBottom: 8,
    marginHorizontal: 16,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 14,
  },
  actionsContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
    width: 140,
  },
  actionBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnInner: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  content: {},
});

export default function AdminMessagesScreen({ embedded }: { embedded?: boolean }) {
  const Colors = useColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [aiGlobalEnabled, setAiGlobalEnabled] = useState(false);
  const [activeSourceTab, setActiveSourceTab] = useState<'all' | 'app' | 'web'>('all');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadFromCache();
    fetchConversations();
    loadAIStatus();
    
    pollRef.current = setInterval(fetchConversations, 10000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeSourceTab]);

  const loadFromCache = async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        setConversations(data.conversations || []);
        setFilteredConversations(data.conversations || []);
        setTotalUnread(data.total_unread || 0);
        if (data.conversations?.length > 0) {
          setLoading(false);
        }
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
      const data = await apiCall('/chat/ai/global-status');
      setAiGlobalEnabled(data.ai_enabled_global || false);
    } catch (error) {
      console.log('Error loading AI status');
    }
  };

  const toggleGlobalAI = async () => {
    try {
      const newValue = !aiGlobalEnabled;
      await apiCall('/chat/ai/toggle-global', {
        method: 'POST',
        body: { enabled: newValue },
      });
      setAiGlobalEnabled(newValue);
      Alert.alert(
        '🤖 IA Automática',
        newValue 
          ? 'IA activada. La IA responderá automáticamente a los inquilinos.' 
          : 'IA desactivada. Responderás manualmente a todos los mensajes.'
      );
    } catch (error) {
      Alert.alert('Error', 'No se pudo cambiar el estado de la IA');
    }
  };

  const fetchConversations = useCallback(async () => {
    try {
      const data = await apiCall('/chat/admin/conversations');
      const convs = data.conversations || [];
      const unread = data.total_unread || convs.reduce((acc: number, c: Conversation) => 
        acc + (c.unread_admin || c.unread_count || 0), 0);
      
      setConversations(convs);
      setTotalUnread(unread);
      saveToCache(convs, unread);
      
      if (searchQuery.trim()) {
        applySearch(convs, searchQuery);
      } else {
        setFilteredConversations(convs);
      }
    } catch (error) {
      console.log('Error fetching conversations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeSourceTab, searchQuery]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchConversations();
  };

  const applySearch = (convs: Conversation[], text: string) => {
    const filtered = convs.filter(conv => {
      const name = conv.client_name || conv.tenant_name || '';
      const email = conv.client_email || conv.tenant_email || '';
      const msg = conv.last_message || '';
      const prop = conv.property_address || '';
      return name.toLowerCase().includes(text.toLowerCase()) ||
             email.toLowerCase().includes(text.toLowerCase()) ||
             msg.toLowerCase().includes(text.toLowerCase()) ||
             prop.toLowerCase().includes(text.toLowerCase());
    });
    setFilteredConversations(filtered);
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setFilteredConversations(conversations);
      return;
    }
    applySearch(conversations, text);
  };

  const deleteConversation = async (conv: Conversation, forBoth: boolean) => {
    const convId = conv._id || conv.conversation_id;
    const name = conv.client_name || conv.tenant_name || 'el cliente';
    
    Alert.alert(
      forBoth ? '🗑️ Eliminar para ambos' : '👁️ Ocultar conversación',
      forBoth 
        ? `¿Eliminar completamente la conversación con ${name}? Esta acción no se puede deshacer y se borrará para ti y para el cliente.`
        : `¿Ocultar la conversación con ${name}? Solo se eliminará de tu lista, el cliente seguirá viéndola.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: forBoth ? 'Eliminar' : 'Ocultar',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiCall(`/chat/admin/conversations/${convId}?delete_for_both=${forBoth}`, {
                method: 'DELETE',
              });
              fetchConversations();
              Alert.alert('Éxito', forBoth ? 'Conversación eliminada' : 'Conversación ocultada');
            } catch (error) {
              Alert.alert('Error', 'No se pudo eliminar la conversación');
            }
          },
        },
      ]
    );
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
  };

  const openConversation = (conv: Conversation) => {
    const convId = conv._id || conv.conversation_id;
    const name = conv.client_name || conv.tenant_name || 'Cliente';
    const clientId = conv.client_id || conv.tenant_id || '';
    
    router.push({
      pathname: '/chat-conversation',
      params: {
        conversationId: convId,
        clientName: name,
        clientId: clientId,
      }
    });
  };

  const renderConversation = ({ item }: { item: Conversation }) => {
    const hasUnread = (item.unread_admin || item.unread_count || 0) > 0;
    const unreadCount = item.unread_admin || item.unread_count || 0;
    const name = item.client_name || item.tenant_name || 'Sin nombre';
    const senderIcon = item.last_message_sender === 'ai' ? 'flash' : 
                       item.last_message_sender === 'admin' ? 'checkmark-done' : null;
    const senderColor = item.last_message_sender === 'ai' ? Colors.success : '#3B82F6';
    const isFromWeb = item.source === 'web';

    return (
      <SwipeableRow 
        onDelete={() => deleteConversation(item, false)}
        onDeleteBoth={() => deleteConversation(item, true)}
      >
        <TouchableOpacity
          style={[styles.conversationCard, hasUnread && styles.conversationUnread]}
          onPress={() => openConversation(item)}
          activeOpacity={0.7}
        >
          <View style={styles.avatarContainer}>
            <LinearGradient
              colors={isFromWeb ? ['#8B5CF6', '#6D28D9'] : [Colors.brandRed, '#9B1B30']}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>
                {name.charAt(0).toUpperCase()}
              </Text>
            </LinearGradient>
            {hasUnread && <View style={styles.onlineDot} />}
            {item.ai_enabled && (
              <View style={styles.aiBadge}>
                <Ionicons name="flash" size={10} color="#fff" />
              </View>
            )}
          </View>

          <View style={styles.conversationContent}>
            <View style={styles.conversationHeader}>
              <View style={styles.nameRow}>
                <Text style={[styles.clientName, hasUnread && styles.clientNameBold]} numberOfLines={1}>
                  {name}
                </Text>
                {isFromWeb && (
                  <View style={styles.webBadge}>
                    <Ionicons name="globe-outline" size={10} color="#8B5CF6" />
                  </View>
                )}
              </View>
              <Text style={styles.timestamp}>{formatTime(item.last_message_at)}</Text>
            </View>
            
            {item.property_address && (
              <Text style={styles.propertyAddress} numberOfLines={1}>
                <Ionicons name="home-outline" size={11} color={Colors.textMuted} /> {item.property_address}
              </Text>
            )}
            
            <View style={styles.messageRow}>
              {senderIcon && (
                <Ionicons name={senderIcon as any} size={14} color={senderColor} style={{ marginRight: 4 }} />
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
              <Text style={styles.unreadText}>{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </SwipeableRow>
    );
  };

  // Count conversations by source
  const appCount = conversations.filter(c => !c.source || c.source === 'app' || c.source === 'mobile').length;
  const webCount = conversations.filter(c => c.source === 'web').length;
  const visibleConversations = filteredConversations.filter(c =>
    activeSourceTab === 'all' ? true :
    activeSourceTab === 'web' ? c.source === 'web' :
    (!c.source || c.source === 'app' || c.source === 'mobile'));

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.brandRed} />
        <Text style={styles.loadingText}>Cargando conversaciones...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['rgba(200,16,46,0.08)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.bgGradient}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        {!embedded && (
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Mensajes</Text>
          <Text style={styles.headerSubtitle}>
            {totalUnread > 0 ? `${totalUnread} sin leer` : 'Todas leídas'}
          </Text>
        </View>
        {totalUnread > 0 && (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{totalUnread}</Text>
          </View>
        )}
      </View>

      {/* Source Tabs */}
      <View style={styles.sourceTabs}>
        {[
          { key: 'all', label: 'Todos', count: conversations.length },
          { key: 'app', label: 'App', count: appCount, icon: 'phone-portrait-outline' as const },
          { key: 'web', label: 'Web', count: webCount, icon: 'globe-outline' as const },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.sourceTab, activeSourceTab === tab.key && styles.sourceTabActive]}
            onPress={() => setActiveSourceTab(tab.key as any)}
          >
            {tab.icon && <Ionicons name={tab.icon} size={14} color={activeSourceTab === tab.key ? Colors.brandRed : Colors.textMuted} />}
            <Text style={[styles.sourceTabText, activeSourceTab === tab.key && styles.sourceTabTextActive]}>
              {tab.label}
            </Text>
            <View style={[styles.sourceTabBadge, activeSourceTab === tab.key && styles.sourceTabBadgeActive]}>
              <Text style={[styles.sourceTabBadgeText, activeSourceTab === tab.key && styles.sourceTabBadgeTextActive]}>
                {tab.count}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={Colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar conversaciones..."
          placeholderTextColor={Colors.textMuted}
          value={searchQuery}
          onChangeText={handleSearch}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* AI Toggle Card */}
      <View style={styles.aiToggleCard}>
        <View style={styles.aiToggleContent}>
          <View style={styles.aiToggleLeft}>
            <View style={[styles.aiToggleIcon, { backgroundColor: aiGlobalEnabled ? 'rgba(16,185,129,0.15)' : 'rgba(107,114,128,0.15)' }]}>
              <Ionicons 
                name="flash" 
                size={20} 
                color={aiGlobalEnabled ? Colors.success : Colors.textMuted} 
              />
            </View>
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
            trackColor={{ false: '#4B5563', true: Colors.success }}
            thumbColor={aiGlobalEnabled ? '#ffffff' : '#9CA3AF'}
          />
        </View>
      </View>

      {/* Swipe Instructions */}
      <View style={styles.swipeHint}>
        <Ionicons name="arrow-back" size={12} color={Colors.textMuted} />
        <Text style={styles.swipeHintText}>Desliza para eliminar</Text>
      </View>

      {/* Conversations List */}
      <FlatList
        data={visibleConversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item._id || item.conversation_id || Math.random().toString()}
        contentContainerStyle={[styles.listContent, embedded && { paddingBottom: 120 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brandRed} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="chatbubbles-outline" size={48} color={Colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No hay conversaciones</Text>
            <Text style={styles.emptySubtitle}>
              {activeSourceTab === 'web' 
                ? 'Las consultas desde la web aparecerán aquí'
                : activeSourceTab === 'app'
                ? 'Las conversaciones desde la app aparecerán aquí'
                : 'Las conversaciones con inquilinos aparecerán aquí cuando te escriban'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  bgGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },
  loadingText: { color: Colors.textMuted, marginTop: 12, fontSize: FontSizes.sm },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
    gap: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.glassLight,
    borderWidth: 1, borderColor: Colors.glassBorderLight,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: FontSizes['2xl'], fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  headerSubtitle: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 2 },
  headerBadge: {
    backgroundColor: Colors.brandRed,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  headerBadgeText: { color: Colors.textPrimary, fontSize: FontSizes.sm, fontWeight: '700' },

  sourceTabs: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    gap: 8,
  },
  sourceTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  sourceTabActive: {
    backgroundColor: 'rgba(200,16,46,0.1)',
    borderColor: 'rgba(200,16,46,0.2)',
  },
  sourceTabText: { fontSize: FontSizes.sm, color: Colors.textMuted, fontWeight: '600' },
  sourceTabTextActive: { color: Colors.brandRed },
  sourceTabBadge: {
    backgroundColor: Colors.glassBorderLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  sourceTabBadgeActive: { backgroundColor: 'rgba(200,16,46,0.2)' },
  sourceTabBadgeText: { fontSize: 10, color: Colors.textMuted, fontWeight: '600' },
  sourceTabBadgeTextActive: { color: Colors.brandRed },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.glassLight,
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.base,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.glassBorderLight,
    marginBottom: Spacing.sm,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontSize: FontSizes.sm,
  },

  aiToggleCard: {
    backgroundColor: Colors.glass,
    borderRadius: BorderRadius.card,
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    overflow: 'hidden',
  },
  aiToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  aiToggleLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  aiToggleIcon: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 10,
  },
  aiToggleTextContainer: { flex: 1 },
  aiToggleTitle: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.textPrimary },
  aiToggleSubtitle: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
  },
  swipeHintText: { fontSize: 11, color: Colors.textMuted },

  listContent: { paddingBottom: 100 },

  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.glass,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  conversationUnread: {
    borderColor: 'rgba(200,16,46,0.3)',
    backgroundColor: 'rgba(200,16,46,0.05)',
  },

  avatarContainer: { position: 'relative', marginRight: 12 },
  avatar: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: Colors.textPrimary, fontSize: FontSizes.lg, fontWeight: '700' },
  onlineDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: Colors.brandRed,
    borderWidth: 2, borderColor: Colors.background,
  },
  aiBadge: {
    position: 'absolute', top: -2, right: -2,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.success,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: Colors.background,
  },

  conversationContent: { flex: 1 },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 6 },
  clientName: { fontSize: FontSizes.md, color: Colors.textPrimary, fontWeight: '500' },
  clientNameBold: { fontWeight: '700' },
  webBadge: {
    backgroundColor: 'rgba(139,92,246,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  timestamp: { fontSize: FontSizes.xs, color: Colors.textMuted, marginLeft: 8 },
  
  propertyAddress: {
    fontSize: 11, color: Colors.textMuted, marginTop: 2,
  },

  messageRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  lastMessage: { flex: 1, fontSize: FontSizes.sm, color: Colors.textSecondary },
  lastMessageBold: { color: Colors.textPrimary, fontWeight: '600' },

  unreadBadge: {
    backgroundColor: Colors.brandRed,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: BorderRadius.full, marginLeft: 8,
  },
  unreadText: { color: Colors.textPrimary, fontSize: 11, fontWeight: '700' },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 20,
    backgroundColor: Colors.glass,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: FontSizes.lg, fontWeight: '600', color: Colors.textMuted },
  emptySubtitle: { fontSize: FontSizes.sm, color: Colors.textDim, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },
});
