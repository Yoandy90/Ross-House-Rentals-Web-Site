import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../src/constants/theme';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL
  || process.env.EXPO_PUBLIC_API_URL
  || 'https://www.rosslending.com/api';

interface LegalDoc {
  _id: string;
  title: string;
  slug: string;
  version?: string;
  updated_at?: string;
}

// Icon mapping for known document slugs
const slugIconMap: Record<string, { name: string; color: string; bg: string }> = {
  terms: { name: 'document-text-outline', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
  privacy: { name: 'shield-checkmark-outline', color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)' },
  'fair-lending': { name: 'heart-outline', color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
  'state-disclosures': { name: 'flag-outline', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  'esign-disclosure': { name: 'create-outline', color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
  'aml-policy': { name: 'eye-outline', color: '#6366F1', bg: 'rgba(99,102,241,0.1)' },
  'ecoa': { name: 'people-outline', color: '#EC4899', bg: 'rgba(236,72,153,0.1)' },
  'tcpa': { name: 'call-outline', color: '#14B8A6', bg: 'rgba(20,184,166,0.1)' },
  'ccpa': { name: 'lock-closed-outline', color: '#F97316', bg: 'rgba(249,115,22,0.1)' },
  'glba': { name: 'business-outline', color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)' },
  'mla': { name: 'ribbon-outline', color: '#84CC16', bg: 'rgba(132,204,22,0.1)' },
  'tila': { name: 'cash-outline', color: '#A855F7', bg: 'rgba(168,85,247,0.1)' },
};

const getIconForSlug = (slug: string) => {
  return slugIconMap[slug] || { name: 'document-outline', color: Colors.primaryLight, bg: 'rgba(52,211,153,0.1)' };
};

export default function DisclosuresScreen() {
  const { t, i18n } = useTranslation();
  const [docs, setDocs] = useState<LegalDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchDocs();
  }, [i18n.language]);

  const fetchDocs = async () => {
    setLoading(true);
    setError(false);
    try {
      const lang = i18n.language || 'es';
      const r = await fetch(`${API_URL}/legal?lang=${lang}`);
      if (r.ok) {
        const data = await r.json();
        setDocs(Array.isArray(data) ? data : []);
      } else {
        setError(true);
      }
    } catch (e) {
      console.error('Error fetching legal docs:', e);
      setError(true);
    }
    setLoading(false);
  };

  // Static disclosure links for screens that exist locally
  const staticDisclosures = [
    {
      key: 'state-disclosures',
      title: t('disclosures.stateDisclosures', 'Divulgaciones Estatales - Texas'),
      icon: 'flag-outline',
      color: '#F59E0B',
      bg: 'rgba(245,158,11,0.1)',
      route: '/profile/state-disclosures',
    },
    {
      key: 'esign-disclosure',
      title: t('disclosures.esignDisclosure', 'Divulgación de Firma Electrónica'),
      icon: 'create-outline',
      color: '#10B981',
      bg: 'rgba(16,185,129,0.1)',
      route: '/profile/esign-disclosure',
    },
  ];

  const handleDocPress = (doc: LegalDoc) => {
    router.push({ pathname: '/profile/legal-document', params: { slug: doc.slug, title: doc.title } });
  };

  return (
    <>
      <Stack.Screen options={{ title: t('disclosures.title', 'Divulgaciones') }} />
      <SafeAreaView style={S.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>
          {/* Header icon */}
          <View style={S.iconWrap}>
            <View style={S.iconCircle}>
              <Ionicons name="documents-outline" size={40} color={Colors.primaryLight} />
            </View>
          </View>
          <Text style={S.heading}>{t('disclosures.heading', 'Documentos Legales y Divulgaciones')}</Text>
          <Text style={S.subheading}>
            {t('disclosures.description', 'Todos los documentos legales, divulgaciones y políticas de Ross Lending Solutions.')}
          </Text>

          {/* Static local disclosure screens */}
          <Text style={S.sectionTitle}>{t('disclosures.regulatorySection', 'Divulgaciones Regulatorias')}</Text>
          {staticDisclosures.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={S.docCard}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.7}
            >
              <View style={[S.docIconWrap, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon as any} size={22} color={item.color} />
              </View>
              <View style={S.docContent}>
                <Text style={S.docTitle}>{item.title}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          ))}

          {/* Dynamic documents from API */}
          <Text style={[S.sectionTitle, { marginTop: 24 }]}>{t('disclosures.legalDocsSection', 'Documentos Legales')}</Text>

          {loading ? (
            <View style={S.center}>
              <ActivityIndicator size="large" color={Colors.accent} />
              <Text style={S.loadingText}>{t('common.loading', 'Cargando...')}</Text>
            </View>
          ) : error ? (
            <View style={S.errorCard}>
              <Ionicons name="cloud-offline-outline" size={24} color={Colors.error} />
              <Text style={S.errorText}>
                {t('disclosures.errorLoading', 'No se pudieron cargar los documentos. Intente de nuevo.')}
              </Text>
              <TouchableOpacity onPress={fetchDocs} style={S.retryBtn}>
                <Text style={S.retryText}>{t('common.retry', 'Reintentar')}</Text>
              </TouchableOpacity>
            </View>
          ) : docs.length === 0 ? (
            <View style={S.emptyCard}>
              <Ionicons name="document-text-outline" size={24} color={Colors.textMuted} />
              <Text style={S.emptyText}>
                {t('disclosures.noDocuments', 'Los documentos se cargarán pronto.')}
              </Text>
            </View>
          ) : (
            docs.map((doc) => {
              const icon = getIconForSlug(doc.slug);
              return (
                <TouchableOpacity
                  key={doc._id}
                  style={S.docCard}
                  onPress={() => handleDocPress(doc)}
                  activeOpacity={0.7}
                >
                  <View style={[S.docIconWrap, { backgroundColor: icon.bg }]}>
                    <Ionicons name={icon.name as any} size={22} color={icon.color} />
                  </View>
                  <View style={S.docContent}>
                    <Text style={S.docTitle}>{doc.title}</Text>
                    {doc.version && (
                      <Text style={S.docVersion}>v{doc.version}</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              );
            })
          )}

          {/* OCCC External Link */}
          <Text style={[S.sectionTitle, { marginTop: 24 }]}>{t('disclosures.regulatorSection', 'Regulador')}</Text>
          <TouchableOpacity
            style={S.docCard}
            onPress={() => {
              const { Linking } = require('react-native');
              Linking.openURL('https://occc.texas.gov');
            }}
            activeOpacity={0.7}
          >
            <View style={[S.docIconWrap, { backgroundColor: 'rgba(14,165,233,0.1)' }]}>
              <Ionicons name="open-outline" size={22} color="#0EA5E9" />
            </View>
            <View style={S.docContent}>
              <Text style={S.docTitle}>OCCC - Office of Consumer Credit Commissioner</Text>
              <Text style={S.docVersion}>occc.texas.gov</Text>
            </View>
            <Ionicons name="open-outline" size={16} color={Colors.textMuted} />
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  iconWrap: { alignItems: 'center', marginBottom: 16 },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(52,211,153,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  heading: {
    fontSize: 20, fontWeight: '800', color: Colors.text,
    textAlign: 'center', marginBottom: 6,
  },
  subheading: {
    fontSize: 13, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 20, marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 12,
  },
  docCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  docIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  docContent: { flex: 1 },
  docTitle: { fontSize: 14, fontWeight: '600', color: Colors.text, lineHeight: 19 },
  docVersion: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  center: { alignItems: 'center', paddingVertical: 32 },
  loadingText: { marginTop: 12, fontSize: 13, color: Colors.textMuted },
  errorCard: {
    alignItems: 'center', padding: 24,
    backgroundColor: Colors.card, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  errorText: {
    fontSize: 13, color: Colors.textSecondary,
    textAlign: 'center', marginTop: 8, lineHeight: 19,
  },
  retryBtn: {
    marginTop: 16, paddingHorizontal: 24, paddingVertical: 10,
    backgroundColor: Colors.primary, borderRadius: 10,
  },
  retryText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  emptyCard: {
    alignItems: 'center', padding: 24,
    backgroundColor: Colors.card, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  emptyText: {
    fontSize: 13, color: Colors.textMuted,
    textAlign: 'center', marginTop: 8,
  },
});
