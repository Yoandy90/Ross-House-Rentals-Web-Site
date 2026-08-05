/**
 * System Logs Screen
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';

export default function LogsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      const response = await api.get('/admin/logs?limit=100');
      setLogs(response.data.logs || []);
    } catch (error) {
      console.error('Error loading logs:', error);
      setLogs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getLogColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'error': return '#EF4444';
      case 'warning': return '#F59E0B';
      case 'info': return '#3B82F6';
      default: return '#6B7280';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C1110" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1F2937', '#374151']}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Ionicons name="terminal" size={24} color="#FFF" />
            <Text style={styles.headerTitle}>Logs del Sistema</Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={loadLogs}>
            <Ionicons name="refresh" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <FlatList
        data={logs}
        keyExtractor={(item, index) => item.id || index.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadLogs} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>No hay logs disponibles</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.logItem}>
            <View style={[styles.levelBadge, { backgroundColor: getLogColor(item.level) }]}>
              <Text style={styles.levelText}>{item.level?.toUpperCase() || 'LOG'}</Text>
            </View>
            <View style={styles.logContent}>
              <Text style={styles.logMessage} numberOfLines={2}>{item.message}</Text>
              <Text style={styles.logTime}>{item.timestamp || item.created_at}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingBottom: 16, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  headerContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  refreshBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16 },
  logItem: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 12, padding: 12, marginBottom: 8, alignItems: 'center' },
  levelBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginRight: 12 },
  levelText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  logContent: { flex: 1 },
  logMessage: { fontSize: 14, color: '#1F2937' },
  logTime: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: '#6B7280', marginTop: 16 },
});
