import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../src/constants/theme';
import NMLSFooter from '../../src/components/NMLSFooter';

export default function ESignDisclosureScreen() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('esign.title', 'E-Sign Disclosure') }} />
      <SafeAreaView style={S.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={S.scroll}>
          <View style={S.iconWrap}>
            <View style={S.iconCircle}>
              <Ionicons name="create" size={40} color={Colors.primaryLight} />
            </View>
          </View>

          <Text style={S.heading}>{t('esign.heading', 'Electronic Signature Disclosure')}</Text>
          <Text style={S.date}>{t('esign.updated', 'Effective: January 2026')}</Text>

          <Text style={S.subheading}>{t('esign.s1t', '1. Consent to Electronic Signatures')}</Text>
          <Text style={S.body}>{t('esign.s1b', 'By using the Ross Lending Solutions LLC mobile application or website to sign documents electronically, you consent to the use of electronic signatures as a valid method of executing agreements, disclosures, and other documents related to your loan.')}</Text>

          <Text style={S.subheading}>{t('esign.s2t', '2. Legal Validity')}</Text>
          <Text style={S.body}>{t('esign.s2b', 'Electronic signatures are legally binding under the federal Electronic Signatures in Global and National Commerce Act (E-SIGN Act, 15 U.S.C. § 7001) and the Texas Uniform Electronic Transactions Act (TUETA). Your electronic signature has the same legal effect as a handwritten signature.')}</Text>

          <Text style={S.subheading}>{t('esign.s3t', '3. Hardware & Software Requirements')}</Text>
          <Text style={S.body}>{t('esign.s3b', 'To access and retain electronic documents, you need:\n\n• A smartphone or tablet with iOS 15+ or Android 10+\n• The Ross Lending Solutions mobile app (latest version)\n• An active internet connection\n• Sufficient storage space to download and save documents')}</Text>

          <Text style={S.subheading}>{t('esign.s4t', '4. Your Right to Paper Documents')}</Text>
          <Text style={S.body}>{t('esign.s4b', 'You have the right to receive paper copies of any documents you sign electronically. To request paper copies:\n\n• Call us at (806) 934-2018\n• Email info@rosslending.com\n• Visit our office at 305 Bruce Ave, Dumas, TX\n\nPaper copies will be provided free of charge.')}</Text>

          <Text style={S.subheading}>{t('esign.s5t', '5. Withdrawal of Consent')}</Text>
          <Text style={S.body}>{t('esign.s5b', 'You may withdraw your consent to receive electronic documents at any time by contacting us. Withdrawal will not affect the legal validity of any documents you previously signed electronically.')}</Text>

          <View style={S.infoBox}>
            <Ionicons name="information-circle-outline" size={20} color="#3B82F6" />
            <Text style={S.infoText}>
              {t('esign.infoNote', 'All electronic signatures are timestamped and recorded with your IP address for audit trail purposes.')}
            </Text>
          </View>

          <NMLSFooter compact showLinks={false} />
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
    width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(59, 130, 246, 0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  heading: { fontSize: 18, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: 4 },
  date: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginBottom: 24 },
  subheading: { fontSize: 16, fontWeight: '700', color: Colors.text, marginTop: 20, marginBottom: 8 },
  body: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
  infoBox: {
    flexDirection: 'row', gap: 10, backgroundColor: 'rgba(59, 130, 246, 0.06)',
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.15)',
    marginTop: 24, marginBottom: 8,
  },
  infoText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
});
