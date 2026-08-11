import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSizes, BorderRadius, useColors } from '../../src/constants/theme';
import { apiCall } from '../../src/utils/api';

export default function PrivacyScreen() {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState('');

  useEffect(() => {
    loadPrivacy();
  }, [i18n.language]);

  const loadPrivacy = async () => {
    setLoading(true);
    try {
      const data = await apiCall('/public/legal-documents', { auth: false });
      if (data.success) {
        const lang = i18n.language === 'es' ? 'es' : 'en';
        setContent(data[`privacy_${lang}`] || '');
        setUpdatedAt(data.updated_at || '');
      }
    } catch (e) {
      console.error('Error loading privacy:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('profile.privacy')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={C.brandRed} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <MarkdownRenderer content={content} />
          {updatedAt ? (
            <Text style={styles.updatedAt}>
              {t('legal.last_updated')}: {new Date(updatedAt).toLocaleDateString(i18n.language === 'es' ? 'es-US' : 'en-US')}
            </Text>
          ) : null}
          <View style={{ height: 60 }} />
        </ScrollView>
      )}
    </View>
  );
}

function MarkdownRenderer({ content }: { content: string }) {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  if (!content) return null;
  const lines = content.split('\n');

  return (
    <View>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <View key={i} style={{ height: 8 }} />;

        if (trimmed.startsWith('# ')) {
          return <Text key={i} style={styles.h1}>{trimmed.replace(/^# /, '')}</Text>;
        }
        if (trimmed.startsWith('## ')) {
          return <Text key={i} style={styles.h2}>{trimmed.replace(/^## /, '')}</Text>;
        }
        if (trimmed.startsWith('### ')) {
          return <Text key={i} style={styles.h3}>{trimmed.replace(/^### /, '')}</Text>;
        }
        if (trimmed.startsWith('- ')) {
          const text = trimmed.replace(/^- /, '');
          return (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.bulletText}>{renderBold(text)}</Text>
            </View>
          );
        }
        return <Text key={i} style={styles.paragraph}>{renderBold(trimmed)}</Text>;
      })}
    </View>
  );
}

function renderBold(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <Text key={i} style={{ fontWeight: '700' }}>{part}</Text>
        ) : (
          <Text key={i}>{part}</Text>
        )
      )}
    </>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: C.textPrimary },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { padding: Spacing.lg },
  h1: { fontSize: 24, fontWeight: '800', color: C.textPrimary, marginBottom: 8, marginTop: 4 },
  h2: { fontSize: 19, fontWeight: '700', color: C.brandRed, marginBottom: 6, marginTop: 20 },
  h3: { fontSize: 16, fontWeight: '700', color: C.textPrimary, marginBottom: 4, marginTop: 14 },
  paragraph: { fontSize: 15, color: C.textSecondary, lineHeight: 24 },
  bulletRow: { flexDirection: 'row', paddingLeft: 8, marginBottom: 4 },
  bullet: { fontSize: 15, color: C.brandRed, marginRight: 8, marginTop: 2 },
  bulletText: { flex: 1, fontSize: 15, color: C.textSecondary, lineHeight: 24 },
  updatedAt: {
    fontSize: 12, color: C.textMuted, textAlign: 'center',
    marginTop: 32, fontStyle: 'italic',
  },
});
