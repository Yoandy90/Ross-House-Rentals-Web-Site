import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../src/constants/theme';
import NMLSFooter from '../../src/components/NMLSFooter';

export default function StateDisclosuresScreen() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('stateDisclosures.title', 'State Disclosures') }} />
      <SafeAreaView style={S.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={S.scroll}>
          <View style={S.iconWrap}>
            <View style={S.iconCircle}>
              <Ionicons name="flag" size={40} color="#F59E0B" />
            </View>
          </View>

          <Text style={S.heading}>{t('stateDisclosures.heading', 'State of Texas Disclosures')}</Text>
          <Text style={S.date}>{t('stateDisclosures.updated', 'Effective: January 2026')}</Text>

          {/* Texas Consumer Lending */}
          <Text style={S.subheading}>{t('stateDisclosures.s1t', '1. Texas Consumer Lending License')}</Text>
          <Text style={S.body}>{t('stateDisclosures.s1b', 'Ross Lending Solutions LLC is licensed and regulated under Chapter 342 of the Texas Finance Code. We are supervised by the Office of Consumer Credit Commissioner (OCCC) of the State of Texas.')}</Text>

          <View style={S.regulationCard}>
            <View style={S.regRow}>
              <Text style={S.regLabel}>{t('stateDisclosures.entity', 'Entity')}</Text>
              <Text style={S.regValue}>Ross Lending Solutions LLC</Text>
            </View>
            <View style={S.regRow}>
              <Text style={S.regLabel}>{t('stateDisclosures.regBody', 'Regulatory Body')}</Text>
              <Text style={S.regValue}>OCCC - Texas</Text>
            </View>
            <View style={S.regRow}>
              <Text style={S.regLabel}>{t('stateDisclosures.chapter', 'Chapter')}</Text>
              <Text style={S.regValue}>342, TX Finance Code</Text>
            </View>
            <View style={S.regRow}>
              <Text style={S.regLabel}>{t('stateDisclosures.loanType', 'Loan Types')}</Text>
              <Text style={S.regValue}>{t('stateDisclosures.loanTypeValue', 'Regulated Consumer Loans')}</Text>
            </View>
          </View>

          <Text style={S.subheading}>{t('stateDisclosures.s2t', '2. Interest Rate Disclosure')}</Text>
          <Text style={S.body}>{t('stateDisclosures.s2b', 'All interest rates are disclosed in your loan agreement before signing. Maximum interest rates are determined by OCCC regulations and vary based on loan amount and term. The Annual Percentage Rate (APR) includes all applicable fees and charges as required by the Truth in Lending Act (TILA).')}</Text>

          <Text style={S.subheading}>{t('stateDisclosures.s3t', '3. Borrower Rights')}</Text>
          <Text style={S.body}>{t('stateDisclosures.s3b', 'As a Texas borrower, you have the right to:\n\n• Receive a complete copy of your loan agreement\n• Know the total cost of your loan before signing\n• Prepay your loan at any time without penalty\n• File a complaint with the OCCC if you believe your rights have been violated\n• Receive clear disclosures of all fees and charges')}</Text>

          <Text style={S.subheading}>{t('stateDisclosures.s4t', '4. Complaint Process')}</Text>
          <Text style={S.body}>{t('stateDisclosures.s4b', 'If you have a complaint about your loan, you may contact:')}</Text>

          <View style={S.contactCard}>
            <Text style={S.contactTitle}>Ross Lending Solutions LLC</Text>
            <Text style={S.contactInfo}>📞 (806) 934-2018</Text>
            <Text style={S.contactInfo}>✉️ info@rosslending.com</Text>
            <Text style={S.contactInfo}>📍 305 Bruce Ave, Dumas, TX 79029</Text>
          </View>

          <View style={S.contactCard}>
            <Text style={S.contactTitle}>Office of Consumer Credit Commissioner</Text>
            <Text style={S.contactInfo}>📞 (800) 538-1579</Text>
            <TouchableOpacity onPress={() => Linking.openURL('https://occc.texas.gov/consumers/file-a-complaint')}>
              <Text style={[S.contactInfo, { color: Colors.primaryLight }]}>🌐 occc.texas.gov/consumers/file-a-complaint</Text>
            </TouchableOpacity>
          </View>

          <Text style={S.subheading}>{t('stateDisclosures.s5t', '5. Military Lending Act')}</Text>
          <Text style={S.body}>{t('stateDisclosures.s5b', 'If you are an active duty military member or dependent, special protections under the Military Lending Act (MLA) may apply to your loan. Please inform us of your military status so we can ensure compliance with all applicable protections.')}</Text>

          <NMLSFooter compact />
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
    width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(245, 158, 11, 0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  heading: { fontSize: 18, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: 4 },
  date: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginBottom: 24 },
  subheading: { fontSize: 16, fontWeight: '700', color: Colors.text, marginTop: 20, marginBottom: 8 },
  body: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
  regulationCard: {
    backgroundColor: Colors.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.border, marginTop: 12,
  },
  regRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  regLabel: { fontSize: 12, color: Colors.textMuted, fontWeight: '600', flex: 0.4 },
  regValue: { fontSize: 13, color: Colors.text, fontWeight: '600', flex: 0.6, textAlign: 'right' },
  contactCard: {
    backgroundColor: Colors.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.border, marginTop: 12, marginBottom: 4,
  },
  contactTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  contactInfo: { fontSize: 13, color: Colors.textSecondary, lineHeight: 22 },
});
