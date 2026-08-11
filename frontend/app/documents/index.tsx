import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { apiCall } from '../../src/utils/api';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Spacing, FontSizes, BorderRadius, useColors } from '../../src/constants/theme';
import { formatDate } from '../../src/utils/formatters';

export default function DocumentsScreen() {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocs();
  }, []);

  const fetchDocs = async () => {
    try {
      const dash = await apiCall('/tenant/dashboard');
      const docs: any[] = [];
      if (dash.contract) {
        docs.push({
          id: 'contract-' + (dash.contract.id || '1'),
          type: 'contract',
          title: t('documents.rental_contract'),
          date: dash.contract.start_date,
          status: dash.contract.status || 'active',
        });
      }
      if (dash.payments) {
        dash.payments.slice(0, 5).forEach((p: any) => {
          docs.push({
            id: 'receipt-' + p.id,
            type: 'receipt',
            title: `${t('documents.receipt')} - ${p.period_month} ${p.period_year}`,
            date: p.payment_date,
            status: p.status,
          });
        });
      }
      setDocuments(docs);
    } catch (err) {
      console.log('Documents fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const typeConfig: Record<string, { icon: string; color: string }> = {
    contract: { icon: 'document-text', color: C.navyBlue },
    receipt: { icon: 'receipt', color: C.success },
    id: { icon: 'card', color: C.info },
    insurance: { icon: 'shield-checkmark', color: C.warmGold },
    other: { icon: 'folder', color: C.warmCharcoal },
  };

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('documents.title')}</Text>
      </View>

      {/* Info banner */}
      <Card accentColor={C.navyBlue} style={styles.infoBanner}>
        <View style={styles.infoRow}>
          <Ionicons name="shield-checkmark" size={24} color={C.navyBlue} />
          <View style={styles.infoText}>
            <Text style={styles.infoTitle}>{t('documents.secure_vault')}</Text>
            <Text style={styles.infoDesc}>{t('documents.secure_vault_desc')}</Text>
          </View>
        </View>
      </Card>

      {loading ? (
        <ActivityIndicator size="large" color={C.brandRed} style={{ marginTop: 40 }} />
      ) : documents.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="folder-open-outline" size={64} color={C.textMuted} />
          <Text style={styles.emptyTitle}>{t('documents.no_docs')}</Text>
          <Text style={styles.emptyDesc}>{t('documents.no_docs_desc')}</Text>
        </View>
      ) : (
        documents.map(doc => {
          const cfg = typeConfig[doc.type] || typeConfig.other;
          return (
            <TouchableOpacity key={doc.id} style={styles.docCard} activeOpacity={0.7}>
              <View style={[styles.cardAccent, { backgroundColor: cfg.color }]} />
              <View style={[styles.cornerOrb, { backgroundColor: cfg.color, opacity: 0.1 }]} />
              <View style={styles.docRow}>
                <View style={[styles.docIcon, { backgroundColor: `${cfg.color}18` }]}>
                  <Ionicons name={cfg.icon as any} size={22} color={cfg.color} />
                </View>
                <View style={styles.docInfo}>
                  <Text style={styles.docTitle}>{doc.title}</Text>
                  <Text style={styles.docDate}>{formatDate(doc.date, i18n.language)}</Text>
                </View>
                <Ionicons name="download-outline" size={20} color={C.textMuted} />
              </View>
            </TouchableOpacity>
          );
        })
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: Spacing.base },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: Spacing.md,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  title: { fontSize: FontSizes['2xl'], fontWeight: '700', color: C.textPrimary },
  infoBanner: { marginBottom: Spacing.lg },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoText: { flex: 1 },
  infoTitle: { fontSize: FontSizes.base, fontWeight: '600', color: C.textPrimary },
  infoDesc: { fontSize: FontSizes.xs, color: C.textMuted, marginTop: 2 },
  docCard: {
    backgroundColor: C.surface, borderRadius: BorderRadius.card,
    marginBottom: Spacing.sm, overflow: 'hidden',
    borderWidth: 1, borderColor: C.border, position: 'relative',
  },
  cardAccent: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
    borderTopLeftRadius: BorderRadius.card, borderTopRightRadius: BorderRadius.card,
  },
  cornerOrb: {
    position: 'absolute', top: -20, right: -20,
    width: 72, height: 72, borderRadius: 36,
  },
  docRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.base, gap: 12,
  },
  docIcon: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  docInfo: { flex: 1 },
  docTitle: { fontSize: FontSizes.base, fontWeight: '600', color: C.textPrimary },
  docDate: { fontSize: FontSizes.xs, color: C.textMuted, marginTop: 2 },
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: FontSizes.lg, color: C.textPrimary, fontWeight: '600', marginTop: 16 },
  emptyDesc: { fontSize: FontSizes.sm, color: C.textMuted, marginTop: 4, textAlign: 'center', maxWidth: 280 },
});
