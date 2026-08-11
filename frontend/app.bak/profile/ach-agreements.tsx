import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../src/constants/theme';
import NMLSFooter from '../../src/components/NMLSFooter';

export default function ACHAgreementsScreen() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('achAgreements.title', 'ACH & Auto-Pay Agreements') }} />
      <SafeAreaView style={S.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={S.scroll}>
          <View style={S.iconWrap}>
            <View style={S.iconCircle}>
              <Ionicons name="sync-circle" size={40} color={Colors.primaryLight} />
            </View>
          </View>

          <Text style={S.heading}>{t('achAgreements.heading', 'ACH Authorization & Automatic Payment Agreement')}</Text>
          <Text style={S.date}>{t('achAgreements.updated', 'Effective: January 2026')}</Text>

          <Text style={S.subheading}>{t('achAgreements.s1t', '1. ACH Authorization')}</Text>
          <Text style={S.body}>{t('achAgreements.s1b', 'By providing your bank account information and agreeing to ACH debit, you authorize Ross Lending Solutions LLC to initiate electronic transfers from your designated bank account for the purpose of loan repayment. This authorization remains in effect until you revoke it in writing or your loan is paid in full.')}</Text>

          <Text style={S.subheading}>{t('achAgreements.s2t', '2. Automatic Payments')}</Text>
          <Text style={S.body}>{t('achAgreements.s2b', 'When you enroll in automatic payments:\n\n• Payments will be debited on the scheduled due date\n• You will receive a reminder notification 3 days before each debit\n• The exact amount due will be debited unless you make a partial payment beforehand\n• Insufficient funds may result in a returned payment fee')}</Text>

          <Text style={S.subheading}>{t('achAgreements.s3t', '3. Cancellation')}</Text>
          <Text style={S.body}>{t('achAgreements.s3b', 'You may cancel automatic payments at any time by:\n\n• Contacting us at (806) 934-2018\n• Sending an email to info@rosslending.com\n• Visiting our office at 305 Bruce Ave, Dumas, TX\n\nCancellation requests must be received at least 3 business days before the next scheduled payment.')}</Text>

          <Text style={S.subheading}>{t('achAgreements.s4t', '4. Returned Payments')}</Text>
          <Text style={S.body}>{t('achAgreements.s4b', 'If an ACH payment is returned due to insufficient funds, closed account, or any other reason:\n\n• A returned payment fee may apply as stated in your loan agreement\n• We will attempt to contact you to arrange alternative payment\n• Repeated returned payments may result in revocation of ACH privileges')}</Text>

          <View style={S.infoBox}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.primaryLight} />
            <Text style={S.infoText}>
              {t('achAgreements.infoNote', 'All ACH transactions are processed in compliance with NACHA (National Automated Clearing House Association) rules and regulations.')}
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
    width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(5, 150, 105, 0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  heading: { fontSize: 18, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: 4 },
  date: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginBottom: 24 },
  subheading: { fontSize: 16, fontWeight: '700', color: Colors.text, marginTop: 20, marginBottom: 8 },
  body: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
  infoBox: {
    flexDirection: 'row', gap: 10, backgroundColor: 'rgba(5, 150, 105, 0.06)',
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(5, 150, 105, 0.15)',
    marginTop: 24, marginBottom: 8,
  },
  infoText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
});
