import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
  ActivityIndicator, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, API_URL } from '../src/constants/theme';
import { useAuth } from '../src/contexts/AuthContext';
import { useTranslation } from 'react-i18next';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ICON_MAP: Record<string, { name: string; bg: string }> = {
  loan_approved: { name: 'checkmark-circle', bg: '#059669' },
  loan_rejected: { name: 'close-circle', bg: '#EF4444' },
  loan_application: { name: 'document-text', bg: '#6366F1' },
  payment_reminder: { name: 'alarm', bg: '#F59E0B' },
  payment_received: { name: 'cash', bg: '#10B981' },
  payment_overdue: { name: 'warning', bg: '#EF4444' },
  document_request: { name: 'document-attach', bg: '#6366F1' },
  document_reminder: { name: 'documents', bg: '#8B5CF6' },
  document_approved: { name: 'document-text', bg: '#059669' },
  admin_message: { name: 'megaphone', bg: '#3B82F6' },
  chat_message: { name: 'chatbubble', bg: '#06B6D4' },
  system: { name: 'information-circle', bg: '#64748B' },
  welcome: { name: 'hand-left', bg: '#10B981' },
  lending_general: { name: 'briefcase', bg: '#3B82F6' },
  default: { name: 'notifications', bg: '#475569' },
};

function timeAgo(dateStr: string, t: any) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return t('notifInbox.now', 'now');
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return date.toLocaleDateString();
}

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }), [token]);

  const fetchNotifications = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      // Filter by ross_lending app to only show lending notifications
      const res = await fetch(`${API_URL}/api/notifications?app=ross_lending`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : (data.notifications || []);
        setNotifications(items);
      }
    } catch (e) {
      console.log('Error fetching notifications:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const markAsRead = async (notifId: string) => {
    try {
      await fetch(`${API_URL}/api/notifications/${notifId}/read`, {
        method: 'POST',
        headers: headers(),
      });
      setNotifications(prev =>
        prev.map(n => {
          const nId = n._id || n.id;
          return nId === notifId ? { ...n, is_read: true, read: true } : n;
        })
      );
    } catch (e) {
      console.log('Error marking as read:', e);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const getIsRead = (item: any) => item.is_read === true || item.read === true;
  const getMessage = (item: any) => item.message || item.body || '';
  const unreadCount = notifications.filter(n => !getIsRead(n)).length;

  const handlePress = (item: any) => {
    const notifId = item._id || item.id;
    const isUnread = !getIsRead(item);

    // Mark as read
    if (isUnread && notifId) markAsRead(notifId);

    // Toggle expand/collapse with animation
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(prev => prev === notifId ? null : notifId);
  };

  const handleNavigate = (item: any) => {
    if (item.type === 'chat_message') router.push('/chat' as any);
    else if (item.type?.includes('document')) router.push('/loan/application-status' as any);
    else if (item.type?.includes('loan') || item.type?.includes('payment')) router.push('/(tabs)/loans' as any);
  };

  const renderNotification = ({ item }: { item: any }) => {
    const iconInfo = ICON_MAP[item.type] || ICON_MAP.default;
    const notifId = item._id || item.id;
    const isUnread = !getIsRead(item);
    const isExpanded = expandedId === notifId;
    const message = getMessage(item);

    return (
      <TouchableOpacity
        style={[S.notifCard, isUnread && S.notifCardUnread]}
        activeOpacity={0.7}
        onPress={() => handlePress(item)}
      >
        <View style={[S.notifIcon, { backgroundColor: iconInfo.bg + '20' }]}>
          <Ionicons name={iconInfo.name as any} size={22} color={iconInfo.bg} />
        </View>
        <View style={S.notifContent}>
          <View style={S.notifHeader}>
            <Text style={[S.notifTitle, isUnread && S.notifTitleUnread]}>
              {item.title || t('notifInbox.noTitle', 'Notification')}
            </Text>
            <Text style={S.notifTime}>{timeAgo(item.created_at, t)}</Text>
          </View>
          {message ? (
            <Text style={S.notifMessage} numberOfLines={isExpanded ? undefined : 3}>
              {message}
            </Text>
          ) : null}
          {isExpanded && (
            <TouchableOpacity
              style={S.viewDetailBtn}
              onPress={() => handleNavigate(item)}
            >
              <Text style={S.viewDetailText}>{t('notifInbox.viewDetail', 'View details')}</Text>
              <Ionicons name="chevron-forward" size={14} color={Colors.primaryLight} />
            </TouchableOpacity>
          )}
        </View>
        {isUnread && <View style={S.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={S.container} edges={['top']}>
      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={S.headerTitle}>{t('notifInbox.title', 'Notifications')}</Text>
        <View style={S.headerRight}>
          {unreadCount > 0 && (
            <View style={S.badge}>
              <Text style={S.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </View>
      </View>

      {loading ? (
        <View style={S.center}>
          <ActivityIndicator size="large" color={Colors.primaryLight} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={S.center}>
          <View style={S.emptyIconContainer}>
            <Ionicons name="notifications-off-outline" size={48} color={Colors.primaryLight} />
          </View>
          <Text style={S.emptyTitle}>{t('notifInbox.empty', 'No notifications yet')}</Text>
          <Text style={S.emptyDesc}>
            {t('notifInbox.emptyDesc', 'Loan updates, payment reminders, and messages will appear here.')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item, idx) => item._id || item.id || String(idx)}
          renderItem={renderNotification}
          contentContainerStyle={S.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchNotifications(true)}
              tintColor={Colors.primaryLight}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 40 },
  badge: {
    backgroundColor: '#EF4444', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2,
    minWidth: 22, alignItems: 'center',
  },
  badgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIconContainer: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginTop: 4 },
  emptyDesc: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },
  notifCard: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  notifCardUnread: {
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
    borderColor: 'rgba(16, 185, 129, 0.15)',
  },
  notifIcon: {
    width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  notifContent: { flex: 1, marginLeft: 12 },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  notifTitle: {
    fontSize: 14, fontWeight: '600', color: Colors.textSecondary,
    flex: 1, marginRight: 8,
  },
  notifTitleUnread: { color: Colors.text, fontWeight: '700' },
  notifTime: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  notifMessage: {
    fontSize: 13, color: Colors.textMuted, marginTop: 4, lineHeight: 19,
  },
  viewDetailBtn: {
    flexDirection: 'row', alignItems: 'center', marginTop: 10,
    paddingVertical: 6, paddingHorizontal: 12,
    backgroundColor: 'rgba(52, 211, 153, 0.1)', borderRadius: 8,
    alignSelf: 'flex-start',
  },
  viewDetailText: {
    fontSize: 12, fontWeight: '600', color: Colors.primaryLight, marginRight: 4,
  },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', marginLeft: 6,
    marginTop: 6,
  },
});
