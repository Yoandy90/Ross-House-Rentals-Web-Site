import React, { useState, useEffect } from 'react';
import {
  Text, StyleSheet, ScrollView, ActivityIndicator,
  View, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import RenderHtml from 'react-native-render-html';
import { Colors } from '../../src/constants/theme';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL
  || process.env.EXPO_PUBLIC_API_URL
  || 'https://www.rosslending.com/api';

export default function LegalDocumentScreen() {
  const { t, i18n } = useTranslation();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ slug: string; title?: string }>();
  const slug = params.slug || '';
  const screenTitle = params.title || t('legal.document', 'Documento Legal');

  const [content, setContent] = useState('');
  const [docTitle, setDocTitle] = useState(screenTitle);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (slug) fetchDocument();
  }, [slug, i18n.language]);

  const fetchDocument = async () => {
    setLoading(true);
    setError(false);
    try {
      const lang = i18n.language || 'es';
      const r = await fetch(`${API_URL}/legal?slug=${slug}&lang=${lang}`);
      if (r.ok) {
        const data = await r.json();
        setContent(data.content || '');
        if (data.title) setDocTitle(data.title);
      } else {
        setError(true);
      }
    } catch (e) {
      console.error('Error fetching legal document:', e);
      setError(true);
    }
    setLoading(false);
  };

  const tagsStyles = {
    h1: { fontSize: 22, fontWeight: '800' as const, color: Colors.text, marginBottom: 10 },
    h2: { fontSize: 20, fontWeight: '800' as const, color: Colors.text, marginBottom: 8 },
    h3: { fontSize: 16, fontWeight: '700' as const, color: Colors.text, marginTop: 20, marginBottom: 8 },
    h4: { fontSize: 14, fontWeight: '600' as const, color: Colors.text, marginTop: 12, marginBottom: 6 },
    p: { fontSize: 13, color: Colors.textSecondary, lineHeight: 21, marginBottom: 8 },
    li: { fontSize: 13, color: Colors.textSecondary, lineHeight: 21 },
    strong: { color: Colors.text, fontWeight: '700' as const },
    a: { color: Colors.primaryLight, textDecorationLine: 'underline' as const },
    table: { marginVertical: 8 },
    th: { fontSize: 11, fontWeight: '700' as const, color: Colors.text, padding: 6, backgroundColor: Colors.surface },
    td: { fontSize: 11, color: Colors.textSecondary, padding: 6 },
  };

  return (
    <>
      <Stack.Screen options={{ title: docTitle }} />
      <SafeAreaView style={S.container} edges={['bottom']}>
        {loading ? (
          <View style={S.center}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={S.loadingText}>{t('common.loading', 'Cargando...')}</Text>
          </View>
        ) : error ? (
          <ScrollView contentContainerStyle={S.scroll}>
            <Text style={S.heading}>{docTitle}</Text>
            <Text style={S.body}>
              {t('common.errorLoading', 'No se pudo cargar la versión completa. Intente de nuevo más tarde.')}
            </Text>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>
            <RenderHtml
              contentWidth={width - 40}
              source={{ html: content }}
              tagsStyles={tagsStyles}
            />
          </ScrollView>
        )}
      </SafeAreaView>
    </>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: Colors.textMuted },
  heading: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 12 },
  body: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22, marginTop: 12 },
});
