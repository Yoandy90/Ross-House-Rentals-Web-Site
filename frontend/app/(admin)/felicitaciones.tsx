/**
 * Felicitaciones (Birthday/Holiday Greetings) Management
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';

export default function FelicitacionesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoSend, setAutoSend] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const response = await api.get('/admin/clients?limit=500');
      const clients = response.data.clients || [];
      const today = new Date();
      const upcoming = clients.filter((c: any) => {
        if (!c.birth_date) return false;
        const bday = new Date(c.birth_date);
        const thisYearBday = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
        const diff = (thisYearBday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 30;
      }).sort((a: any, b: any) => {
        const dateA = new Date(a.birth_date);
        const dateB = new Date(b.birth_date);
        return dateA.getMonth() * 31 + dateA.getDate() - (dateB.getMonth() * 31 + dateB.getDate());
      });
      setUpcomingBirthdays(upcoming);
    } catch (error) {
      console.error('Error:', error);
      setUpcomingBirthdays([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatBirthday = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#EC4899" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#EC4899', '#DB2777']}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Ionicons name="gift" size={24} color="#FFF" />
            <Text style={styles.headerTitle}>Felicitaciones</Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={loadData}>
            <Ionicons name="refresh" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{upcomingBirthdays.length}</Text>
            <Text style={styles.statLabel}>Próximos 30 días</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.settingsCard}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Ionicons name="mail" size={24} color="#EC4899" />
            <View>
              <Text style={styles.settingTitle}>Envío Automático</Text>
              <Text style={styles.settingDesc}>Enviar felicitaciones automáticamente</Text>
            </View>
          </View>
          <Switch value={autoSend} onValueChange={setAutoSend} trackColor={{ true: '#EC4899' }} />
        </View>
      </View>

      <Text style={styles.sectionTitle}>🎂 Próximos Cumpleaños</Text>

      <FlatList
        data={upcomingBirthdays}
        keyExtractor={(item) => item.id || item._id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="gift-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>No hay cumpleaños próximos</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.birthdayCard}>
            <LinearGradient colors={['#FDF2F8', '#FCE7F3']} style={styles.avatarGradient}>
              <Text style={styles.avatarText}>{(item.name || item.full_name || 'U').charAt(0)}</Text>
            </LinearGradient>
            <View style={styles.birthdayInfo}>
              <Text style={styles.birthdayName}>{item.name || item.full_name}</Text>
              <Text style={styles.birthdayDate}>
                <Ionicons name="calendar" size={12} color="#EC4899" /> {formatBirthday(item.birth_date)}
              </Text>
            </View>
            <TouchableOpacity style={styles.sendBtn}>
              <Ionicons name="send" size={18} color="#EC4899" />
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  refreshBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  statsRow: { alignItems: 'center' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 32, fontWeight: '800', color: '#FFF' },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  settingsCard: { backgroundColor: '#FFF', margin: 16, borderRadius: 16, padding: 16 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingTitle: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  settingDesc: { fontSize: 12, color: '#6B7280' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginHorizontal: 16, marginBottom: 8 },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  birthdayCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, padding: 14, marginBottom: 10 },
  avatarGradient: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 20, fontWeight: '700', color: '#EC4899' },
  birthdayInfo: { flex: 1 },
  birthdayName: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  birthdayDate: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  sendBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FDF2F8', justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: '#6B7280', marginTop: 16 },
});
