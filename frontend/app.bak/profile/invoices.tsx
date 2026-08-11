import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, API_URL } from '../../src/constants/theme';

export default function InvoicesScreen() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { fetchInvoices(); }, []);

  const fetchInvoices = async () => {
    try {
      const res = await fetch(`${API_URL}/api/loans/my-invoices`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices || []);
      }
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  const formatDate = (d: string) => {
    if (!d) return '\u2014';
    return new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <>
      <Stack.Screen options={{ title: t('invoices.title') }} />
      <SafeAreaView style={S.container} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={S.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchInvoices(); }} tintColor={Colors.primaryLight} />}
        >
          {loading ? (
            <ActivityIndicator color={Colors.primaryLight} size="large" style={{ marginTop: 40 }} />
          ) : invoices.length === 0 ? (
            <View style={S.emptyState}>
              <View style={S.emptyIcon}>
                <Ionicons name="document-text-outline" size={48} color={Colors.textMuted} />
              </View>
              <Text style={S.emptyTitle}>{t('invoices.empty')}</Text>
              <Text style={S.emptyText}>{t('invoices.emptyDesc')}</Text>
            </View>
          ) : (
            invoices.map((inv, idx) => (
              <TouchableOpacity key={inv._id || idx} style={S.invoiceCard} activeOpacity={0.7}>
                <View style={S.invoiceIcon}>
                  <Ionicons name="document-text" size={22} color={Colors.primaryLight} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={S.invoiceNumber}>{t('invoices.invoice')} #{inv.number || idx + 1}</Text>
                  <Text style={S.invoiceDate}>{formatDate(inv.date || inv.created_at)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={S.invoiceAmount}>${inv.amount?.toFixed(2) || '0.00'}</Text>
                  <Text style={[S.invoiceStatus, { color: inv.paid ? '#10B981' : '#F59E0B' }]}>
                    {inv.paid ? t('invoices.paid') : t('invoices.pending')}
                  </Text>
                </View>
              </TouchableOpacity>
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
  invoiceCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card,
    borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: Colors.border,
  },
  invoiceIcon: {
    width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(5, 150, 105, 0.1)',
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  invoiceNumber: { fontSize: 15, fontWeight: '600', color: Colors.text },
  invoiceDate: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  invoiceAmount: { fontSize: 16, fontWeight: '700', color: Colors.text },
  invoiceStatus: { fontSize: 12, fontWeight: '600', marginTop: 2 },
});
