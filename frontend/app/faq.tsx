import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useColors } from '../src/constants/theme';
import { Config } from '../src/constants/config';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const API = Config.API_URL;

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  rentals: 'home-outline',
  payments: 'card-outline',
  maintenance: 'construct-outline',
  market: 'storefront-outline',
  general: 'help-circle-outline',
};

const CATEGORY_LABELS_ES: Record<string, string> = {
  rentals: 'Rentas',
  payments: 'Pagos',
  maintenance: 'Mantenimiento',
  market: 'Mercado',
  general: 'General',
};

const CATEGORY_LABELS_EN: Record<string, string> = {
  rentals: 'Rentals',
  payments: 'Payments',
  maintenance: 'Maintenance',
  market: 'Market',
  general: 'General',
};

export default function FAQScreen() {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const lang = i18n.language || 'es';

  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categoryLabels = lang === 'en' ? CATEGORY_LABELS_EN : CATEGORY_LABELS_ES;

  const fetchFaqs = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/public/faqs?lang=${lang}`);
      const data = await res.json();
      if (data.status === 'success') {
        setFaqs(data.faqs || []);
      }
    } catch (e) {
      console.error('FAQ fetch error:', e);
    }
    setLoading(false);
    setRefreshing(false);
  }, [lang]);

  useEffect(() => { fetchFaqs(); }, [fetchFaqs]);

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(prev => prev === id ? null : id);
  };

  const categories = ['all', ...Array.from(new Set(faqs.map(f => f.category)))];
  const filtered = selectedCategory === 'all' ? faqs : faqs.filter(f => f.category === selectedCategory);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {lang === 'en' ? 'Frequently Asked Questions' : 'Preguntas Frecuentes'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterContent}
      >
        {categories.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.filterChip, selectedCategory === cat && styles.filterChipActive]}
            onPress={() => setSelectedCategory(cat)}
          >
            <Ionicons
              name={(CATEGORY_ICONS[cat] || 'apps-outline') as any}
              size={14}
              color={selectedCategory === cat ? '#fff' : C.textDim}
            />
            <Text style={[styles.filterText, selectedCategory === cat && styles.filterTextActive]}>
              {cat === 'all' ? (lang === 'en' ? 'All' : 'Todas') : (categoryLabels[cat] || cat)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* FAQ List */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={C.brandRed} />
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchFaqs(); }} tintColor={C.brandRed} />
          }
        >
          {filtered.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="help-buoy-outline" size={48} color={C.textDim} />
              <Text style={styles.emptyText}>
                {lang === 'en' ? 'No FAQs available yet' : 'Aún no hay preguntas frecuentes'}
              </Text>
            </View>
          ) : (
            filtered.map((faq) => {
              const isExpanded = expandedId === faq.id;
              return (
                <TouchableOpacity
                  key={faq.id}
                  style={[styles.faqCard, isExpanded && styles.faqCardExpanded]}
                  onPress={() => toggleExpand(faq.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.faqHeader}>
                    <Ionicons
                      name={(CATEGORY_ICONS[faq.category] || 'help-circle-outline') as any}
                      size={20}
                      color={C.brandRed}
                      style={styles.faqIcon}
                    />
                    <Text style={styles.faqQuestion}>{faq.question}</Text>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={C.textDim}
                    />
                  </View>
                  {isExpanded && (
                    <View style={styles.faqAnswerWrap}>
                      <View style={styles.divider} />
                      <Text style={styles.faqAnswer}>{faq.answer}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}

          {/* Contact CTA */}
          <View style={styles.contactCard}>
            <Ionicons name="chatbubbles-outline" size={28} color={C.brandRed} />
            <Text style={styles.contactTitle}>
              {lang === 'en' ? "Didn't find your answer?" : '¿No encontraste tu respuesta?'}
            </Text>
            <Text style={styles.contactDesc}>
              {lang === 'en' ? 'Contact us and we\'ll help you' : 'Contáctanos y te ayudaremos'}
            </Text>
            <View style={styles.contactRow}>
              <TouchableOpacity style={styles.contactBtn}>
                <Ionicons name="call-outline" size={16} color="#fff" />
                <Text style={styles.contactBtnText}>(806) 934-2018</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.contactBtn, styles.contactBtnAlt]}>
                <Ionicons name="mail-outline" size={16} color={C.brandRed} />
                <Text style={[styles.contactBtnText, { color: C.brandRed }]}>Email</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: C.glassLight,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { color: C.textPrimary, fontSize: 18, fontWeight: '800' },
  filterRow: { maxHeight: 48, marginBottom: 8 },
  filterContent: { paddingHorizontal: 16, gap: 8 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
    backgroundColor: C.glass,
    borderWidth: 1, borderColor: C.glassBorder,
  },
  filterChipActive: {
    backgroundColor: C.brandRed, borderColor: C.brandRed,
  },
  filterText: { color: C.textDim, fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: C.textPrimary },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 8 },
  emptyWrap: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { color: C.textDim, fontSize: 14 },
  faqCard: {
    backgroundColor: C.glass,
    borderRadius: 16, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: C.glassBorder,
  },
  faqCardExpanded: {
    borderColor: 'rgba(200,16,46,0.3)',
    backgroundColor: 'rgba(200,16,46,0.04)',
  },
  faqHeader: { flexDirection: 'row', alignItems: 'center' },
  faqIcon: { marginRight: 12 },
  faqQuestion: {
    flex: 1, color: C.textPrimary, fontSize: 14, fontWeight: '700', lineHeight: 20,
  },
  faqAnswerWrap: { marginTop: 12 },
  divider: {
    height: 1, backgroundColor: C.glassLight, marginBottom: 12,
  },
  faqAnswer: {
    color: C.textSecondary, fontSize: 13, lineHeight: 20,
    paddingLeft: 32,
  },
  contactCard: {
    backgroundColor: C.glass,
    borderRadius: 16, padding: 24, marginTop: 16,
    alignItems: 'center', borderWidth: 1,
    borderColor: C.glassBorder,
  },
  contactTitle: { color: C.textPrimary, fontSize: 16, fontWeight: '800', marginTop: 12 },
  contactDesc: { color: C.textDim, fontSize: 13, marginTop: 4 },
  contactRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  contactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.brandRed, paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 12,
  },
  contactBtnAlt: {
    backgroundColor: 'transparent',
    borderWidth: 1, borderColor: C.brandRed,
  },
  contactBtnText: { color: C.textPrimary, fontSize: 13, fontWeight: '700' },
});
