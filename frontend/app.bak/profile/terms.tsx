import React, { useState, useEffect } from 'react';
import { Text, StyleSheet, ScrollView, ActivityIndicator, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import RenderHtml from 'react-native-render-html';
import { Colors } from '../../src/constants/theme';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL
  || process.env.EXPO_PUBLIC_API_URL
  || 'https://www.rosslending.com/api';

export default function TermsScreen() {
  const { t, i18n } = useTranslation();
  const { width } = useWindowDimensions();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchTerms();
  }, [i18n.language]);

  const fetchTerms = async () => {
    setLoading(true);
    setError(false);
    try {
      const lang = i18n.language || 'es';
      const r = await fetch(`${API_URL}/legal?slug=terms&lang=${lang}`);
      if (r.ok) {
        const data = await r.json();
        setContent(data.content || '');
      } else {
        setError(true);
      }
    } catch (e) {
      console.error('Error fetching terms:', e);
      setError(true);
    }
    setLoading(false);
  };

  const tagsStyles = {
    h2: { fontSize: 20, fontWeight: '800' as const, color: Colors.text, marginBottom: 8 },
    h3: { fontSize: 16, fontWeight: '700' as const, color: Colors.text, marginTop: 20, marginBottom: 8 },
    h4: { fontSize: 14, fontWeight: '600' as const, color: Colors.text, marginTop: 12, marginBottom: 6 },
    p: { fontSize: 13, color: Colors.textSecondary, lineHeight: 21, marginBottom: 8 },
    li: { fontSize: 13, color: Colors.textSecondary, lineHeight: 21 },
    strong: { color: Colors.text, fontWeight: '700' as const },
    table: { marginVertical: 8 },
    th: { fontSize: 11, fontWeight: '700' as const, color: Colors.text, padding: 6, backgroundColor: Colors.surface },
    td: { fontSize: 11, color: Colors.textSecondary, padding: 6 },
  };

  return (
    <>
      <Stack.Screen options={{ title: t('terms.title', 'Términos y Condiciones') }} />
      <SafeAreaView style={S.container} edges={['bottom']}>
        {loading ? (
          <View style={S.center}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={S.loadingText}>{t('common.loading', 'Cargando...')}</Text>
          </View>
        ) : error ? (
          <ScrollView contentContainerStyle={S.scroll}>
            <Text style={S.heading}>{t('termsContent.heading', 'Terms and Conditions of Service')}</Text>
            <Text style={S.date}>{t('termsContent.updated', 'Last updated: January 2026')}</Text>
            <Text style={S.body}>{t('termsContent.s1b', 'By using the Ross Lending Solutions LLC mobile application, you agree to these Terms and Conditions.')}</Text>
            <Text style={S.body}>{t('common.errorLoading', 'No se pudo cargar la versión completa. Intente de nuevo más tarde.')}</Text>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={S.scroll}>
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
  heading: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  date: { fontSize: 12, color: Colors.textMuted, marginBottom: 24 },
  body: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22, marginTop: 12 },
});
