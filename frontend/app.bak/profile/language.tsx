import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { setLanguage } from '../../src/i18n';
import { Colors } from '../../src/constants/theme';

const LANGUAGES = [
  { code: 'es', label: 'Español', desc: 'Interfaz en español', flag: '🇪🇸' },
  { code: 'en', label: 'English', desc: 'English interface', flag: '🇺🇸' },
];

export default function LanguageScreen() {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language;

  const changeLanguage = async (code: string) => {
    await setLanguage(code as 'es' | 'en');
    Alert.alert('✅', t('language.changed'));
  };

  return (
    <>
      <Stack.Screen options={{ title: t('language.title') }} />
      <SafeAreaView style={S.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={S.scroll}>
          <View style={S.section}>
            <Text style={S.sectionTitle}>{t('language.select')}</Text>
            {LANGUAGES.map(lang => (
              <TouchableOpacity
                key={lang.code}
                style={[S.langCard, currentLang === lang.code && S.langCardActive]}
                onPress={() => changeLanguage(lang.code)}
                activeOpacity={0.7}
              >
                <Text style={S.langFlag}>{lang.flag}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[S.langLabel, currentLang === lang.code && S.langLabelActive]}>
                    {lang.label}
                  </Text>
                  <Text style={S.langDesc}>{lang.desc}</Text>
                </View>
                {currentLang === lang.code && (
                  <Ionicons name="checkmark-circle" size={24} color={Colors.primaryLight} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 20, paddingTop: 10 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 16 },
  langCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card,
    borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: Colors.border,
  },
  langCardActive: { borderColor: Colors.primary, backgroundColor: 'rgba(5, 150, 105, 0.06)' },
  langFlag: { fontSize: 28, marginRight: 14 },
  langLabel: { fontSize: 16, fontWeight: '600', color: Colors.text },
  langLabelActive: { color: Colors.primaryLight },
  langDesc: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
});
