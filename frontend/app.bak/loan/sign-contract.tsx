import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import SignatureScreen from 'react-native-signature-canvas';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, API_URL } from '../../src/constants/theme';
import { useTranslation } from 'react-i18next';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SignContractScreen() {
  const { loanId } = useLocalSearchParams<{ loanId: string }>();
  const { token } = useAuth();
  const { t, i18n } = useTranslation();
  const sigRef = useRef<any>(null);
  const lang = i18n.language?.startsWith('es') ? 'es' : 'en';

  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState<any>(null);
  const [step, setStep] = useState<'review' | 'sign' | 'done'>('review');
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (loanId) fetchDetails();
  }, [loanId]);

  const fetchDetails = async () => {
    try {
      const res = await fetch(`${API_URL}/api/loans/my-contracts/${loanId}/details`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setContract(data);
        if (data.is_signed) setStep('done');
      } else {
        Alert.alert(t('common.error', 'Error'), t('contract.couldNotLoad', 'Could not load contract.'));
        router.back();
      }
    } catch {
      Alert.alert('Error', t('common.connectionError', 'Connection error.'));
      router.back();
    }
    setLoading(false);
  };

  const fmt = (n: number) => `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleSignature = async (signature: string) => {
    if (!signature || !loanId) return;
    setSubmitting(true);
    try {
      const base64 = signature.replace('data:image/png;base64,', '');
      const res = await fetch(`${API_URL}/api/loans/my-contracts/${loanId}/sign`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_data: base64,
          signer_name: contract?.client_name || '',
        }),
      });
      if (res.ok) {
        setStep('done');
        Alert.alert(
          t('contract.signed', 'Contract Signed'),
          t('contract.signedMsg', 'Your contract has been signed successfully. Both English and Spanish versions have been generated.'),
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert(t('common.error', 'Error'), err.detail || t('contract.couldNotSign', 'Could not sign contract.'));
      }
    } catch {
      Alert.alert('Error', t('common.connectionErrorRetry', 'Connection error. Please try again.'));
    }
    setSubmitting(false);
  };

  const handleEmpty = () => {
    Alert.alert(t('contract.emptySignature', 'Empty Signature'), t('contract.drawFirst', 'Please draw your signature before confirming.'));
  };

  const handleClear = () => { sigRef.current?.clearSignature(); };
  const handleConfirmSign = () => { sigRef.current?.readSignature(); };

  const isWeekly = contract?.terms?.payment_frequency === 'weekly';
  const paymentAmount = isWeekly ? (contract?.terms?.weekly_payment || 0) : (contract?.terms?.monthly_payment || 0);
  const paymentLabel = isWeekly
    ? t('contract.weeklyPayment', 'Weekly Payment')
    : t('contract.monthlyPayment', 'Monthly Payment');
  const termLabel = isWeekly
    ? `${(contract?.terms?.term_months || 0) * 4} ${t('contract.weeklyPayments', 'weekly payments')}`
    : `${contract?.terms?.term_months || 0} ${t('contract.months', 'months')}`;

  if (loading) {
    return (
      <SafeAreaView style={S.container}>
        <Stack.Screen options={{ title: t('contract.signContract', 'Sign Contract') }} />
        <ActivityIndicator color={Colors.primaryLight} size="large" style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  // ─── STEP: ALREADY SIGNED ───────────────────────
  if (step === 'done') {
    return (
      <SafeAreaView style={S.container}>
        <Stack.Screen options={{ title: t('contract.contractSigned', 'Contract Signed') }} />
        <View style={S.doneContainer}>
          <View style={S.doneIcon}>
            <Ionicons name="checkmark-circle" size={64} color="#34D399" />
          </View>
          <Text style={S.doneTitle}>{t('contract.contractSigned', 'Contract Signed')}</Text>
          <Text style={S.doneText}>
            {t('contract.alreadySigned', 'This contract has been signed')}
            {contract?.signed_at ? ` ${t('contract.on', 'on')} ${new Date(contract.signed_at).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US')}` : ''}.
          </Text>
          <TouchableOpacity style={S.doneBtn} onPress={() => router.back()}>
            <Text style={S.doneBtnText}>{t('contract.backToContracts', 'Back to Contracts')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── STEP: SIGNATURE CANVAS ─────────────────────
  if (step === 'sign') {
    return (
      <SafeAreaView style={S.container} edges={['top', 'bottom']}>
        <Stack.Screen options={{ title: t('contract.digitalSignature', 'Digital Signature') }} />
        <View style={S.signHeader}>
          <TouchableOpacity onPress={() => setStep('review')} style={S.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={S.signHeaderTitle}>{t('contract.digitalSignature', 'Digital Signature')}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={S.signInstructions}>
          <Ionicons name="finger-print" size={20} color={Colors.primaryLight} />
          <Text style={S.signInstructText}>
            {t('contract.drawSignature', 'Draw your signature with your finger in the white space')}
          </Text>
        </View>

        <View style={S.signatureBox}>
          <SignatureScreen
            ref={sigRef}
            onOK={handleSignature}
            onEmpty={handleEmpty}
            descriptionText=""
            clearText={t('common.clear', 'Clear')}
            confirmText={t('common.confirm', 'Confirm')}
            webStyle={`
              .m-signature-pad { box-shadow: none; border: none; margin: 0; }
              .m-signature-pad--body { border: none; }
              .m-signature-pad--footer { display: none; }
              body, html { margin: 0; padding: 0; width: 100%; height: 100%; }
              canvas { width: 100% !important; height: 100% !important; }
            `}
            backgroundColor="#FFFFFF"
            penColor="#1a1a2e"
            minWidth={2}
            maxWidth={4}
            dotSize={3}
            style={S.signatureCanvas}
          />
          <View style={S.signatureLine} />
          <Text style={S.signatureNameLabel}>{contract?.client_name || t('contract.clientSignature', 'Client Signature')}</Text>
        </View>

        <View style={S.signActions}>
          <TouchableOpacity style={S.clearBtn} onPress={handleClear}>
            <Ionicons name="refresh" size={18} color={Colors.textSecondary} />
            <Text style={S.clearBtnText}>{t('common.clear', 'Clear')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[S.confirmSignBtn, submitting && S.btnDisabled]}
            onPress={handleConfirmSign}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-done" size={18} color="#fff" />
                <Text style={S.confirmSignText}>{t('contract.signContract', 'Sign Contract')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text style={S.legalNotice}>
          {t('contract.legalNotice', 'By signing, I agree to the terms of personal loan contract {{loanNumber}} and confirm having received the TILA disclosure.', { loanNumber: contract?.loan_number || '' })}
        </Text>
      </SafeAreaView>
    );
  }

  // ─── STEP: REVIEW CONTRACT ──────────────────────
  return (
    <SafeAreaView style={S.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: `${t('contract.contract', 'Contract')} ${contract?.loan_number || ''}`, headerShown: false }} />

      <View style={S.customHeader}>
        <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={S.customHeaderTitle}>{t('contract.contract', 'Contract')} {contract?.loan_number || ''}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={S.scroll}>

        {/* Contract Header */}
        <View style={S.contractHeader}>
          <View style={S.contractBadge}>
            <Ionicons name="document-text" size={28} color={Colors.primaryLight} />
          </View>
          <Text style={S.contractHeaderTitle}>{t('contract.personalLoanContract', 'Personal Loan Contract')}</Text>
          <Text style={S.contractNumber}>#{contract?.loan_number}</Text>
          <Text style={S.contractSubtext}>Ross Lending Solutions LLC</Text>
        </View>

        {/* TILA Federal Disclosure */}
        <View style={S.tilaSection}>
          <View style={S.tilaTitleRow}>
            <Ionicons name="shield-checkmark" size={18} color="#34D399" />
            <Text style={S.tilaTitle}>{t('contract.tilaTitle', 'FEDERAL DISCLOSURE (TILA)')}</Text>
          </View>
          <Text style={S.tilaSubtitle}>{t('contract.tilaSubtitle', 'Required by Law - Truth in Lending Act')}</Text>

          <View style={S.tilaGrid}>
            <View style={S.tilaBox}>
              <Text style={S.tilaLabel}>{t('contract.annualRate', 'ANNUAL RATE (APR)')}</Text>
              <Text style={S.tilaValue}>{contract?.tila?.apr || 0}%</Text>
              <Text style={S.tilaDesc}>{t('contract.aprDesc', 'Cost of your credit as an annual rate')}</Text>
            </View>
            <View style={S.tilaBox}>
              <Text style={S.tilaLabel}>{t('contract.financeCharge', 'FINANCE CHARGE')}</Text>
              <Text style={S.tilaValue}>{fmt(contract?.tila?.finance_charge || 0)}</Text>
              <Text style={S.tilaDesc}>{t('contract.fcDesc', 'Dollar amount credit will cost you')}</Text>
            </View>
            <View style={S.tilaBox}>
              <Text style={S.tilaLabel}>{t('contract.amountFinanced', 'AMOUNT FINANCED')}</Text>
              <Text style={S.tilaValue}>{fmt(contract?.tila?.amount_financed || 0)}</Text>
              <Text style={S.tilaDesc}>{t('contract.afDesc', 'Amount of credit provided to you')}</Text>
            </View>
            <View style={S.tilaBox}>
              <Text style={S.tilaLabel}>{t('contract.totalPayments', 'TOTAL OF PAYMENTS')}</Text>
              <Text style={S.tilaValue}>{fmt(contract?.tila?.total_of_payments || 0)}</Text>
              <Text style={S.tilaDesc}>{t('contract.tpDesc', 'Amount paid after all payments')}</Text>
            </View>
          </View>
        </View>

        {/* Loan Terms */}
        <View style={S.termsSection}>
          <Text style={S.termsSectionTitle}>{t('contract.loanTerms', 'Loan Terms')}</Text>

          <View style={S.termRow}>
            <Text style={S.termLabel}>{t('contract.loanAmount', 'Loan Amount')}</Text>
            <Text style={S.termValue}>{fmt(contract?.terms?.amount || 0)}</Text>
          </View>
          <View style={S.termRow}>
            <Text style={S.termLabel}>{t('contract.term', 'Term')}</Text>
            <Text style={S.termValue}>{termLabel}</Text>
          </View>
          <View style={S.termRow}>
            <Text style={S.termLabel}>{paymentLabel}</Text>
            <Text style={[S.termValue, { color: Colors.primaryLight }]}>{fmt(paymentAmount)}</Text>
          </View>
          <View style={S.termRow}>
            <Text style={S.termLabel}>{t('contract.totalInterest', 'Total Interest')}</Text>
            <Text style={S.termValue}>{fmt(contract?.terms?.total_interest || 0)}</Text>
          </View>
          <View style={S.termRow}>
            <Text style={S.termLabel}>{t('contract.adminFee', 'Acquisition Charge')}</Text>
            <Text style={S.termValue}>{fmt(contract?.terms?.admin_fee || 0)}</Text>
          </View>
          <View style={S.termRow}>
            <Text style={S.termLabel}>{t('contract.totalToPay', 'Total to Pay')}</Text>
            <Text style={[S.termValue, { fontWeight: '800' }]}>{fmt(contract?.terms?.total_to_pay || 0)}</Text>
          </View>
          {contract?.terms?.purpose ? (
            <View style={S.termRow}>
              <Text style={S.termLabel}>{t('contract.purpose', 'Purpose')}</Text>
              <Text style={S.termValue}>{contract.terms.purpose}</Text>
            </View>
          ) : null}
          {contract?.terms?.first_payment_date ? (
            <View style={S.termRow}>
              <Text style={S.termLabel}>{t('contract.firstPayment', 'First Payment')}</Text>
              <Text style={S.termValue}>{new Date(contract.terms.first_payment_date).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US')}</Text>
            </View>
          ) : null}
        </View>

        {/* Terms & Conditions */}
        <View style={S.legalSection}>
          <Text style={S.legalTitle}>{t('contract.termsConditions', 'Terms & Conditions')}</Text>
          <Text style={S.legalText}>
            {lang === 'es'
              ? '1. El prestatario se compromete a realizar pagos según el calendario establecido.\n\n2. Cargo por pago tardío: 5% del monto de la cuota vencida o $25.00 USD, lo que sea mayor.\n\n3. El prestatario tiene derecho a realizar pagos anticipados sin penalización.\n\n4. Si el pago tiene más de 90 días de atraso, el prestamista se reserva el derecho de declarar vencido el saldo total.\n\n5. Este contrato se rige por las leyes del Estado de Texas, EE.UU.\n\n6. El prestatario reconoce haber recibido la divulgación completa de términos financieros según la Ley de Veracidad en los Préstamos (TILA).'
              : '1. The borrower agrees to make payments according to the established schedule.\n\n2. Late fee: 5% of the overdue payment amount or $25.00 USD, whichever is greater.\n\n3. The borrower has the right to make early payments without penalty.\n\n4. If payment is more than 90 days past due, the lender reserves the right to declare the entire balance due.\n\n5. This contract is governed by the laws of the State of Texas, USA.\n\n6. The borrower acknowledges having received the full TILA financial disclosure.'}
          </Text>
        </View>

        {/* Accept & Sign */}
        <View style={S.acceptSection}>
          <TouchableOpacity style={S.checkboxRow} onPress={() => setAccepted(!accepted)} activeOpacity={0.7}>
            <View style={[S.checkbox, accepted && S.checkboxChecked]}>
              {accepted && <Ionicons name="checkmark" size={16} color="#fff" />}
            </View>
            <Text style={S.checkboxText}>
              {t('contract.acceptTerms', 'I have read and accept the contract terms, TILA disclosure, and loan conditions.')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[S.signBtn, !accepted && S.signBtnDisabled]}
            onPress={() => setStep('sign')}
            disabled={!accepted}
          >
            <Ionicons name="create-outline" size={20} color={accepted ? '#fff' : Colors.textMuted} />
            <Text style={[S.signBtnText, !accepted && S.signBtnTextDisabled]}>
              {t('contract.proceedToSign', 'Proceed to Sign')}
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 20, paddingBottom: 60 },
  contractHeader: { alignItems: 'center', paddingVertical: 24, marginBottom: 20 },
  contractBadge: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(5,150,105,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  contractHeaderTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  contractNumber: { fontSize: 22, fontWeight: '800', color: Colors.primaryLight, marginTop: 4 },
  contractSubtext: { fontSize: 13, color: Colors.textMuted, marginTop: 4 },
  tilaSection: { backgroundColor: Colors.card, borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 1.5, borderColor: '#34D399' },
  tilaTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  tilaTitle: { fontSize: 14, fontWeight: '800', color: Colors.text, letterSpacing: 0.5 },
  tilaSubtitle: { fontSize: 10, color: Colors.textMuted, marginBottom: 16, fontStyle: 'italic' },
  tilaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tilaBox: { width: (SCREEN_WIDTH - 80) / 2, backgroundColor: Colors.surface, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  tilaLabel: { fontSize: 8, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5, marginBottom: 4, textAlign: 'center' },
  tilaValue: { fontSize: 18, fontWeight: '800', color: Colors.text },
  tilaDesc: { fontSize: 9, color: Colors.textMuted, textAlign: 'center', marginTop: 4 },
  termsSection: { backgroundColor: Colors.card, borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  termsSectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 14 },
  termRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  termLabel: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  termValue: { fontSize: 14, fontWeight: '700', color: Colors.text },
  legalSection: { backgroundColor: Colors.card, borderRadius: 16, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: Colors.border },
  legalTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  legalText: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  acceptSection: { marginBottom: 30 },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20, gap: 12 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: Colors.textMuted, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  checkboxChecked: { backgroundColor: Colors.primaryLight, borderColor: Colors.primaryLight },
  checkboxText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  signBtn: { backgroundColor: Colors.primaryLight, borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  signBtnDisabled: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  signBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  signBtnTextDisabled: { color: Colors.textMuted },
  signHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  signHeaderTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  customHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  customHeaderTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  signInstructions: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: 'rgba(5,150,105,0.06)', marginHorizontal: 16, borderRadius: 12, marginTop: 12 },
  signInstructText: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  signatureBox: { flex: 1, marginHorizontal: 16, marginTop: 16, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: Colors.border, minHeight: 250 },
  signatureCanvas: { flex: 1, minHeight: 220 },
  signatureLine: { height: 1, backgroundColor: '#ccc', marginHorizontal: 30, marginBottom: 4 },
  signatureNameLabel: { fontSize: 11, color: '#999', textAlign: 'center', paddingBottom: 10 },
  signActions: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  clearBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, backgroundColor: Colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border },
  clearBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  confirmSignBtn: { flex: 2, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: Colors.primaryLight, borderRadius: 12, padding: 14 },
  confirmSignText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  btnDisabled: { opacity: 0.6 },
  legalNotice: { fontSize: 10, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: 20, paddingBottom: 20, lineHeight: 14 },
  doneContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  doneIcon: { marginBottom: 16 },
  doneTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 8 },
  doneText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  doneBtn: { backgroundColor: Colors.primaryLight, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14 },
  doneBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
