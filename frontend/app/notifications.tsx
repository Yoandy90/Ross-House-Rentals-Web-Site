import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { apiCall } from '../src/utils/api';
import {
  addNotificationReceivedListener,
} from '../src/utils/pushNotifications';
import { Spacing, FontSizes, BorderRadius, Shadows, useColors } from '../src/constants/theme';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  data: any;
  created_at: string;
}

export default function NotificationsScreen() {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const lang = i18n.language;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await apiCall('/marketplace/notifications?limit=50');
      if (data.success) {
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.log('Error fetching notifications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const sub = addNotificationReceivedListener(() => {
      fetchNotifications();
    });
    return () => sub.remove();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, []);

  const markAsRead = async (notifId: string) => {
    try {
      await apiCall(`/marketplace/notifications/${notifId}/read`, { method: 'POST' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.log('Error marking read:', err);
    }
  };

  const handleNotificationPress = (notif: Notification) => {
    if (!notif.read) {
      markAsRead(notif.id);
    }
    const type = notif.data?.type || notif.type;
    if (type === 'maintenance_new' || type === 'maintenance_update' || type === 'maintenance_alert') {
      router.push('/maintenance');
    } else if (type === 'payment_received') {
      router.push('/owner-dashboard');
    }
  };

  const getIcon = (type: string): { name: string; color: string; bg: string } => {
    switch (type) {
      case 'maintenance_new':
      case 'maintenance_alert':
        return { name: 'construct', color: C.warning, bg: C.warningBg };
      case 'maintenance_update':
        return { name: 'checkmark-circle', color: C.success, bg: C.successBg };
      case 'payment_received':
        return { name: 'card', color: C.success, bg: C.successBg };
      default:
        return { name: 'notifications', color: C.info, bg: C.infoBg };
    }
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return lang === 'es' ? 'Ahora' : 'Now';
      if (diffMins < 60) return lang === 'es' ? `Hace ${diffMins}m` : `${diffMins}m ago`;
      if (diffHours < 24) return lang === 'es' ? `Hace ${diffHours}h` : `${diffHours}h ago`;
      if (diffDays < 7) return lang === 'es' ? `Hace ${diffDays}d` : `${diffDays}d ago`;
      return date.toLocaleDateString(lang === 'es' ? 'es' : 'en');
    } catch {
      return '';
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const renderNotification = ({ item }: { item: Notification }) => {
    const icon = getIcon(item.data?.type || item.type);
    return (
      <TouchableOpacity
        style={[styles.notifCard, !item.read && styles.notifCardUnread]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        {/* Top accent for unread */}
        {!item.read && (
          <View style={[styles.cardAccent, { backgroundColor: icon.color }]} />
        )}
        {/* Corner orb */}
        {!item.read && (
          <View style={[styles.cornerOrb, { backgroundColor: icon.color }]} />
        )}

        <View style={styles.notifRow}>
          <View style={[styles.iconCircle, { backgroundColor: icon.bg }]}>
            <Ionicons name={icon.name as any} size={22} color={icon.color} />
          </View>
          <View style={styles.notifContent}>
            <Text
              style={[styles.notifTitle, !item.read && styles.notifTitleUnread]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Text style={styles.notifBody} numberOfLines={2}>
              {item.body}
            </Text>
            <Text style={styles.notifTime}>{formatTime(item.created_at)}</Text>
          </View>
          {!item.read && <View style={styles.unreadDot} />}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="notifications-off-outline" size={48} color={C.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>
        {lang === 'es' ? 'Sin Notificaciones' : 'No Notifications'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {lang === 'es'
          ? 'Recibirás alertas de mantenimiento, pagos y actualizaciones aquí'
          : 'You will receive maintenance, payment and update alerts here'}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={C.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {lang === 'es' ? 'Notificaciones' : 'Notifications'}
          </Text>
          {unreadCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <View style={{ width: 44 }} />
      </View>

      {/* Subtle header glow */}
      <LinearGradient
        colors={['rgba(200,16,46,0.06)', 'transparent']}
        style={styles.headerGlow}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={C.brandRed} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={notifications.length === 0 ? styles.emptyList : styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={C.brandRed}
              colors={[C.brandRed]}
            />
          }
        />
      )}
    </View>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '800',
    color: C.textPrimary,
    letterSpacing: -0.3,
  },
  headerBadge: {
    backgroundColor: C.brandRed,
    borderRadius: BorderRadius.full,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: C.white,
  },
  headerGlow: {
    height: 40,
    marginTop: -1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: Spacing.base,
    paddingTop: 4,
    paddingBottom: 40,
    gap: 10,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Notification Card
  notifCard: {
    backgroundColor: C.surface,
    borderRadius: BorderRadius.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    position: 'relative',
  },
  notifCardUnread: {
    backgroundColor: C.glassLight,
    borderColor: C.glassBorderLight,
    ...Shadows.subtle,
  },
  cardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2.5,
    borderTopLeftRadius: BorderRadius.card,
    borderTopRightRadius: BorderRadius.card,
  },
  cornerOrb: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 64,
    height: 64,
    borderRadius: 32,
    opacity: 0.08,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notifContent: {
    flex: 1,
  },
  notifTitle: {
    fontSize: FontSizes.base,
    fontWeight: '500',
    color: C.textSecondary,
    marginBottom: 2,
  },
  notifTitleUnread: {
    color: C.textPrimary,
    fontWeight: '700',
  },
  notifBody: {
    fontSize: FontSizes.sm,
    color: C.textSecondary,
    lineHeight: 18,
  },
  notifTime: {
    fontSize: FontSizes.xs,
    color: C.textMuted,
    marginTop: 4,
    fontWeight: '500',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.brandRed,
    marginLeft: 8,
    ...Shadows.glow(C.brandRed, 0.4),
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '800',
    color: C.textPrimary,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: FontSizes.sm,
    color: C.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
