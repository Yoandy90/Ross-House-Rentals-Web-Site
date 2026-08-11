import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Dimensions, Keyboard, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import i18n from '../../src/i18n';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, Gradients, API_URL } from '../../src/constants/theme';
import * as ImagePicker from 'expo-image-picker';
import TrustBanner from '../../src/components/TrustBanner';
import ProcessingScreen from '../../src/components/ProcessingScreen';
import NMLSFooter from '../../src/components/NMLSFooter';
import AddressAutocomplete from '../../src/components/AddressAutocomplete';
import LoanAmountSlider from '../../src/components/LoanAmountSlider';

// Plaid SDK — native only (crashes on web)
let plaidCreate: any = () => {};
let plaidOpen: any = () => {};
let plaidDismiss: any = () => {};
let PlaidPresentationStyle: any = {};
if (Platform.OS !== 'web') {
  try {
    const plaid = require('react-native-plaid-link-sdk');
    plaidCreate = plaid.create;
    plaidOpen = plaid.open;
    plaidDismiss = plaid.dismissLink;
    PlaidPresentationStyle = plaid.LinkIOSPresentationStyle || {};
  } catch {}
}

const { width: SW } = Dimensions.get('window');

export default function ApplyScreen() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const safeSetStep = (s: number) => { Keyboard.dismiss(); setTimeout(() => setStep(s), 50); };
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [showPurposePicker, setShowPurposePicker] = useState(false);
  const [ssnVisible, setSsnVisible] = useState(false);
  const [savedProfile, setSavedProfile] = useState<any>(null);
  const [showPrefillModal, setShowPrefillModal] = useState(false);
  const [loanOptions, setLoanOptions] = useState<any[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [creditTier, setCreditTier] = useState<any>(null);

  // Plaid state
  const [plaidConnected, setPlaidConnected] = useState(false);
  const [plaidBankName, setPlaidBankName] = useState('');
  const [plaidLoading, setPlaidLoading] = useState(false);
  const [showManualBank, setShowManualBank] = useState(false);

  // Documents state
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [localDocs, setLocalDocs] = useState<{ [key: string]: { uri: string; base64: string; name: string } }>({});
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [docsUploaded, setDocsUploaded] = useState<string[]>([]);

  // Eligibility state
  const [canApply, setCanApply] = useState<boolean | null>(null);
  const [eligibilityReason, setEligibilityReason] = useState('');
  const [blockingType, setBlockingType] = useState<string | null>(null);
  const [blockingData, setBlockingData] = useState<any>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(true);

  // TCPA & Processing state
  const [tcpaConsent, setTcpaConsent] = useState(false);
  const [showProcessing, setShowProcessing] = useState(false);

  // Employer autocomplete state
  const [employerSuggestions, setEmployerSuggestions] = useState<{ name: string; industry?: string; city?: string }[]>([]);
  const [showEmployerDropdown, setShowEmployerDropdown] = useState(false);
  const [employerSearchTimer, setEmployerSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Address validation state
  const [addressValidating, setAddressValidating] = useState(false);
  const [addressValid, setAddressValid] = useState<boolean | null>(null);
  const [addressMsg, setAddressMsg] = useState('');

  // Routing number lookup state
  const [routingLookupTimer, setRoutingLookupTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [routingValid, setRoutingValid] = useState<boolean | null>(null);
  const [routingBankName, setRoutingBankName] = useState('');
  const [routingLooking, setRoutingLooking] = useState(false);

  const lookupRoutingNumber = useCallback((routingNum: string) => {
    if (routingLookupTimer) clearTimeout(routingLookupTimer);
    const clean = routingNum.replace(/\D/g, '');
    if (clean.length !== 9) {
      setRoutingValid(null);
      setRoutingBankName('');
      return;
    }
    setRoutingLooking(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/routing-lookup/${clean}`);
        if (res.ok) {
          const data = await res.json();
          setRoutingValid(data.valid);
          if (data.bank_name) {
            setRoutingBankName(data.bank_name);
            // Auto-fill bank name field
            update('bank_name', data.bank_name);
          } else {
            setRoutingBankName('');
          }
        }
      } catch (e) {
        console.log('Routing lookup error:', e);
      }
      setRoutingLooking(false);
    }, 400);
    setRoutingLookupTimer(timer);
  }, [routingLookupTimer]);

  const validateAddress = async () => {
    if (!form.address_street || !form.address_city || !form.address_zip) return;
    setAddressValidating(true);
    setAddressValid(null);
    try {
      const res = await fetch(`${API_URL}/api/usps/address/validate-simple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          street: form.address_street,
          city: form.address_city,
          state: form.address_state,
          zip: form.address_zip,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.valid) {
          const std = data.standardized || {};
          if (std.streetAddress) update('address_street', std.streetAddress);
          if (std.city) update('address_city', std.city);
          if (std.state) update('address_state', std.state);
          if (std.ZIPCode) update('address_zip', std.ZIPCode + (std.ZIPPlus4 ? `-${std.ZIPPlus4}` : ''));
          setAddressValid(true);
          setAddressMsg(t('applyForm.addressVerified', '✓ Address verified by USPS'));
        } else {
          setAddressValid(false);
          setAddressMsg(data.dpvMessageEs || data.dpvMessage || t('applyForm.addressNotFound', 'Address not found'));
        }
      }
    } catch { setAddressValid(null); }
    setAddressValidating(false);
  };

  const searchEmployers = useCallback((query: string) => {
    if (employerSearchTimer) clearTimeout(employerSearchTimer);
    if (!query || query.length < 2) { setEmployerSuggestions([]); setShowEmployerDropdown(false); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/employers/search?q=${encodeURIComponent(query)}&limit=6`);
        if (res.ok) {
          const data = await res.json();
          setEmployerSuggestions(data.employers || []);
          setShowEmployerDropdown((data.employers || []).length > 0);
        }
      } catch { setEmployerSuggestions([]); }
    }, 300);
    setEmployerSearchTimer(timer);
  }, [employerSearchTimer]);
  const [form, setForm] = useState({
    loan_type: 'hybrid', amount: '', purpose: '', preferred_term: '3',
    first_name: '', last_name: '', date_of_birth: '', ssn: '',
    phone: '', email: '',
    address_street: '', address_city: '', address_state: 'TX', address_zip: '',
    employer: '', employment_type: 'full_time', time_at_employer: '',
    monthly_income: '', notes: '',
    bank_name: '', routing_number: '', account_number: '', account_type: 'checking',
  });

  const update = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  // Pre-fill from profile on mount — AUTO-FILL always, no modal
  useEffect(() => {
    if (!profileLoaded && token) {
      (async () => {
        try {
          // Check eligibility first
          const eligRes = await fetch(`${API_URL}/api/loans/can-apply`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (eligRes.ok) {
            const eligData = await eligRes.json();
            setCanApply(eligData.can_apply);
            const lang = i18n.language?.startsWith('en') ? 'reason_en' : 'reason_es';
            setEligibilityReason(eligData[lang] || eligData.reason_es || '');
            setBlockingType(eligData.blocking_type);
            setBlockingData(eligData.blocking_data);
          }
        } catch (e) {
          console.log('[apply] Eligibility check error:', e);
          setCanApply(true);
        }
        setEligibilityLoading(false);

        try {
          const res = await fetch(`${API_URL}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (res.ok) {
            const p = await res.json();
            setSavedProfile(p);
            // ═══ AUTO-FILL: Always fill from profile — no modal ═══
            const accountFirstName = p.first_name || (p.name || '').split(' ')[0] || '';
            const accountLastName = p.last_name || (p.name || '').split(' ').slice(1).join(' ') || '';
            setForm(f => ({
              ...f,
              // LOCKED fields — from account, user cannot change
              first_name: accountFirstName,
              last_name: accountLastName,
              email: p.email || f.email,
              phone: p.phone || f.phone,
              // EDITABLE fields — auto-fill if available
              date_of_birth: p.date_of_birth || f.date_of_birth,
              ssn: p.ssn_encrypted || f.ssn,
              address_street: p.address_street || p.address?.street || f.address_street,
              address_city: p.address_city || p.address?.city || f.address_city,
              address_state: p.address_state || p.address?.state || f.address_state || 'TX',
              address_zip: p.address_zip || p.address?.zip || f.address_zip,
              employer: p.employer || f.employer,
              employment_type: p.employment_type || f.employment_type,
              time_at_employer: p.time_at_employer || f.time_at_employer,
              monthly_income: p.monthly_income || f.monthly_income,
              bank_name: p.bank_name || f.bank_name,
            }));
          }
        } catch {}
        setProfileLoaded(true);
      })();
    }
  }, [token]);

  // Fetch loan options when amount changes
  useEffect(() => {
    const amt = parseFloat(form.amount.replace(/[^0-9.]/g, ''));
    if (!amt || amt < 200) { setLoanOptions([]); return; }
    const cappedAmt = Math.min(amt, creditTier?.max_amount || 1800);
    const timer = setTimeout(async () => {
      try {
        setLoadingOptions(true);
        const res = await fetch(`${API_URL}/api/loans/options?amount=${cappedAmt}`);
        if (res.ok) {
          const data = await res.json();
          let opts = data.options || [];
          // Limit terms based on credit tier
          const maxTerm = creditTier?.max_term_months || 6;
          opts = opts.filter((o: any) => o.term_months <= maxTerm);
          setLoanOptions(opts);
        }
      } catch {} finally { setLoadingOptions(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [form.amount, creditTier]);

  // Fetch credit tier on mount
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/loans/my-credit-tier`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setCreditTier(data);
        }
      } catch {}
    })();
  }, [token]);

  const applyPrefill = () => {
    if (!savedProfile) return;
    const p = savedProfile;
    const name = p.name || '';
    const parts = name.split(' ');
    setForm(f => ({
      ...f,
      first_name: p.first_name || parts[0] || f.first_name,
      last_name: p.last_name || parts.slice(1).join(' ') || f.last_name,
      phone: p.phone || f.phone,
      email: p.email || f.email,
      date_of_birth: p.date_of_birth || f.date_of_birth,
      ssn: p.ssn_encrypted || f.ssn,
      address_street: p.address_street || f.address_street,
      address_city: p.address_city || f.address_city,
      address_state: p.address_state || f.address_state || 'TX',
      address_zip: p.address_zip || f.address_zip,
      employer: p.employer || f.employer,
      employment_type: p.employment_type || f.employment_type,
      time_at_employer: p.time_at_employer || f.time_at_employer,
      monthly_income: p.monthly_income ? String(p.monthly_income) : f.monthly_income,
      bank_name: p.bank_name || f.bank_name,
    }));
    setShowPrefillModal(false);
  };

  const PURPOSES = [
    { key: 'medical', label: t('applyForm.medical', 'Medical expenses'), icon: 'medkit-outline' as const },
    { key: 'vehicle', label: t('applyForm.vehicle', 'Vehicle repair'), icon: 'car-outline' as const },
    { key: 'family', label: t('applyForm.family', 'Family emergency'), icon: 'people-outline' as const },
    { key: 'debt', label: t('applyForm.debt', 'Debt payment'), icon: 'card-outline' as const },
    { key: 'education', label: t('applyForm.education'), icon: 'school-outline' as const },
    { key: 'home', label: t('applyForm.homeImprovement', 'Home improvement'), icon: 'home-outline' as const },
    { key: 'tax', label: t('applyForm.taxAdvance', 'Tax advance'), icon: 'document-text-outline' as const },
    { key: 'other', label: t('applyForm.other'), icon: 'ellipsis-horizontal-outline' as const },
  ];

  const TERMS = [
    { value: '1', label: '1', sub: t('calc.month', 'month') },
    { value: '3', label: '3', sub: t('calc.months', 'months') },
    { value: '6', label: '6', sub: t('calc.months', 'months') },
    { value: '12', label: '12', sub: t('calc.months', 'months') },
  ];

  const EMPLOYMENT_TYPES = [
    { key: 'full_time', label: t('applyForm.fullTime', 'Full Time'), icon: 'briefcase' as const },
    { key: 'part_time', label: t('applyForm.partTime', 'Part Time'), icon: 'time' as const },
    { key: 'self_employed', label: t('applyForm.selfEmployed', 'Self Employed'), icon: 'person' as const },
    { key: 'other', label: t('applyForm.other', 'Other'), icon: 'ellipsis-horizontal' as const },
  ];

  const STEPS = [
    { label: t('applyForm.stepLoan', 'Loan'), icon: 'cash-outline' as const },
    { label: t('applyForm.stepPersonal', 'Personal'), icon: 'person-outline' as const },
    { label: t('applyForm.stepEmployment', 'Employment'), icon: 'briefcase-outline' as const },
    { label: t('applyForm.stepBank', 'Bank'), icon: 'business-outline' as const },
    { label: t('applyForm.stepDocs', 'Docs'), icon: 'document-outline' as const },
  ];

  const AMOUNT_PRESETS = [300, 500, 1000, 1500, 2500, 5000];

  // Helpers
  const formatPhone = (text: string) => {
    const c = text.replace(/\D/g, '').slice(0, 10);
    if (c.length >= 7) return `(${c.slice(0, 3)}) ${c.slice(3, 6)}-${c.slice(6)}`;
    if (c.length >= 4) return `(${c.slice(0, 3)}) ${c.slice(3)}`;
    if (c.length > 0) return `(${c}`;
    return '';
  };
  const formatDOB = (text: string) => {
    const c = text.replace(/\D/g, '').slice(0, 8);
    if (c.length >= 5) return `${c.slice(0, 2)}/${c.slice(2, 4)}/${c.slice(4)}`;
    if (c.length >= 3) return `${c.slice(0, 2)}/${c.slice(2)}`;
    return c;
  };
  const formatZip = (t: string) => t.replace(/\D/g, '').slice(0, 5);
  const formatSSN4 = (t: string) => t.replace(/\D/g, '').slice(0, 4);
  const formatSSN = (text: string) => {
    const c = text.replace(/\D/g, '').slice(0, 9);
    if (c.length >= 6) return `${c.slice(0, 3)}-${c.slice(3, 5)}-${c.slice(5)}`;
    if (c.length >= 4) return `${c.slice(0, 3)}-${c.slice(3)}`;
    return c;
  };
  const formatRouting = (t: string) => t.replace(/\D/g, '').slice(0, 9);

  // Derived
  const amt = parseFloat(form.amount) || 0;
  const selectedPurpose = PURPOSES.find(p => p.key === form.purpose || p.label === form.purpose);

  // Validation
  const canAdvance = (s: number) => {
    switch (s) {
      case 0: return !!form.amount && !!form.purpose && amt >= 200;
      case 1: return !!form.first_name && !!form.last_name && form.phone.length >= 10 && !!form.date_of_birth && form.ssn.replace(/\D/g, '').length === 9;
      case 2: return !!form.employer && !!form.monthly_income;
      case 3: {
        // At least ONE: Plaid connected OR manual routing+account entered
        const hasManualBank = form.routing_number.replace(/\D/g, '').length === 9 && form.account_number.replace(/\D/g, '').length >= 4;
        return plaidConnected || hasManualBank;
      }
      case 4: return !!localDocs['photo_id'] && !!localDocs['pay_stub'] && !!localDocs['proof_address'] && tcpaConsent;
      default: return false;
    }
  };

  // ═══ PLAID CONNECT ═══
  const connectPlaid = async () => {
    setPlaidLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/plaid/create-link-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ context: 'personal' }),
      });
      if (!res.ok) throw new Error('Failed to create link token');
      const data = await res.json();
      const linkToken = data.link_token;

      plaidCreate({
        token: linkToken,
        noLoadingState: false,
      });

      plaidOpen({
        onSuccess: async (success: any) => {
          try {
            // Exchange public token
            const exRes = await fetch(`${API_URL}/api/plaid/exchange-token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({
                public_token: success.publicToken,
                institution: success.metadata?.institution || {},
                context: 'personal',
              }),
            });
            if (exRes.ok) {
              const exData = await exRes.json();
              const bankName = exData.institution_name || success.metadata?.institution?.name || 'Bank';
              setPlaidBankName(bankName);

              // Fetch auth to get routing/account numbers
              const authRes = await fetch(`${API_URL}/api/plaid/fetch-my-auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ context: 'personal' }),
              });
              if (authRes.ok) {
                const authData = await authRes.json();
                if (authData.success && authData.saved_accounts > 0) {
                  // Auto-populate bank fields
                  update('bank_name', bankName);
                }
              }
              setPlaidConnected(true);
              setShowManualBank(false);
              Alert.alert('✅', t('applyForm.plaidSuccess', 'Bank connected successfully!'));
            }
          } catch (err) {
            console.error('Plaid exchange error:', err);
          }
          setPlaidLoading(false);
          plaidDismiss();
        },
        onExit: (exit: any) => {
          setPlaidLoading(false);
          plaidDismiss();
          if (exit.error) {
            console.log('Plaid exit error:', exit.error);
          }
        },
        iOSPresentationStyle: PlaidPresentationStyle.MODAL,
      });
    } catch (err) {
      console.error('Plaid connect error:', err);
      setPlaidLoading(false);
      Alert.alert(t('common.error'), t('applyForm.plaidError', 'Could not connect to bank. Try entering manually.'));
      setShowManualBank(true);
    }
  };

  // ═══ DOCUMENT PICKER ═══
  const DOC_TYPES = [
    { key: 'photo_id', icon: 'id-card-outline' as const, required: true },
    { key: 'pay_stub', icon: 'cash-outline' as const, required: true },
    { key: 'proof_address', icon: 'home-outline' as const, required: true },
    { key: 'bank_statement', icon: 'business-outline' as const, required: false },
    { key: 'other', icon: 'document-outline' as const, required: false },
  ];

  const docLabels: { [key: string]: string } = {
    photo_id: t('applyForm.docPhotoId', 'Photo ID (License/Passport)'),
    pay_stub: t('applyForm.docPayStub', 'Pay Stub / Income Proof'),
    proof_address: t('applyForm.docProofAddress', 'Proof of Address'),
    bank_statement: t('applyForm.docBankStatement', 'Bank Statement'),
    other: t('applyForm.docOther', 'Other Document'),
  };

  const pickDoc = async (docType: string, useCamera: boolean) => {
    try {
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { Alert.alert(t('profile.permissionRequired'), t('common.needCameraAccess', 'Camera access needed')); return; }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { Alert.alert(t('profile.permissionRequired'), t('common.needGalleryAccess', 'Gallery access needed')); return; }
      }
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.7, base64: true })
        : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.7, base64: true });

      if (result.canceled || !result.assets?.[0]?.base64) return;
      const asset = result.assets[0];
      setLocalDocs(prev => ({ ...prev, [docType]: { uri: asset.uri, base64: asset.base64!, name: `${docType}_${Date.now()}.jpg` } }));
    } catch (e) { console.error('Pick doc error:', e); }
  };

  const showDocOptions = (docType: string) => {
    Alert.alert(
      docLabels[docType] || docType,
      t('applyForm.docUploadHow', 'How do you want to add this document?'),
      [
        { text: t('applyForm.takePhoto', '📷 Take Photo'), onPress: () => pickDoc(docType, true) },
        { text: t('applyForm.fromGallery', '🖼️ From Gallery'), onPress: () => pickDoc(docType, false) },
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      ]
    );
  };

  const handleSubmit = async () => {
    setLoading(true);
    setShowProcessing(true);
    try {
      // 1. Sync personal data back to profile (bidirectional sync)
      try {
        await fetch(`${API_URL}/api/users/me`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            name: `${form.first_name.trim()} ${form.last_name.trim()}`,
            first_name: form.first_name.trim(),
            last_name: form.last_name.trim(),
            phone: form.phone,
            email: form.email || undefined,
            date_of_birth: form.date_of_birth || undefined,
            ssn_encrypted: form.ssn.replace(/\D/g, '') || undefined,
            address_street: form.address_street || undefined,
            address_city: form.address_city || undefined,
            address_state: form.address_state || undefined,
            address_zip: form.address_zip || undefined,
            employer: form.employer || undefined,
            employment_type: form.employment_type || undefined,
            time_at_employer: form.time_at_employer || undefined,
            monthly_income: form.monthly_income || undefined,
          }),
        });
      } catch (syncErr) {
        console.log('Profile sync error (non-blocking):', syncErr);
      }

      // 2. Submit the loan application
      const res = await fetch(`${API_URL}/api/loans/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const appId = data.application_id || data.id;
        setApplicationId(appId);

        // 3. Upload any documents the user selected
        const docKeys = Object.keys(localDocs);
        if (appId && docKeys.length > 0) {
          const uploaded: string[] = [];
          for (const docKey of docKeys) {
            try {
              setUploadingDoc(docKey);
              const docData = localDocs[docKey];
              const uploadRes = await fetch(`${API_URL}/api/loans/applications/${appId}/upload-document`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                  doc_type: docKey,
                  file_data: docData.base64,
                  file_name: docData.name,
                }),
              });
              if (uploadRes.ok) uploaded.push(docKey);
            } catch (docErr) {
              console.log(`Doc upload error (${docKey}):`, docErr);
            }
          }
          setDocsUploaded(uploaded);
          setUploadingDoc(null);
        }

        setSubmitted(true);
        setShowProcessing(false);
      } else {
        setShowProcessing(false);
        Alert.alert(t('common.error'), data.detail || t('applyForm.submitError', 'Error submitting application'));
      }
    } catch {
      setShowProcessing(false);
      Alert.alert(t('common.error'), t('common.connectionError', 'Could not connect to server.'));
    }
    setLoading(false);
  };

  // ═══ ELIGIBILITY LOADING ═══
  if (eligibilityLoading) {
    return (
      <SafeAreaView style={S.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <ActivityIndicator size="large" color={Colors.primaryLight} />
          <Text style={{ color: '#999', marginTop: 16, fontSize: 14 }}>
            {t('applyForm.checkingEligibility', 'Verificando elegibilidad...')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ═══ BLOCKED — ACTIVE LOAN OR PENDING APPLICATION ═══
  if (canApply === false) {
    const isLoan = blockingType === 'active_loan';
    const iconName = isLoan ? 'shield-checkmark' : 'hourglass';
    const titleText = isLoan
      ? t('applyForm.activeLoanTitle', 'Préstamo Activo')
      : t('applyForm.pendingAppTitle', 'Solicitud en Proceso');
    const btnText = isLoan
      ? t('applyForm.viewMyLoan', 'Ver mi préstamo')
      : t('applyForm.viewMyApplication', 'Ver mi solicitud');

    return (
      <SafeAreaView style={S.container}>
        <ScrollView contentContainerStyle={{ padding: 32, alignItems: 'center', justifyContent: 'center', flexGrow: 1 }}>
          <View style={{
            width: 80, height: 80, borderRadius: 40,
            backgroundColor: isLoan ? 'rgba(255,170,0,0.15)' : 'rgba(100,149,237,0.15)',
            justifyContent: 'center', alignItems: 'center', marginBottom: 24,
          }}>
            <Ionicons name={iconName} size={40} color={isLoan ? '#ffaa00' : '#6495ED'} />
          </View>
          <Text style={{
            fontSize: 22, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 12,
          }}>{titleText}</Text>
          <Text style={{
            fontSize: 15, color: '#aab4c8', textAlign: 'center', lineHeight: 22, marginBottom: 24, paddingHorizontal: 16,
          }}>{eligibilityReason}</Text>

          {blockingData && isLoan && (
            <View style={{
              backgroundColor: '#1a2235', borderRadius: 16, padding: 20, width: '100%', marginBottom: 24,
              borderWidth: 1, borderColor: '#2a3550',
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text style={{ color: '#8892a8', fontSize: 13 }}>{t('applyForm.loanNumber', 'Préstamo')}</Text>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{blockingData.loan_number}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text style={{ color: '#8892a8', fontSize: 13 }}>{t('applyForm.amount', 'Monto')}</Text>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>${(blockingData.amount || 0).toLocaleString()}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: '#8892a8', fontSize: 13 }}>{t('applyForm.remainingBalance', 'Balance pendiente')}</Text>
                <Text style={{ color: '#ffaa00', fontSize: 14, fontWeight: '700' }}>${(blockingData.balance || 0).toLocaleString()}</Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={{
              backgroundColor: Colors.primaryLight, borderRadius: 14, paddingVertical: 16,
              paddingHorizontal: 32, width: '100%', alignItems: 'center', marginBottom: 12,
            }}
            onPress={() => {
              if (isLoan) {
                router.push('/(tabs)');
              } else {
                router.push('/loan/application-status');
              }
            }}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{btnText}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ paddingVertical: 12 }}
            onPress={() => router.push('/(tabs)')}
          >
            <Text style={{ color: '#6495ED', fontSize: 14 }}>{t('common.goBack', 'Volver al inicio')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ═══ SUCCESS SCREEN ═══
  if (submitted) {
    const docCount = Object.keys(localDocs).length;
    const uploadedCount = docsUploaded.length;
    return (
      <SafeAreaView style={S.container}>
        <ScrollView contentContainerStyle={{ padding: 32, alignItems: 'center', justifyContent: 'center', flexGrow: 1 }}>
          <View style={S.successIcon}><Ionicons name="checkmark-circle" size={64} color={Colors.primaryLight} /></View>
          <Text style={S.successTitle}>{t('apply.submittedTitle')}</Text>
          <Text style={S.successSub}>{t('apply.submittedMsg')}</Text>

          {/* Document status */}
          {docCount > 0 && (
            <View style={[S.successInfo, { marginTop: 16 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Ionicons name="document-attach" size={18} color={Colors.primaryLight} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.text }}>
                  {t('apply.docsUploadedCount', { uploaded: uploadedCount, total: docCount })}
                </Text>
              </View>
              {DOC_TYPES.filter(d => localDocs[d.key]).map(d => (
                <View key={d.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Ionicons name={docsUploaded.includes(d.key) ? 'checkmark-circle' : 'time'} size={16}
                    color={docsUploaded.includes(d.key) ? Colors.success : Colors.accent} />
                  <Text style={{ fontSize: 13, color: Colors.textSecondary }}>{docLabels[d.key]}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={S.successInfo}>
            <InfoRow icon="id-card-outline" text={t('apply.prepareId')} />
            <InfoRow icon="document-outline" text={t('apply.preparePaystub')} />
            <InfoRow icon="call-outline" text={t('apply.willCall', { phone: form.phone || t('apply.willCallDefault') })} />
          </View>
          <TouchableOpacity onPress={() => { 
            Keyboard.dismiss(); 
            setTimeout(() => { 
              try { router.push('/loan/application-status'); } 
              catch (e) { console.error('Navigation error:', e); Alert.alert('Error', 'No se pudo abrir el estado de la aplicación'); } 
            }, 100); 
          }}>
            <LinearGradient colors={Gradients.primary} style={S.newBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={S.newBtnText}>{t('applyForm.viewStatus', 'Ver Estado de Solicitud')}</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => {
            setSubmitted(false); safeSetStep(0);
            setPlaidConnected(false); setPlaidBankName(''); setShowManualBank(false);
            setLocalDocs({}); setDocsUploaded([]); setApplicationId(null);
            setForm({ loan_type: 'hybrid', amount: '', purpose: '', preferred_term: '3',
              first_name: '', last_name: '', date_of_birth: '', ssn: '',
              phone: '', email: '', address_street: '', address_city: '', address_state: 'TX', address_zip: '',
              employer: '', employment_type: 'full_time', time_at_employer: '', monthly_income: '', notes: '',
              bank_name: '', routing_number: '', account_number: '', account_type: 'checking' });
          }}>
            <View style={{ marginTop: 12, paddingVertical: 12, paddingHorizontal: 20, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border }}>
              <Text style={{ color: Colors.textMuted, fontWeight: '600', fontSize: 13, textAlign: 'center' }}>{t('apply.newApplication')}</Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ═══ MAIN FORM ═══
  return (
    <SafeAreaView style={S.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={S.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* ═══ PROGRESS BAR (MoneyLion Style) ═══ */}
          <View style={S.progressContainer}>
            {/* Horizontal progress bar */}
            <View style={S.progressBarBg}>
              <View style={[S.progressBarFill, { width: `${((step + 1) / STEPS.length) * 100}%` }]} />
            </View>
            {/* Step labels */}
            <View style={S.progressRow}>
              {STEPS.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  style={S.progressStep}
                  onPress={() => { if (i < step) safeSetStep(i); }}
                  activeOpacity={i < step ? 0.7 : 1}
                >
                  <View style={[S.progressDot, step >= i && S.progressDotActive, step === i && S.progressDotCurrent]}>
                    {step > i ? (
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    ) : (
                      <Ionicons name={s.icon} size={14} color={step >= i ? '#fff' : Colors.textMuted} />
                    )}
                  </View>
                  <Text style={[S.progressLabel, step >= i && { color: Colors.primaryLight }]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ═════════════════════════════════════════════ */}
          {/* STEP 0: LOAN — Clean, focused layout         */}
          {/* ═════════════════════════════════════════════ */}
          {step === 0 && (
            <>
              {/* ═══ CREDIT TIER BANNER ═══ */}
              {creditTier && (
                <View style={{ backgroundColor: creditTier.tier === 'trusted' ? 'rgba(52,211,153,0.08)' : creditTier.tier === 'returning' ? 'rgba(59,130,246,0.08)' : 'rgba(217,119,6,0.08)', borderWidth: 1, borderColor: creditTier.tier === 'trusted' ? 'rgba(52,211,153,0.2)' : creditTier.tier === 'returning' ? 'rgba(59,130,246,0.2)' : 'rgba(217,119,6,0.2)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
                  <Text style={{ color: creditTier.tier === 'trusted' ? '#34d399' : creditTier.tier === 'returning' ? '#60a5fa' : Colors.primaryLight, fontSize: 13, fontWeight: '700' }}>
                    {creditTier.tier === 'trusted' ? '⭐ ' : creditTier.tier === 'returning' ? '🔄 ' : '👋 '}
                    {i18n.language === 'es' ? creditTier.description_es : creditTier.description_en}
                  </Text>
                </View>
              )}

              {/* ═══ LOAN AMOUNT SLIDER ═══ */}
              <View style={S.sliderCard}>
                <Text style={S.sliderTitle}>{t('applyForm.howMuch', 'How much do you need?')}</Text>
                <LoanAmountSlider
                  value={Number(form.amount) || 300}
                  onValueChange={(val) => update('amount', String(Math.min(val, creditTier?.max_amount || 1800)))}
                  min={200}
                  max={creditTier?.max_amount || 1800}
                  step={50}
                />
                {/* Quick Amount Chips — based on credit tier */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                  <View style={S.presetsRow}>
                    {(creditTier?.suggested_amounts || [200, 300, 500]).map((a: number) => {
                      const active = Number(form.amount) === a;
                      return (
                        <TouchableOpacity
                          key={a}
                          style={[S.presetChip, active && S.presetChipActive]}
                          onPress={() => update('amount', String(a))}
                        >
                          <Text style={[S.presetText, active && S.presetTextActive]}>
                            ${a >= 1000 ? `${(a / 1000)}k` : a}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>

              {/* No Credit Impact Banner */}
              <TrustBanner variant="inline" />

              {/* ═══ LOAN PAYMENT OPTIONS ═══ */}
              {loanOptions.length > 0 && (
                <View style={S.fieldSection}>
                  <Text style={S.fieldLabel}>{t('applyForm.selectPlan', 'Select Your Payment Plan')}</Text>
                  <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 12 }}>
                    {t('applyForm.planDisclaimer', 'Longer terms = lower payments, but more interest.')}
                  </Text>

                  {loadingOptions ? (
                    <ActivityIndicator color={Colors.primaryLight} size="small" />
                  ) : (
                    <View style={{ gap: 10 }}>
                      {loanOptions.map(opt => {
                        const active = form.preferred_term === String(opt.term_months);
                        const borrowingCost = (opt.total_interest || 0) + (opt.admin_fee || 0);
                        return (
                          <TouchableOpacity
                            key={opt.term_months}
                            style={[
                              {
                                backgroundColor: active ? 'rgba(16,185,129,0.06)' : Colors.surface,
                                borderWidth: active ? 1.5 : 1,
                                borderColor: active ? Colors.primaryLight : Colors.border,
                                borderRadius: 16, padding: 16, overflow: 'hidden',
                              },
                            ]}
                            onPress={() => update('preferred_term', String(opt.term_months))}
                            activeOpacity={0.7}
                          >
                            {/* Top Row: Weekly + radio */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                                <Text style={{ color: active ? Colors.primaryLight : '#fff', fontSize: 24, fontWeight: '800' }}>
                                  ${opt.weekly_payment.toFixed(0)}
                                </Text>
                                <Text style={{ color: active ? Colors.primaryLight : Colors.textMuted, fontSize: 13, fontWeight: '600' }}>
                                  /{t('calc.week', 'wk')}
                                </Text>
                              </View>
                              <View style={{
                                width: 26, height: 26, borderRadius: 13,
                                borderWidth: 2,
                                borderColor: active ? Colors.primaryLight : Colors.border,
                                backgroundColor: active ? Colors.primaryLight : 'transparent',
                                alignItems: 'center', justifyContent: 'center',
                              }}>
                                {active && <Ionicons name="checkmark" size={16} color="#fff" />}
                              </View>
                            </View>

                            {/* Monthly breakdown */}
                            <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 4 }}>
                              ${opt.monthly_payment.toFixed(2)}/{t('calc.month', 'mo')} × {opt.term_months} {opt.term_months === 1 ? t('calc.month', 'month') : t('calc.months', 'months')}
                            </Text>

                            {/* Fee breakdown - transparent */}
                            <View style={{
                              flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8,
                              paddingTop: 8, borderTopWidth: 1, borderTopColor: active ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
                            }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#60a5fa' }} />
                                <Text style={{ color: '#94a3b8', fontSize: 10 }}>
                                  {t('applyForm.interestLabel', 'Interest')}: <Text style={{ color: '#cbd5e1', fontWeight: '600' }}>${opt.total_interest.toFixed(2)}</Text>
                                </Text>
                              </View>
                              {opt.admin_fee > 0 && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#a78bfa' }} />
                                  <Text style={{ color: '#94a3b8', fontSize: 10 }}>
                                    {t('applyForm.adminFee', 'Fee')}: <Text style={{ color: '#cbd5e1', fontWeight: '600' }}>${opt.admin_fee.toFixed(2)}</Text>
                                  </Text>
                                </View>
                              )}
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primaryLight }} />
                                <Text style={{ color: '#94a3b8', fontSize: 10 }}>
                                  {t('applyForm.totalRepay', 'Total to repay')}: <Text style={{ color: '#fff', fontWeight: '700' }}>${opt.total_to_pay.toFixed(2)}</Text>
                                </Text>
                              </View>
                            </View>

                            {/* Cost of borrowing summary */}
                            <View style={{
                              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                              marginTop: 6, backgroundColor: active ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)',
                              borderRadius: 8, paddingVertical: 5, paddingHorizontal: 8,
                            }}>
                              <Text style={{ color: '#64748b', fontSize: 9, fontWeight: '500' }}>
                                {t('applyForm.borrowingCost', 'Cost of borrowing')}
                              </Text>
                              <Text style={{ color: active ? Colors.primaryLight : '#94a3b8', fontSize: 11, fontWeight: '700' }}>
                                ${borrowingCost.toFixed(2)}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}

              {/* Purpose — Tap to open picker */}
              <View style={S.fieldSection}>
                <Text style={S.fieldLabel}>{t('applyForm.whatFor', 'What is it for?')}</Text>
                <TouchableOpacity
                  style={S.purposeSelector}
                  onPress={() => setShowPurposePicker(true)}
                  activeOpacity={0.7}
                >
                  {selectedPurpose ? (
                    <View style={S.purposeSelected}>
                      <View style={S.purposeIconWrap}>
                        <Ionicons name={selectedPurpose.icon} size={20} color={Colors.primaryLight} />
                      </View>
                      <Text style={S.purposeSelectedText}>{selectedPurpose.label}</Text>
                      <Ionicons name="chevron-down" size={18} color={Colors.textMuted} />
                    </View>
                  ) : (
                    <View style={S.purposeSelected}>
                      <Ionicons name="help-circle-outline" size={20} color={Colors.textMuted} />
                      <Text style={S.purposePlaceholder}>{t('applyForm.selectPurpose', 'Select purpose')}</Text>
                      <Ionicons name="chevron-down" size={18} color={Colors.textMuted} />
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* CTA */}
              <TouchableOpacity onPress={() => safeSetStep(1)} disabled={!canAdvance(0)} activeOpacity={0.8} style={{ marginTop: 8 }}>
                <LinearGradient
                  colors={canAdvance(0) ? Gradients.primary as any : [Colors.border, Colors.border]}
                  style={S.ctaBtn}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={[S.ctaBtnText, !canAdvance(0) && { color: Colors.textMuted }]}>{t('applyForm.next')}</Text>
                  <Ionicons name="arrow-forward" size={18} color={canAdvance(0) ? '#fff' : Colors.textMuted} />
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

          {/* ═══ STEP 1: PERSONAL ═══ */}
          {step === 1 && (
            <View style={S.stepCard}>
              <View style={S.stepHeader}>
                <View style={S.stepIconWrap}><Ionicons name="person" size={20} color={Colors.primaryLight} /></View>
                <Text style={S.stepTitle}>{t('applyForm.personalInfo')}</Text>
              </View>

              <View style={S.twoCol}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={S.inputLabel}>{t('applyForm.firstName', 'First Name')} *</Text>
                  <View style={[S.input, S.lockedField]}>
                    <Text style={S.lockedText}>{form.first_name || '—'}</Text>
                    <Ionicons name="lock-closed" size={14} color="#6B7280" />
                  </View>
                </View>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={S.inputLabel}>{t('applyForm.lastName', 'Last Name')} *</Text>
                  <View style={[S.input, S.lockedField]}>
                    <Text style={S.lockedText}>{form.last_name || '—'}</Text>
                    <Ionicons name="lock-closed" size={14} color="#6B7280" />
                  </View>
                </View>
              </View>

              <View style={S.twoCol}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={S.inputLabel}>{t('applyForm.dob', 'Date of Birth')} *</Text>
                  <TextInput style={S.input} value={form.date_of_birth}
                    onChangeText={v => update('date_of_birth', formatDOB(v))}
                    placeholder="MM/DD/AAAA" placeholderTextColor={Colors.textDim} keyboardType="number-pad" maxLength={10} />
                </View>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={S.inputLabel}>{t('applyForm.ssnLabel', 'SSN (9 digits)')} *</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TextInput style={[S.input, { flex: 1 }]}
                      value={ssnVisible ? formatSSN(form.ssn) : (form.ssn ? `***-**-${form.ssn.replace(/\D/g, '').slice(-4)}` : '')}
                      onChangeText={v => { update('ssn', v.replace(/\D/g, '').slice(0, 9)); setSsnVisible(true); }}
                      onFocus={() => setSsnVisible(true)}
                      placeholder="XXX-XX-XXXX" placeholderTextColor={Colors.textDim}
                      keyboardType="number-pad" maxLength={11} />
                    <TouchableOpacity onPress={() => setSsnVisible(!ssnVisible)} style={{ marginLeft: -40, padding: 10 }}>
                      <Ionicons name={ssnVisible ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <Text style={S.inputLabel}>{t('personalData.phone', 'Phone')} *</Text>
              <View style={[S.input, S.lockedField]}>
                <Text style={S.lockedText}>{form.phone || '—'}</Text>
                <Ionicons name="lock-closed" size={14} color="#6B7280" />
              </View>

              <Text style={S.inputLabel}>{t('personalData.email', 'Email')}</Text>
              <View style={[S.input, S.lockedField]}>
                <Text style={S.lockedText}>{form.email || '—'}</Text>
                <Ionicons name="lock-closed" size={14} color="#6B7280" />
              </View>

              <View style={S.divider} />

              {/* Google Places Address Autocomplete */}
              <AddressAutocomplete
                label={t('personalData.address', 'Address')}
                value={form.address_street}
                onChangeText={v => update('address_street', v)}
                placeholder="1234 Main St, Houston, TX..."
                onAddressSelected={(components) => {
                  update('address_street', components.street);
                  if (components.city) update('address_city', components.city);
                  if (components.state) update('address_state', components.state);
                  if (components.zip) update('address_zip', components.zip);
                  setAddressValid(null);
                }}
              />

              <View style={S.threeCol}>
                <View style={{ flex: 2, marginRight: 6 }}>
                  <Text style={S.inputLabel}>{t('personalData.city', 'City')}</Text>
                  <TextInput style={S.input} value={form.address_city} onChangeText={v => update('address_city', v)}
                    placeholder="Houston" placeholderTextColor={Colors.textDim} autoCapitalize="words" />
                </View>
                <View style={{ flex: 1, marginHorizontal: 3 }}>
                  <Text style={S.inputLabel}>{t('personalData.state', 'State')}</Text>
                  <TextInput style={S.input} value={form.address_state} onChangeText={v => update('address_state', v.toUpperCase().slice(0, 2))}
                    placeholder="TX" placeholderTextColor={Colors.textDim} maxLength={2} autoCapitalize="characters" />
                </View>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={S.inputLabel}>ZIP</Text>
                  <TextInput style={S.input} value={form.address_zip}
                    onChangeText={v => { update('address_zip', formatZip(v)); setAddressValid(null); }}
                    placeholder="77001" placeholderTextColor={Colors.textDim} keyboardType="number-pad" maxLength={5} />
                </View>
              </View>

              {/* USPS Address Validation */}
              <TouchableOpacity onPress={validateAddress} disabled={addressValidating || !form.address_street || !form.address_zip}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  paddingVertical: 10, borderRadius: 10, marginBottom: 8,
                  backgroundColor: addressValid === true ? 'rgba(5,150,105,0.08)' : addressValid === false ? 'rgba(220,38,38,0.08)' : Colors.surface,
                  borderWidth: 1,
                  borderColor: addressValid === true ? 'rgba(5,150,105,0.3)' : addressValid === false ? 'rgba(220,38,38,0.3)' : Colors.border,
                }}>
                {addressValidating ? <ActivityIndicator size="small" color={Colors.primaryLight} /> : (
                  <>
                    <Ionicons name={addressValid === true ? 'checkmark-circle' : addressValid === false ? 'alert-circle' : 'location'}
                      size={16} color={addressValid === true ? Colors.primaryLight : addressValid === false ? '#dc2626' : Colors.textMuted} />
                    <Text style={{
                      fontSize: 13, fontWeight: '600',
                      color: addressValid === true ? Colors.primaryLight : addressValid === false ? '#dc2626' : Colors.textMuted,
                    }}>
                      {addressValid !== null ? addressMsg : t('applyForm.verifyAddress', 'Verify Address (USPS)')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <NavBtns back={() => safeSetStep(0)} next={() => safeSetStep(2)} ok={canAdvance(1)} />
            </View>
          )}

          {/* ═══ STEP 2: EMPLOYMENT ═══ */}
          {step === 2 && (
            <View style={S.stepCard}>
              <View style={S.stepHeader}>
                <View style={S.stepIconWrap}><Ionicons name="briefcase" size={20} color={Colors.primaryLight} /></View>
                <Text style={S.stepTitle}>{t('applyForm.employmentIncome', 'Employment & Income')}</Text>
              </View>

              <View style={S.empGrid}>
                {EMPLOYMENT_TYPES.map(et => {
                  const active = form.employment_type === et.key;
                  return (
                    <TouchableOpacity key={et.key} onPress={() => update('employment_type', et.key)}
                      style={[S.empCard, active && S.empCardActive]}>
                      <Ionicons name={et.icon} size={24} color={active ? Colors.primaryLight : Colors.textMuted} />
                      <Text style={[S.empCardLabel, active && { color: Colors.primaryLight }]}>{et.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={S.inputLabel}>{t('personalData.employer', 'Employer')} *</Text>
              <View style={{ zIndex: 10 }}>
                <TextInput style={S.input} value={form.employer}
                  onChangeText={v => { update('employer', v); searchEmployers(v); }}
                  onFocus={() => { if (form.employer.length >= 2) searchEmployers(form.employer); }}
                  onBlur={() => setTimeout(() => setShowEmployerDropdown(false), 200)}
                  placeholder={t("applyForm.companyNamePH", "Company name")} placeholderTextColor={Colors.textDim} autoCapitalize="words" />
                {showEmployerDropdown && employerSuggestions.length > 0 && (
                  <View style={S.autocompleteDropdown}>
                    {employerSuggestions.map((emp, idx) => (
                      <TouchableOpacity key={idx} style={S.autocompleteItem}
                        onPress={() => { update('employer', emp.name); setShowEmployerDropdown(false); Keyboard.dismiss(); }}>
                        <Ionicons name="business-outline" size={16} color={Colors.primaryLight} />
                        <View style={{ flex: 1 }}>
                          <Text style={S.autocompleteText}>{emp.name}</Text>
                          {emp.industry ? <Text style={S.autocompleteSub}>{emp.industry}{emp.city ? ` · ${emp.city}` : ''}</Text> : null}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <Text style={S.inputLabel}>{t('applyForm.timeAtJob', 'Time at job')}</Text>
              <TouchableOpacity
                onPress={() => {
                  const opts = [
                    { key: 'less_6mo', label: t('applyForm.timeLess6', '< 6 months') },
                    { key: '6mo_1yr', label: t('applyForm.time6to1', '6 mo - 1 year') },
                    { key: '1_2yr', label: t('applyForm.time1to2', '1 - 2 years') },
                    { key: '2_5yr', label: t('applyForm.time2to5', '2 - 5 years') },
                    { key: '5plus', label: t('applyForm.time5plus', '5+ years') },
                  ];
                  Alert.alert(
                    t('applyForm.timeAtJob', 'Time at job'),
                    t('applyForm.selectTime', 'Select how long you have been at your current job'),
                    [
                      ...opts.map(o => ({
                        text: o.label,
                        onPress: () => update('time_at_employer', o.key),
                      })),
                      { text: t('common.cancel', 'Cancel'), style: 'cancel' as const },
                    ]
                  );
                }}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1.5,
                  borderColor: form.time_at_employer ? Colors.primaryLight : Colors.border,
                  paddingHorizontal: 14, paddingVertical: 14, marginBottom: 14,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="time-outline" size={16} color={form.time_at_employer ? Colors.primaryLight : Colors.textMuted} />
                  <Text style={{
                    fontSize: 14, fontWeight: form.time_at_employer ? '600' : '400',
                    color: form.time_at_employer ? Colors.text : Colors.textDim,
                  }}>
                    {form.time_at_employer
                      ? [
                          { key: 'less_6mo', label: t('applyForm.timeLess6', '< 6 months') },
                          { key: '6mo_1yr', label: t('applyForm.time6to1', '6 mo - 1 year') },
                          { key: '1_2yr', label: t('applyForm.time1to2', '1 - 2 years') },
                          { key: '2_5yr', label: t('applyForm.time2to5', '2 - 5 years') },
                          { key: '5plus', label: t('applyForm.time5plus', '5+ years') },
                        ].find(o => o.key === form.time_at_employer)?.label || form.time_at_employer
                      : t('applyForm.selectOption', 'Select an option')
                    }
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={18} color={Colors.textMuted} />
              </TouchableOpacity>

              <Text style={S.inputLabel}>{t('personalData.monthlyIncome', 'Monthly Income')} *</Text>
              <View style={S.amountRow}>
                <Text style={S.dollarSign}>$</Text>
                <TextInput style={[S.input, { flex: 1, paddingLeft: 30 }]} keyboardType="numeric"
                  value={form.monthly_income} onChangeText={v => update('monthly_income', v.replace(/[^0-9.]/g, ''))}
                  placeholder="2,500" placeholderTextColor={Colors.textDim} />
                <Text style={S.perMonth}>/{t('applyForm.mo', 'mo')}</Text>
              </View>

              <Text style={S.inputLabel}>{t('applyForm.additionalNotes', 'Additional notes')}</Text>
              <TextInput style={[S.input, { height: 70, textAlignVertical: 'top' }]} multiline
                value={form.notes} onChangeText={v => update('notes', v)}
                placeholder={t("applyForm.notesPH", "Additional information...")} placeholderTextColor={Colors.textDim} />

              <NavBtns back={() => safeSetStep(1)} next={() => safeSetStep(3)} ok={canAdvance(2)} />
            </View>
          )}

          {/* ═══ STEP 3: BANK (Plaid + Manual) ═══ */}
          {step === 3 && (
            <View style={S.stepCard}>
              <View style={S.stepHeader}>
                <View style={S.stepIconWrap}><Ionicons name="business" size={20} color={Colors.primaryLight} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={S.stepTitle}>{t('applyForm.bankInfo')}</Text>
                  <Text style={S.stepSub}>{t('applyForm.bankSubRequired', 'Connect or enter your bank details')}</Text>
                </View>
              </View>

              {/* Plaid Connect Button */}
              {!plaidConnected ? (
                <TouchableOpacity onPress={connectPlaid} disabled={plaidLoading} activeOpacity={0.8} style={{ marginBottom: 16 }}>
                  <LinearGradient
                    colors={['#0A85EA', '#0066CC']}
                    style={{ borderRadius: 16, padding: 20, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 12 }}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  >
                    {plaidLoading ? <ActivityIndicator color="#fff" /> : (
                      <>
                        <Ionicons name="link" size={22} color="#fff" />
                        <View>
                          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{t('applyForm.connectBank', 'Connect Your Bank')}</Text>
                          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 }}>{t('applyForm.connectBankSub', 'Instant verification via Plaid')}</Text>
                        </View>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <View style={{ backgroundColor: 'rgba(5,150,105,0.08)', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(5,150,105,0.2)', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(5,150,105,0.15)', justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="checkmark-circle" size={24} color={Colors.primaryLight} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.text }}>{plaidBankName}</Text>
                    <Text style={{ fontSize: 12, color: Colors.primaryLight, marginTop: 2 }}>{t('applyForm.bankConnected', '✓ Bank verified and connected')}</Text>
                  </View>
                </View>
              )}

              {/* Manual Entry Toggle */}
              {!plaidConnected && (
                <TouchableOpacity onPress={() => setShowManualBank(!showManualBank)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, marginBottom: showManualBank ? 0 : 8 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: Colors.border }} />
                  <Text style={{ fontSize: 12, color: Colors.textMuted, fontWeight: '600' }}>{t('applyForm.orManually', 'or enter manually')}</Text>
                  <Ionicons name={showManualBank ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textMuted} />
                  <View style={{ flex: 1, height: 1, backgroundColor: Colors.border }} />
                </TouchableOpacity>
              )}

              {/* Manual Bank Fields */}
              {(showManualBank && !plaidConnected) && (
                <View>
                  <Text style={S.inputLabel}>{t('applyForm.bankName', 'Bank Name')}</Text>
                  <TextInput style={S.input} value={form.bank_name} onChangeText={v => update('bank_name', v)}
                    placeholder="Ej: Chase, Bank of America" placeholderTextColor={Colors.textDim} autoCapitalize="words" />

                  <View style={S.twoCol}>
                    <View style={{ flex: 1, marginRight: 6 }}>
                      <Text style={S.inputLabel}>{t('applyForm.routing', 'Routing (9 digits)')}</Text>
                      <TextInput style={S.input} value={form.routing_number}
                        onChangeText={v => {
                          const formatted = formatRouting(v);
                          update('routing_number', formatted);
                          lookupRoutingNumber(formatted);
                        }}
                        placeholder="021000021" placeholderTextColor={Colors.textDim} keyboardType="number-pad" maxLength={9} />
                      {/* Routing validation indicator */}
                      {form.routing_number.replace(/\D/g, '').length === 9 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                          {routingLooking ? (
                            <Text style={{ fontSize: 10, color: Colors.textMuted }}>Verificando...</Text>
                          ) : routingValid === false ? (
                            <>
                              <Ionicons name="close-circle" size={12} color="#EF4444" />
                              <Text style={{ fontSize: 10, color: '#EF4444' }}>Inválido</Text>
                            </>
                          ) : routingBankName ? (
                            <>
                              <Ionicons name="checkmark-circle" size={12} color={Colors.primaryLight} />
                              <Text style={{ fontSize: 10, color: Colors.primaryLight, fontWeight: '600' }} numberOfLines={1}>{routingBankName}</Text>
                            </>
                          ) : routingValid ? (
                            <>
                              <Ionicons name="checkmark-circle-outline" size={12} color={Colors.textMuted} />
                              <Text style={{ fontSize: 10, color: Colors.textMuted }}>Válido</Text>
                            </>
                          ) : null}
                        </View>
                      )}
                    </View>
                    <View style={{ flex: 1, marginLeft: 6 }}>
                      <Text style={S.inputLabel}>{t('applyForm.accountNumber', 'Account Number')}</Text>
                      <TextInput style={S.input} value={form.account_number}
                        onChangeText={v => update('account_number', v.replace(/\D/g, ''))}
                        placeholder="••••••••" placeholderTextColor={Colors.textDim} keyboardType="number-pad" secureTextEntry />
                    </View>
                  </View>

                  <View style={S.twoCol}>
                    {(['checking', 'savings'] as const).map(acctType => (
                      <TouchableOpacity key={acctType} style={[S.acctBtn, form.account_type === acctType && S.acctBtnActive]}
                        onPress={() => update('account_type', acctType)}>
                        <Ionicons name={acctType === 'checking' ? 'card-outline' : 'wallet-outline'} size={18}
                          color={form.account_type === acctType ? '#fff' : Colors.textMuted} />
                        <Text style={[S.acctBtnText, form.account_type === acctType && { color: '#fff' }]}>
                          {acctType === 'checking' ? t('applyForm.checking') : t('applyForm.savings')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Required bank info indicator */}
              {!plaidConnected && !(form.routing_number.replace(/\D/g, '').length === 9 && form.account_number.replace(/\D/g, '').length >= 4) && (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                  backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: 12, padding: 12,
                  borderWidth: 1, borderColor: 'rgba(245,158,11,0.15)', marginBottom: 10,
                }}>
                  <Ionicons name="alert-circle" size={18} color="#D97706" />
                  <Text style={{ flex: 1, fontSize: 12, color: '#D97706', fontWeight: '600' }}>
                    {t('applyForm.bankRequired', 'Connect your bank via Plaid or enter routing and account number to continue')}
                  </Text>
                </View>
              )}

              <View style={S.securityNote}>
                <Ionicons name="shield-checkmark" size={16} color={Colors.primaryLight} />
                <Text style={S.securityText}>{t('pm.securityInfo')}</Text>
              </View>

              <NavBtns back={() => safeSetStep(2)} next={() => safeSetStep(4)} ok={canAdvance(3)} />
            </View>
          )}

          {/* ═══ STEP 4: DOCUMENTS ═══ */}
          {step === 4 && (
            <View style={S.stepCard}>
              <View style={S.stepHeader}>
                <View style={S.stepIconWrap}><Ionicons name="document-text" size={20} color={Colors.primaryLight} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={S.stepTitle}>{t('applyForm.documentsTitle', 'Documents')}</Text>
                  <Text style={S.stepSub}>{t('applyForm.documentsSubRequired', 'Upload the 3 required documents to continue')}</Text>
                </View>
              </View>

              {/* Document upload cards */}
              {DOC_TYPES.map(doc => {
                const hasDoc = !!localDocs[doc.key];
                const isUploading = uploadingDoc === doc.key;
                return (
                  <TouchableOpacity
                    key={doc.key}
                    onPress={() => hasDoc ? undefined : showDocOptions(doc.key)}
                    activeOpacity={hasDoc ? 1 : 0.7}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 12,
                      backgroundColor: hasDoc ? 'rgba(5,150,105,0.06)' : Colors.surface,
                      borderRadius: 14, padding: 14, marginBottom: 10,
                      borderWidth: 1.5, borderColor: hasDoc ? 'rgba(5,150,105,0.2)' : Colors.border,
                    }}
                  >
                    {hasDoc && localDocs[doc.key]?.uri ? (
                      <Image source={{ uri: localDocs[doc.key].uri }} style={{ width: 44, height: 44, borderRadius: 10 }} />
                    ) : (
                      <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: doc.required ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' }}>
                        <Ionicons name={doc.icon} size={22} color={doc.required ? '#D97706' : Colors.textMuted} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.text }}>{docLabels[doc.key]}</Text>
                      <Text style={{ fontSize: 11, color: hasDoc ? Colors.primaryLight : Colors.textMuted, marginTop: 2 }}>
                        {hasDoc ? t('applyForm.docReady', '✓ Ready to upload') : doc.required ? t('applyForm.docRequired', 'Required') : t('applyForm.docOptional', 'Optional')}
                      </Text>
                    </View>
                    {isUploading ? (
                      <ActivityIndicator size="small" color={Colors.primaryLight} />
                    ) : hasDoc ? (
                      <TouchableOpacity onPress={() => setLocalDocs(prev => { const n = { ...prev }; delete n[doc.key]; return n; })} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Ionicons name="close-circle" size={22} color={Colors.textMuted} />
                      </TouchableOpacity>
                    ) : (
                      <Ionicons name="add-circle-outline" size={24} color={Colors.primaryLight} />
                    )}
                  </TouchableOpacity>
                );
              })}

              {/* Required items indicator */}
              {(!localDocs['photo_id'] || !localDocs['pay_stub'] || !localDocs['proof_address'] || !tcpaConsent) && (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                  backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: 12, padding: 12,
                  borderWidth: 1, borderColor: 'rgba(245,158,11,0.15)', marginBottom: 10,
                }}>
                  <Ionicons name="alert-circle" size={18} color="#D97706" />
                  <Text style={{ flex: 1, fontSize: 12, color: '#D97706', fontWeight: '600' }}>
                    {!tcpaConsent
                      ? t('applyForm.requiredDocsAndConsent', 'Upload all required documents and accept the consent to submit')
                      : t('applyForm.requiredDocsAll', 'Upload Photo ID, Pay Stub, and Proof of Address to continue')}
                  </Text>
                </View>
              )}

              <View style={S.disclaimer}>
                <Text style={S.disclaimerText}>{t('applyForm.disclaimer', 'By submitting this application, I authorize Ross Lending Solutions LLC to verify my personal, employment, and banking information to evaluate my eligibility.')}</Text>
              </View>

              {/* TCPA Consent */}
              <TouchableOpacity
                onPress={() => setTcpaConsent(!tcpaConsent)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 12,
                  backgroundColor: tcpaConsent ? 'rgba(5,150,105,0.06)' : Colors.surface,
                  borderRadius: 14,
                  padding: 14,
                  marginTop: 10,
                  borderWidth: 1.5,
                  borderColor: tcpaConsent ? 'rgba(5,150,105,0.2)' : Colors.border,
                }}
              >
                <View style={{
                  width: 24, height: 24, borderRadius: 6,
                  borderWidth: 2,
                  borderColor: tcpaConsent ? Colors.primaryLight : Colors.textMuted,
                  backgroundColor: tcpaConsent ? Colors.primaryLight : 'transparent',
                  justifyContent: 'center', alignItems: 'center',
                  marginTop: 2,
                }}>
                  {tcpaConsent && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
                <Text style={{ flex: 1, fontSize: 11, color: Colors.textSecondary, lineHeight: 16 }}>
                  {t('applyForm.tcpaConsent', 'By selecting this checkbox, I give consent to receive phone calls and text messages from Ross Lending Solutions LLC, or any authorized third party, at my phone number regarding my loan application, payment reminders, and account updates. I agree that such calls and/or texts may be conducted by automated dialing systems.')}
                </Text>
              </TouchableOpacity>

              {/* Trust Signals */}
              <View style={{ marginTop: 14 }}>
                <TrustBanner variant="card" />
              </View>

              {/* NMLS Footer */}
              <NMLSFooter compact showLinks={false} />

              <View style={S.navRow}>
                <TouchableOpacity style={S.backBtn} onPress={() => safeSetStep(3)}>
                  <Ionicons name="arrow-back" size={18} color={Colors.primaryLight} />
                  <Text style={S.backBtnText}>{t('applyForm.back', 'Back')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSubmit} disabled={loading || !canAdvance(4)} activeOpacity={0.8} style={{ flex: 1, marginLeft: 12 }}>
                  <LinearGradient colors={canAdvance(4) ? Gradients.accent : [Colors.border, Colors.border]}
                    style={[S.submitBtn, (loading || !canAdvance(4)) && { opacity: 0.6 }]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    {loading ? (
                      <View style={{ alignItems: 'center' }}>
                        <ActivityIndicator color={Colors.bg} />
                        {uploadingDoc && <Text style={{ color: Colors.bg, fontSize: 11, marginTop: 4 }}>{t('applyForm.uploadingDocs', 'Uploading docs...')}</Text>}
                      </View>
                    ) : (
                      <>
                        <Text style={S.submitBtnText}>{t('applyForm.submit')}</Text>
                        <Ionicons name="send" size={16} color={Colors.bg} />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={{ height: 30 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ═══ PREFILL OVERLAY — no Modal (crash-safe) ═══ */}
      {/* ═══ PURPOSE PICKER OVERLAY — no Modal (crash-safe) ═══ */}
      {showPurposePicker && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 997 }}>
          <TouchableOpacity style={S.modalOverlay} activeOpacity={1} onPress={() => setShowPurposePicker(false)}>
            <View style={S.pickerSheet}>
              <View style={S.pickerHandle} />
              <Text style={S.pickerTitle}>{t('applyForm.whyLoan', 'What do you need the loan for?')}</Text>
              <View style={S.pickerGrid}>
                {PURPOSES.map(p => {
                  const active = form.purpose === p.key || form.purpose === p.label;
                  return (
                    <TouchableOpacity
                      key={p.key}
                      style={[S.pickerItem, active && S.pickerItemActive]}
                      onPress={() => { update('purpose', p.key); setShowPurposePicker(false); }}
                      activeOpacity={0.7}
                    >
                      <View style={[S.pickerIconWrap, active && { backgroundColor: 'rgba(5,150,105,0.2)' }]}>
                        <Ionicons name={p.icon} size={24} color={active ? Colors.primaryLight : Colors.textMuted} />
                      </View>
                      <Text style={[S.pickerItemText, active && { color: Colors.primaryLight, fontWeight: '700' }]}>{p.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Processing Overlay - Simple conditional view, no Modal */}
      {showProcessing && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(12,18,32,0.97)', zIndex: 999 }}>
          <ProcessingScreen visible={showProcessing} />
        </View>
      )}
    </SafeAreaView>
  );
}

// ═══ SUB-COMPONENTS ═══
function InfoRow({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <Ionicons name={icon} size={18} color={Colors.primaryLight} />
      <Text style={{ fontSize: 13, color: Colors.primaryLight }}>{text}</Text>
    </View>
  );
}

function PrefillRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <Ionicons name={icon as any} size={15} color={Colors.primaryLight} />
      <Text style={{ color: Colors.text, fontSize: 13 }}>{text}</Text>
    </View>
  );
}

function NavBtns({ back, next, ok }: { back: () => void; next: () => void; ok: boolean }) {
  const { t } = useTranslation();
  return (
    <View style={S.navRow}>
      <TouchableOpacity style={S.backBtn} onPress={back}>
        <Ionicons name="arrow-back" size={18} color={Colors.primaryLight} />
        <Text style={S.backBtnText}>{t('applyForm.back', 'Back')}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={next} disabled={!ok} activeOpacity={0.8} style={{ flex: 1, marginLeft: 12 }}>
        <LinearGradient
          colors={ok ? Gradients.primary as any : [Colors.border, Colors.border]}
          style={S.ctaBtn}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        >
          <Text style={[S.ctaBtnText, !ok && { color: Colors.textMuted }]}>{t('applyForm.nextStep', 'Next')}</Text>
          <Ionicons name="arrow-forward" size={18} color={ok ? '#fff' : Colors.textMuted} />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

// ═══ STYLES ═══
const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 20, paddingBottom: 50 },

  // Progress
  progressContainer: { marginBottom: 24 },
  progressBarBg: { height: 4, backgroundColor: Colors.border, borderRadius: 2, marginBottom: 14, overflow: 'hidden' as const },
  progressBarFill: { height: '100%' as any, backgroundColor: Colors.primaryLight, borderRadius: 2 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressStep: { alignItems: 'center', flex: 1 },
  progressDot: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.card, justifyContent: 'center', alignItems: 'center', marginBottom: 4, borderWidth: 1.5, borderColor: Colors.border },
  progressDotActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  progressDotCurrent: { borderColor: Colors.primaryLight, borderWidth: 2.5 },
  progressLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '600' },

  // Hero Amount Card
  // Slider card
  sliderCard: {
    backgroundColor: Colors.card, borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 16,
  },
  sliderTitle: {
    fontSize: 16, fontWeight: '700', color: Colors.text,
    textAlign: 'center', marginBottom: 4,
  },
  // Hero (legacy)
  heroCard: {
    alignItems: 'center', paddingVertical: 28, paddingHorizontal: 24,
    backgroundColor: Colors.card, borderRadius: 24,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 14,
  },
  heroLabel: { fontSize: 14, color: Colors.textMuted, fontWeight: '600', marginBottom: 8 },
  heroInputWrap: { flexDirection: 'row', alignItems: 'center' },
  heroDollar: { fontSize: 36, fontWeight: '300', color: Colors.primaryLight, marginRight: 4 },
  heroInput: { fontSize: 48, fontWeight: '800', color: Colors.text, minWidth: 100, textAlign: 'center' },

  // Presets
  presetsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 2 },
  presetChip: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
  },
  presetChipActive: { borderColor: Colors.primaryLight, backgroundColor: 'rgba(5,150,105,0.1)' },
  presetText: { fontSize: 14, fontWeight: '700', color: Colors.textMuted },
  presetTextActive: { color: Colors.primaryLight },

  // Field sections
  fieldSection: { marginBottom: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, marginBottom: 10, marginLeft: 2 },

  // Terms
  termRow: { flexDirection: 'row', gap: 8 },
  termBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14,
    backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border,
  },
  termBtnActive: { borderColor: Colors.primaryLight, backgroundColor: 'rgba(5,150,105,0.1)' },
  termNum: { fontSize: 22, fontWeight: '800', color: Colors.textMuted },
  termNumActive: { color: Colors.primaryLight },
  termSub: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  termSubActive: { color: Colors.primaryLight },

  // Purpose Selector
  purposeSelector: {
    backgroundColor: Colors.card, borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    padding: 16,
  },
  purposeSelected: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  purposeIconWrap: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(5,150,105,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  purposeSelectedText: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },
  purposePlaceholder: { flex: 1, fontSize: 14, color: Colors.textMuted },

  // CTA
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 16, height: 54,
  },
  ctaBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // Step Cards
  stepCard: {
    backgroundColor: Colors.card, borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: Colors.border,
  },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  stepIconWrap: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(5,150,105,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  stepTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  stepSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  // Inputs
  inputLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, borderWidth: 1, borderColor: Colors.border, color: Colors.text,
  },
  lockedField: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(30,42,60,0.6)', borderColor: '#2a3550',
  },
  lockedText: {
    fontSize: 15, color: '#8892a8', flex: 1,
  },
  twoCol: { flexDirection: 'row', alignItems: 'flex-start' },
  threeCol: { flexDirection: 'row', alignItems: 'flex-start' },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 16 },

  // Amount
  amountRow: { position: 'relative', flexDirection: 'row', alignItems: 'center' },
  dollarSign: { position: 'absolute', left: 14, zIndex: 1, fontSize: 16, color: Colors.primaryLight, fontWeight: '700' },
  perMonth: { marginLeft: 8, fontSize: 13, color: Colors.textMuted, fontWeight: '600' },

  // Employment
  empGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  empCard: {
    width: '48%', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14,
    backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border, gap: 6,
  },
  empCardActive: { borderColor: Colors.primaryLight, backgroundColor: 'rgba(5,150,105,0.08)' },
  empCardLabel: { fontSize: 13, fontWeight: '600', color: Colors.textMuted, textAlign: 'center' },

  // Account type
  acctBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, marginHorizontal: 4,
  },
  acctBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  acctBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },

  // Security / Disclaimer
  securityNote: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(5,150,105,0.06)', borderRadius: 12, padding: 14, marginTop: 16, borderWidth: 1, borderColor: 'rgba(5,150,105,0.15)' },
  securityText: { flex: 1, fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
  disclaimer: { backgroundColor: 'rgba(245,158,11,0.05)', borderRadius: 10, padding: 12, marginTop: 12, borderWidth: 1, borderColor: 'rgba(245,158,11,0.15)' },
  disclaimerText: { fontSize: 11, color: Colors.textSecondary, lineHeight: 16 },

  // Navigation
  navRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 14, paddingHorizontal: 8 },
  backBtnText: { color: Colors.primaryLight, fontWeight: '600', fontSize: 14 },
  submitBtn: {
    flexDirection: 'row', borderRadius: 16, height: 54,
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  submitBtnText: { color: Colors.bg, fontWeight: '700', fontSize: 16 },

  // Success
  successScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  successIcon: { marginBottom: 20 },
  successTitle: { fontSize: 24, fontWeight: '800', color: Colors.text, marginBottom: 12 },
  successSub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  successInfo: { backgroundColor: 'rgba(5,150,105,0.08)', borderRadius: 12, padding: 16, marginTop: 24, width: '100%', borderWidth: 1, borderColor: 'rgba(5,150,105,0.2)' },
  newBtn: { marginTop: 24, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32 },
  newBtnText: { color: '#fff', fontWeight: '700' },

  // Purpose Picker Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  pickerSheet: {
    backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 40 : 24, paddingHorizontal: 20,
  },
  pickerHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border,
    alignSelf: 'center', marginBottom: 16,
  },
  pickerTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 16, textAlign: 'center' },
  pickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pickerItem: {
    width: (SW - 70) / 2, alignItems: 'center', paddingVertical: 16, borderRadius: 16,
    backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border, gap: 8,
  },
  pickerItemActive: { borderColor: Colors.primaryLight, backgroundColor: 'rgba(5,150,105,0.08)' },
  pickerIconWrap: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center', alignItems: 'center',
  },
  pickerItemText: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary, textAlign: 'center' },

  // Employer autocomplete
  autocompleteDropdown: {
    position: 'absolute', top: 52, left: 0, right: 0, zIndex: 100,
    backgroundColor: Colors.card, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    maxHeight: 220, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  autocompleteItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  autocompleteText: { fontSize: 14, fontWeight: '600', color: Colors.text },
  autocompleteSub: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },

  // Prefill modal
  prefillCard: {
    backgroundColor: Colors.card, borderRadius: 24, padding: 28, width: '88%', maxWidth: 380,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 24, elevation: 12,
  },
});
