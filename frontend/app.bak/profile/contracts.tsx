import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, API_URL } from '../../src/constants/theme';

export default function ContractsScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith('es') ? 'es' : 'en';
  const { token } = useAuth();
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => { fetchContracts(); }, []);

  const fetchContracts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/loans/my-contracts`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setContracts(data.contracts || []);
      }
    } catch (e) {
      console.log('Error fetching contracts:', e);
    }
    setLoading(false);
  };

  const handleDownload = async (contract: any) => {
    const loanId = contract._id;
    if (!loanId) return;

    setDownloadingId(loanId);
    try {
      // Pass token + lang as query params
      const downloadUrl = `${API_URL}/api/loans/my-contracts/${loanId}/download?token=${encodeURIComponent(token)}&lang=${lang}`;
      const suffix = lang === 'es' ? 'ES' : 'EN';
      const filename = `Contrato_${contract.loan_number || 'RLS'}_${suffix}.pdf`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;

      const downloadResult = await FileSystem.downloadAsync(downloadUrl, fileUri);

      if (downloadResult.status !== 200) {
        console.log('Contract download failed:', downloadResult.status);
        Alert.alert(t('common.error', 'Error'), `Error ${downloadResult.status}: ${t('contract.couldNotDownload', 'Could not download contract.')}`);
        return;
      }

      // Share the PDF
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          dialogTitle: `Contrato ${contract.loan_number}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert(t('contract.downloaded', 'Downloaded'), t('contract.savedOk', 'Contract saved successfully.'));
      }
    } catch (e: any) {
      console.log('Download error:', e?.message || e);
      Alert.alert(t('common.error', 'Error'), t('contract.tryAgain', 'Could not download contract. Try again.'));
    } finally {
      setDownloadingId(null);
    }
  };

  const formatDate = (d: string) => {
    if (!d) return '\u2014';
    return new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#34D399';
      case 'paid_off': return '#60A5FA';
      case 'defaulted': return '#F87171';
      default: return Colors.textMuted;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return t('loanStatus.active', 'Active');
      case 'paid_off': return t('loanStatus.paidOff', 'Paid Off');
      case 'defaulted': return 'En mora';
      default: return status;
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t('contracts.title') || 'Contratos' }} />
      <SafeAreaView style={S.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={S.scroll}>
          {loading ? (
            <ActivityIndicator color={Colors.primaryLight} size="large" style={{ marginTop: 40 }} />
          ) : contracts.length === 0 ? (
            <View style={S.emptyState}>
              <View style={S.emptyIcon}>
                <Ionicons name="folder-open-outline" size={48} color={Colors.textMuted} />
              </View>
              <Text style={S.emptyTitle}>{t('contracts.empty') || 'Sin contratos'}</Text>
              <Text style={S.emptyText}>{t('contracts.emptyDesc') || 'No tienes contratos de préstamo aún.'}</Text>
            </View>
          ) : (
            contracts.map((c, idx) => {
              const isDownloading = downloadingId === c._id;
              const isSigned = c.has_contract || c.status === 'signed';
              return (
                <View key={c._id || idx} style={S.contractCard}>
                  <TouchableOpacity 
                    style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                    activeOpacity={0.7}
                    onPress={() => router.push({ pathname: '/loan/sign-contract', params: { loanId: c._id } })}
                  >
                    <View style={S.contractIcon}>
                      <Ionicons name="document-attach" size={22} color={Colors.primaryLight} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={S.contractTitle}>{c.title || `Contrato #${c.loan_number || idx + 1}`}</Text>
                      <Text style={S.contractDate}>Firmado: {formatDate(c.signed_date || c.created_at)}</Text>
                      <View style={S.metaRow}>
                        <Text style={S.contractAmount}>Monto: ${c.amount?.toLocaleString() || '\u2014'}</Text>
                        <View style={[S.statusBadge, { backgroundColor: getStatusColor(c.status) + '20' }]}>
                          <View style={[S.statusDot, { backgroundColor: getStatusColor(c.status) }]} />
                          <Text style={[S.statusText, { color: getStatusColor(c.status) }]}>
                            {getStatusLabel(c.status)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                  
                  {/* Action buttons */}
                  <View style={S.actionCol}>
                    <TouchableOpacity 
                      style={S.actionBtn}
                      onPress={() => router.push({ pathname: '/loan/sign-contract', params: { loanId: c._id } })}
                    >
                      <Ionicons name={isSigned ? "checkmark-circle" : "create-outline"} size={18} color={isSigned ? "#34D399" : "#F59E0B"} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={S.actionBtn}
                      onPress={() => handleDownload(c)}
                      disabled={isDownloading}
                    >
                      {isDownloading ? (
                        <ActivityIndicator size="small" color={Colors.primaryLight} />
                      ) : (
                        <Ionicons name="download-outline" size={18} color={Colors.primaryLight} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
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
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  contractCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card,
    borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: Colors.border,
  },
  contractIcon: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(5, 150, 105, 0.1)',
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  contractTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  contractDate: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 10 },
  contractAmount: { fontSize: 13, color: Colors.primaryLight, fontWeight: '600' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  statusText: { fontSize: 10, fontWeight: '700' },
  actionCol: { gap: 8, alignItems: 'center' },
  actionBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(5,150,105,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  downloadBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(5, 150, 105, 0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
});
