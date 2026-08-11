import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, API_URL } from '../../src/constants/theme';

export default function PaymentHistoryScreen() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { fetchPayments(); }, []);

  const fetchPayments = async () => {
    try {
      const res = await fetch(`${API_URL}/api/loans/my-payments`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPayments(data.payments || []);
      }
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  const formatDate = (d: string) => {
    if (!d) return '\u2014';
    return new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid': case 'completado': return '#10B981';
      case 'pending': case 'pendiente': return '#F59E0B';
      case 'late': case 'atrasado': return '#EF4444';
      default: return Colors.textMuted;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid': case 'completado': return t('paymentHistory.paid');
      case 'pending': case 'pendiente': return t('paymentHistory.pending');
      case 'late': case 'atrasado': return t('paymentHistory.late');
      default: return status || 'N/A';
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t('paymentHistory.title') }} />
      <SafeAreaView style={S.container} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={S.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPayments(); }} tintColor={Colors.primaryLight} />}
        >
          {loading ? (
            <ActivityIndicator color={Colors.primaryLight} size="large" style={{ marginTop: 40 }} />
          ) : payments.length === 0 ? (
            <View style={S.emptyState}>
              <View style={S.emptyIcon}>
                <Ionicons name="receipt-outline" size={48} color={Colors.textMuted} />
              </View>
              <Text style={S.emptyTitle}>{t('paymentHistory.empty')}</Text>
              <Text style={S.emptyText}>{t('paymentHistory.emptyDesc')}</Text>
            </View>
          ) : (
            payments.map((p, idx) => (
              <View key={p._id || idx} style={S.paymentCard}>
                <View style={S.paymentLeft}>
                  <View style={[S.statusDot, { backgroundColor: getStatusColor(p.status) }]} />
                  <View>
                    <Text style={S.paymentAmount}>${p.amount?.toFixed(2) || '0.00'}</Text>
                    <Text style={S.paymentDate}>{formatDate(p.date || p.payment_date)}</Text>
                  </View>
                </View>
                <View style={S.paymentRight}>
                  <Text style={[S.statusBadge, { color: getStatusColor(p.status) }]}>{getStatusLabel(p.status)}</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  emptyText: { fontSize: 14, color: Colors.textSecondary },
  paymentCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.card, borderRadius: 14, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  paymentLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  paymentAmount: { fontSize: 17, fontWeight: '700', color: Colors.text },
  paymentDate: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  paymentRight: {},
  statusBadge: { fontSize: 13, fontWeight: '600' },
});
