import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, API_URL } from '../../src/constants/theme';

export default function LoanHistoryScreen() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => { fetchLoans(); }, []);

  const fetchLoans = async () => {
    try {
      const res = await fetch(`${API_URL}/api/loans/my-contracts`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const sorted = (data.contracts || []).sort((a: any, b: any) => {
          if (a.status === 'active' && b.status !== 'active') return -1;
          if (a.status !== 'active' && b.status === 'active') return 1;
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        });
        setLoans(sorted);
        // Auto-expand first active loan
        const firstActive = sorted.find((l: any) => l.status === 'active');
        if (firstActive) setExpandedId(firstActive._id);
      }
    } catch (e) {
      console.log('Fetch loans error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleDownloadContract = async (loan: any) => {
    setDownloadingId(loan._id);
    try {
      // Step 1: Fetch base64 PDF from backend
      const res = await fetch(`${API_URL}/api/loans/my-contracts/${loan._id}/download-base64`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        Alert.alert('Error', errData.detail || `Error del servidor (${res.status})`);
        return;
      }

      const data = await res.json();
      
      if (!data.pdf_base64) {
        Alert.alert('Error', t('loanHist.noPDF', 'Server did not return a PDF.'));
        return;
      }

      // Step 2: Clean base64 string (remove any whitespace/newlines)
      const cleanBase64 = data.pdf_base64.replace(/[\s\n\r]/g, '');
      const filename = data.filename || `Contrato_${loan.loan_number || 'RLS'}.pdf`;
      
      // Step 3: Ensure cache directory exists
      const cacheDir = FileSystem.cacheDirectory;
      if (!cacheDir) {
        Alert.alert('Error', 'No se pudo acceder al almacenamiento del dispositivo.');
        return;
      }
      
      const fileUri = `${cacheDir}${filename}`;

      // Step 4: Write base64 to file
      await FileSystem.writeAsStringAsync(fileUri, cleanBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Step 5: Verify file was written
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        Alert.alert(t('common.error', 'Error'), t('loanHist.couldNotSave', 'Could not save file.'));
        return;
      }

      // Step 6: Share/open the PDF
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          dialogTitle: `Contrato ${loan.loan_number}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('✅', `Contrato guardado: ${filename}`);
      }
    } catch (e: any) {
      console.log('Download contract error:', JSON.stringify(e));
      Alert.alert('Error', `No se pudo descargar: ${e?.message || 'Error desconocido'}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const formatCurrency = (n: number) => `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'active': return { label: t('loanStatus.active', 'Active'), color: '#10B981', bg: '#D1FAE5', icon: 'checkmark-circle' as const };
      case 'paid_off': return { label: t('loanStatus.paidOff', 'Paid Off'), color: '#3B82F6', bg: '#DBEAFE', icon: 'trophy' as const };
      case 'closed': return { label: t('loanStatus.closed', 'Closed'), color: '#6B7280', bg: '#F3F4F6', icon: 'lock-closed' as const };
      default: return { label: status, color: '#F59E0B', bg: '#FEF3C7', icon: 'time' as const };
    }
  };

  return (
    <View style={S.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={S.safeTop}>
        <View style={S.header}>
          <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
            <Ionicons name="chevron-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={S.headerTitle}>{t('profile.loanHistory')}</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primaryLight} style={{ marginTop: 60 }} />
      ) : loans.length === 0 ? (
        <View style={S.emptyState}>
          <Ionicons name="document-text-outline" size={56} color={Colors.textMuted} />
          <Text style={S.emptyTitle}>Sin préstamos</Text>
          <Text style={S.emptySub}>Aquí aparecerán tus préstamos y contratos</Text>
        </View>
      ) : (
        <ScrollView
          style={S.list}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchLoans(); }} tintColor={Colors.primaryLight} />
          }
        >
          {/* Summary Bar */}
          <View style={S.summaryBar}>
            <View style={S.summaryItem}>
              <Text style={S.summaryNum}>{loans.length}</Text>
              <Text style={S.summaryLabel}>Total</Text>
            </View>
            <View style={[S.summaryDot, { backgroundColor: '#10B981' }]} />
            <View style={S.summaryItem}>
              <Text style={S.summaryNum}>{loans.filter(l => l.status === 'active').length}</Text>
              <Text style={S.summaryLabel}>Activos</Text>
            </View>
            <View style={[S.summaryDot, { backgroundColor: '#3B82F6' }]} />
            <View style={S.summaryItem}>
              <Text style={S.summaryNum}>{loans.filter(l => l.status === 'paid_off').length}</Text>
              <Text style={S.summaryLabel}>Pagados</Text>
            </View>
          </View>

          {/* Loans */}
          {loans.map((loan) => {
            const isExpanded = expandedId === loan._id;
            const status = getStatusInfo(loan.status);
            const isActive = loan.status === 'active';
            const progress = loan.amount > 0 ? (((loan.amount - (loan.balance || 0)) / loan.amount) * 100) : 0;

            return (
              <TouchableOpacity
                key={loan._id}
                activeOpacity={0.8}
                onPress={() => setExpandedId(isExpanded ? null : loan._id)}
                style={[S.loanCard, isActive && S.loanCardActive]}
              >
                {/* Active badge */}
                {isActive && (
                  <View style={S.activeBadge}>
                    <View style={S.activeDot} />
                    <Text style={S.activeLabel}>PRÉSTAMO ACTIVO</Text>
                  </View>
                )}

                {/* Loan Header */}
                <View style={S.loanHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={S.loanNumber}>{loan.loan_number}</Text>
                    <Text style={S.loanDate}>{formatDate(loan.created_at)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={S.loanAmount}>{formatCurrency(loan.amount)}</Text>
                    <View style={[S.statusBadge, { backgroundColor: status.bg }]}>
                      <Ionicons name={status.icon} size={12} color={status.color} />
                      <Text style={[S.statusText, { color: status.color }]}>{status.label}</Text>
                    </View>
                  </View>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={Colors.textMuted}
                    style={{ marginLeft: 8 }}
                  />
                </View>

                {/* Progress Bar */}
                {isActive && (
                  <View style={S.progressWrap}>
                    <View style={S.progressTrack}>
                      <View style={[S.progressFill, { width: `${Math.min(progress, 100)}%` }]} />
                    </View>
                    <Text style={S.progressText}>{progress.toFixed(0)}% pagado</Text>
                  </View>
                )}

                {/* Expanded Details */}
                {isExpanded && (
                  <View style={S.details}>
                    <View style={S.detailGrid}>
                      <View style={S.detailItem}>
                        <Text style={S.detailLabel}>Monto Prestado</Text>
                        <Text style={S.detailValue}>{formatCurrency(loan.amount)}</Text>
                      </View>
                      <View style={S.detailItem}>
                        <Text style={S.detailLabel}>Balance</Text>
                        <Text style={S.detailValue}>{formatCurrency(loan.balance)}</Text>
                      </View>
                      <View style={S.detailItem}>
                        <Text style={S.detailLabel}>Tasa</Text>
                        <Text style={S.detailValue}>{loan.interest_rate}%</Text>
                      </View>
                      <View style={S.detailItem}>
                        <Text style={S.detailLabel}>Plazo</Text>
                        <Text style={S.detailValue}>{loan.term_months} meses</Text>
                      </View>
                      <View style={S.detailItem}>
                        <Text style={S.detailLabel}>Pago Mensual</Text>
                        <Text style={S.detailValue}>{formatCurrency(loan.monthly_payment)}</Text>
                      </View>
                      <View style={S.detailItem}>
                        <Text style={S.detailLabel}>Total a Pagar</Text>
                        <Text style={S.detailValue}>{formatCurrency(loan.total_to_pay)}</Text>
                      </View>
                    </View>

                    {/* Contract Download Button */}
                    <TouchableOpacity
                      style={S.contractBtn}
                      onPress={() => handleDownloadContract(loan)}
                      disabled={downloadingId === loan._id}
                      activeOpacity={0.7}
                    >
                      {downloadingId === loan._id ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <>
                          <Ionicons name="document-text" size={18} color="#fff" />
                          <Text style={S.contractBtnText}>Ver Contrato</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    {/* Payment History Link */}
                    <TouchableOpacity
                      style={S.historyLink}
                      onPress={() => router.push('/profile/payment-history')}
                    >
                      <Ionicons name="time-outline" size={16} color={Colors.primaryLight} />
                      <Text style={S.historyLinkText}>Ver Historial de Pagos</Text>
                      <Ionicons name="chevron-forward" size={14} color={Colors.primaryLight} />
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  safeTop: { backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: Colors.text },
  list: { flex: 1, paddingHorizontal: 16 },

  // Summary
  summaryBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.card, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20,
    marginBottom: 16, gap: 16,
  },
  summaryItem: { alignItems: 'center' },
  summaryNum: { fontSize: 20, fontWeight: '800', color: Colors.text },
  summaryLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  summaryDot: { width: 6, height: 6, borderRadius: 3 },

  // Loan Card
  loanCard: {
    backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  loanCardActive: {
    borderColor: '#10B98140', borderWidth: 1.5,
    ...Platform.select({
      ios: { shadowColor: '#10B981', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12 },
      android: { elevation: 4 },
    }),
  },

  // Active badge
  activeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10,
  },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  activeLabel: { fontSize: 10, fontWeight: '800', color: '#10B981', letterSpacing: 1 },

  // Loan header
  loanHeader: { flexDirection: 'row', alignItems: 'center' },
  loanNumber: { fontSize: 15, fontWeight: '700', color: Colors.text },
  loanDate: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  loanAmount: { fontSize: 20, fontWeight: '800', color: Colors.text },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 4,
  },
  statusText: { fontSize: 11, fontWeight: '700' },

  // Progress
  progressWrap: { marginTop: 12 },
  progressTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#10B981', borderRadius: 3 },
  progressText: { fontSize: 11, color: Colors.textMuted, marginTop: 4, textAlign: 'right' },

  // Details
  details: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 0 },
  detailItem: { width: '50%', marginBottom: 12 },
  detailLabel: { fontSize: 11, color: Colors.textMuted },
  detailValue: { fontSize: 15, fontWeight: '700', color: Colors.text, marginTop: 2 },

  // Contract button
  contractBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#10B981', borderRadius: 12, paddingVertical: 14, marginTop: 4,
  },
  contractBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // History link
  historyLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, marginTop: 6,
  },
  historyLinkText: { fontSize: 14, fontWeight: '600', color: Colors.primaryLight },

  // Empty
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginTop: 12 },
  emptySub: { fontSize: 14, color: Colors.textMuted, marginTop: 4 },
});
