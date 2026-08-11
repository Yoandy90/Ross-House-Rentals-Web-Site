import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
  TextInput, Modal, KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, API_URL } from '../../src/constants/theme';

type FormMode = null | 'bank' | 'card';

export default function PaymentMethodsScreen() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [methods, setMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editingMethod, setEditingMethod] = useState<any>(null);
  const [editBankName, setEditBankName] = useState('');
  const [editAccountType, setEditAccountType] = useState<'checking' | 'savings'>('checking');

  // Bank form fields
  const [bankName, setBankName] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountType, setAccountType] = useState<'checking' | 'savings'>('checking');

  // Card form fields
  const [cardNumber, setCardNumber] = useState('');
  const [cardExp, setCardExp] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');

  // Action sheet state
  const [selectedMethod, setSelectedMethod] = useState<any>(null);
  const [showActions, setShowActions] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchMethods(); }, []);

  const fetchMethods = async () => {
    try {
      const res = await fetch(`${API_URL}/api/loans/payment-methods`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMethods(data.methods || []);
      }
    } catch {}
    setLoading(false);
  };

  const resetForms = () => {
    setBankName('');
    setRoutingNumber('');
    setAccountNumber('');
    setAccountType('checking');
    setCardNumber('');
    setCardExp('');
    setCardCvv('');
    setCardName('');
    setFormMode(null);
  };

  const handleSaveBank = async () => {
    if (!bankName.trim()) {
      Alert.alert(t('common.error', 'Error'), t('paymentMethods.enterBankName', 'Enter bank name'));
      return;
    }
    if (routingNumber.length !== 9) {
      Alert.alert('Error', t('paymentMethods.routing9digits', 'Routing number must be 9 digits'));
      return;
    }
    if (accountNumber.length < 4) {
      Alert.alert(t('common.error', 'Error'), t('paymentMethods.enterValidAccount', 'Enter a valid account number'));
      return;
    }

    setSaving(true);
    try {
      const last4 = accountNumber.slice(-4);
      const res = await fetch(`${API_URL}/api/loans/payment-methods`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: 'bank',
          bank_name: bankName.trim(),
          account_last4: last4,
          routing_number: routingNumber,
          account_number_encrypted: accountNumber,
          account_type: accountType,
          is_default: methods.length === 0,
        }),
      });

      if (res.ok) {
        Alert.alert(`✅ ${t('paymentMethods.accountAdded')}`, `${bankName} ····${last4} ${t('paymentMethods.accountAddedMsg')}`);
        resetForms();
        fetchMethods();
      } else {
        const err = await res.json();
        Alert.alert(t('common.error', 'Error'), err.detail || t('paymentMethods.couldNotSaveAccount', 'Could not save account'));
      }
    } catch {
      Alert.alert('Error', t('common.connectionError', 'Connection error'));
    }
    setSaving(false);
  };

  const handleSaveCard = async () => {
    const cleanCard = cardNumber.replace(/\s/g, '');
    if (cleanCard.length < 15) {
      Alert.alert('Error', t('paymentMethods.invalidCard', 'Invalid card number'));
      return;
    }
    if (!cardExp || cardExp.length < 5) {
      Alert.alert(t('common.error', 'Error'), t('paymentMethods.invalidExpiry', 'Invalid expiry date (MM/YY)'));
      return;
    }

    setSaving(true);
    try {
      const last4 = cleanCard.slice(-4);
      let brand = 'Visa';
      if (cleanCard.startsWith('5') || cleanCard.startsWith('2')) brand = 'Mastercard';
      else if (cleanCard.startsWith('3')) brand = 'Amex';
      else if (cleanCard.startsWith('6')) brand = 'Discover';

      const res = await fetch(`${API_URL}/api/loans/payment-methods`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: 'card',
          card_last4: last4,
          card_brand: brand,
          card_exp: cardExp,
          is_default: methods.length === 0,
        }),
      });

      if (res.ok) {
        Alert.alert(`✅ ${t('paymentMethods.cardAdded')}`, `${brand} ····${last4} ${t('paymentMethods.cardAddedMsg')}`);
        resetForms();
        fetchMethods();
      } else {
        const err = await res.json();
        Alert.alert(t('common.error', 'Error'), err.detail || t('paymentMethods.couldNotSaveCard', 'Could not save card'));
      }
    } catch {
      Alert.alert('Error', t('common.connectionError', 'Connection error'));
    }
    setSaving(false);
  };

  // ═══ EDIT METHOD ═══
  const openEditModal = (method: any) => {
    setEditingMethod(method);
    setEditBankName(method.bank_name || method.name || '');
    setEditAccountType(method.account_type || 'checking');
    setShowActions(false);
  };

  const handleSaveEdit = async () => {
    if (!editingMethod) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/loans/payment-methods/${editingMethod._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          bank_name: editBankName.trim(),
          account_type: editAccountType,
        }),
      });
      if (res.ok) {
        Alert.alert('✅', t('paymentMethods.updated', 'Payment method updated successfully'));
        setEditingMethod(null);
        fetchMethods();
      } else {
        const err = await res.json();
        Alert.alert('Error', err.detail || t('pm.couldNotUpdate'));
      }
    } catch {
      Alert.alert('Error', t('common.connectionError', 'Connection error'));
    }
    setSaving(false);
  };

  // ═══ DELETE WITH PROTECTION ═══
  const handleDeleteMethod = async (method: any) => {
    setShowActions(false);
    const name = method.bank_name || method.name || t('paymentMethods.method');

    Alert.alert(
      t('paymentMethods.deleteMethod', 'Delete Payment Method'),
      t('pm.deleteConfirmMsgFull', { name }),
      [
        { text: t('paymentMethods.cancel'), style: 'cancel' },
        {
          text: t('pm.delete'), style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const res = await fetch(`${API_URL}/api/loans/payment-methods/${method._id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
              });

              if (res.ok) {
                Alert.alert(`✅ ${t('paymentMethods.deleted')}`, `${name} ${t('paymentMethods.deletedMsg')}`);
                fetchMethods();
              } else if (res.status === 409) {
                // Linked to active loan — show protection message
                const err = await res.json();
                Alert.alert(
                  `⚠️ ${t('pm.cannotDelete')}`,
                  err.detail || t('pm.linkedToLoan'),
                  [
                    { text: t('pm.understood'), style: 'default' },
                    {
                      text: t('paymentMethods.addMethod', 'Add Method'),
                      onPress: () => setFormMode('bank'),
                    },
                  ]
                );
              } else {
                const err = await res.json();
                Alert.alert('Error', err.detail || t('pm.couldNotDelete'));
              }
            } catch {
              Alert.alert('Error', t('common.connectionError', 'Connection error'));
            }
            setDeleting(false);
          }
        },
      ]
    );
  };

  const handleSetDefault = async (methodId: string) => {
    try {
      await fetch(`${API_URL}/api/loans/payment-methods/${methodId}/default`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      fetchMethods();
    } catch {}
  };

  // ═══ ACTION SHEET ═══
  const openActionSheet = (method: any) => {
    setSelectedMethod(method);
    setShowActions(true);
  };

  const formatCardInput = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 16);
    const groups = cleaned.match(/.{1,4}/g);
    return groups ? groups.join(' ') : cleaned;
  };

  const formatExpInput = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 4);
    if (cleaned.length > 2) return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    return cleaned;
  };

  return (
    <>
      <Stack.Screen options={{ title: t('paymentMethods.title', 'Payment Methods') }} />
      <SafeAreaView style={S.container} edges={['bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={S.scroll} keyboardShouldPersistTaps="handled">
            {loading ? (
              <ActivityIndicator color={Colors.primaryLight} size="large" style={{ marginTop: 40 }} />
            ) : (
              <>
                {/* ═══ SAVED METHODS ═══ */}
                {methods.length > 0 && (
                  <View style={S.section}>
                    <Text style={S.sectionTitle}>{t('pm.savedMethods')}</Text>
                    {methods.map((m, idx) => (
                      <TouchableOpacity
                        key={m._id || idx}
                        style={[S.methodCard, m.is_default && S.methodCardDefault]}
                        onPress={() => handleSetDefault(m._id)}
                        onLongPress={() => openActionSheet(m)}
                        activeOpacity={0.7}
                      >
                        <View style={[S.methodIcon, m.type === 'card' && { backgroundColor: 'rgba(99,102,241,0.1)' }]}>
                          <Ionicons
                            name={m.type === 'bank' ? 'business-outline' : 'card-outline'}
                            size={24}
                            color={m.type === 'card' ? '#6366F1' : Colors.primaryLight}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={S.methodName}>{m.bank_name || m.name || t('paymentMethods.account')}</Text>
                          <Text style={S.methodDetail}>
                            ····{m.account_last4 || m.card_last4 || m.last4 || '0000'}
                            {m.account_type ? ` · ${m.account_type === 'checking' ? t('paymentMethods.checking') : t('paymentMethods.savings')}` : ''}
                            {m.card_exp ? ` · Exp: ${m.card_exp}` : ''}
                          </Text>
                        </View>
                        <View style={S.methodActions}>
                          {m.is_default && (
                            <View style={S.defaultBadge}>
                              <Text style={S.defaultText}>{t('pm.primary')}</Text>
                            </View>
                          )}
                          <TouchableOpacity
                            onPress={() => openActionSheet(m)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            style={S.moreBtn}
                          >
                            <Ionicons name="ellipsis-vertical" size={18} color={Colors.textMuted} />
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    ))}
                    <Text style={S.hintText}>{t('paymentMethods.hintText')}</Text>
                  </View>
                )}

                {methods.length === 0 && !formMode && (
                  <View style={S.emptyState}>
                    <View style={S.emptyIconWrap}>
                      <Ionicons name="wallet-outline" size={48} color={Colors.textMuted} />
                    </View>
                    <Text style={S.emptyTitle}>{t('paymentMethods.empty')}</Text>
                    <Text style={S.emptyText}>{t('paymentMethods.emptyDesc')}</Text>
                  </View>
                )}

                {/* ═══ ADD METHODS BUTTONS ═══ */}
                {!formMode && !editingMethod && (
                  <View style={S.section}>
                    <Text style={S.sectionTitle}>{t('pm.addMethod')}</Text>

                    <TouchableOpacity onPress={() => setFormMode('bank')} style={S.addOption} activeOpacity={0.7}>
                      <View style={S.addOptionIcon}>
                        <Ionicons name="business" size={24} color={Colors.primaryLight} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={S.addOptionTitle}>{t('pm.bankAccount')}</Text>
                        <Text style={S.addOptionDesc}>{t('pm.bankAccountDesc')}</Text>
                      </View>
                      <Ionicons name="add-circle" size={26} color={Colors.primaryLight} />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setFormMode('card')} style={S.addOption} activeOpacity={0.7}>
                      <View style={[S.addOptionIcon, { backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}>
                        <Ionicons name="card" size={24} color="#6366F1" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={S.addOptionTitle}>{t('pm.debitCredit')}</Text>
                        <Text style={S.addOptionDesc}>{t('pm.debitCardDesc')}</Text>
                      </View>
                      <Ionicons name="add-circle" size={26} color="#6366F1" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* ═══ BANK FORM ═══ */}
                {formMode === 'bank' && (
                  <View style={S.formSection}>
                    <View style={S.formHeader}>
                      <Ionicons name="business" size={22} color={Colors.primaryLight} />
                      <Text style={S.formTitle}>{t('pm.addBankTitle')}</Text>
                      <TouchableOpacity onPress={resetForms} style={S.formClose}>
                        <Ionicons name="close" size={22} color={Colors.textMuted} />
                      </TouchableOpacity>
                    </View>

                    <Text style={S.inputLabel}>{t('paymentMethods.bankName')}</Text>
                    <TextInput
                      style={S.input}
                      placeholder={t("paymentMethods.bankNamePlaceholder")}
                      placeholderTextColor={Colors.textMuted}
                      value={bankName}
                      onChangeText={setBankName}
                      autoCapitalize="words"
                    />

                    <Text style={S.inputLabel}>{t('paymentMethods.routingNumber')}</Text>
                    <TextInput
                      style={S.input}
                      placeholder={t("paymentMethods.routingPlaceholder")}
                      placeholderTextColor={Colors.textMuted}
                      value={routingNumber}
                      onChangeText={(t) => setRoutingNumber(t.replace(/\D/g, '').slice(0, 9))}
                      keyboardType="number-pad"
                      maxLength={9}
                    />

                    <Text style={S.inputLabel}>{t('paymentMethods.accountNumber')}</Text>
                    <TextInput
                      style={S.input}
                      placeholder={t("paymentMethods.accountPlaceholder")}
                      placeholderTextColor={Colors.textMuted}
                      value={accountNumber}
                      onChangeText={(t) => setAccountNumber(t.replace(/\D/g, ''))}
                      keyboardType="number-pad"
                      secureTextEntry
                    />

                    <Text style={S.inputLabel}>{t('paymentMethods.accountType')}</Text>
                    <View style={S.typeToggle}>
                      <TouchableOpacity
                        style={[S.typeBtn, accountType === 'checking' && S.typeBtnActive]}
                        onPress={() => setAccountType('checking')}
                      >
                        <Text style={[S.typeBtnText, accountType === 'checking' && S.typeBtnTextActive]}>{t('paymentMethods.checking')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[S.typeBtn, accountType === 'savings' && S.typeBtnActive]}
                        onPress={() => setAccountType('savings')}
                      >
                        <Text style={[S.typeBtnText, accountType === 'savings' && S.typeBtnTextActive]}>{t('paymentMethods.savings')}</Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={[S.saveBtn, saving && { opacity: 0.6 }]}
                      onPress={handleSaveBank}
                      disabled={saving}
                    >
                      {saving ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={S.saveBtnText}>{t('paymentMethods.saveToVault')}</Text>
                      )}
                    </TouchableOpacity>

                    <View style={S.securityNote}>
                      <Ionicons name="shield-checkmark" size={16} color={Colors.primaryLight} />
                      <Text style={S.securityNoteText}>{t('paymentMethods.bankSecurity')}</Text>
                    </View>
                  </View>
                )}

                {/* ═══ CARD FORM ═══ */}
                {formMode === 'card' && (
                  <View style={S.formSection}>
                    <View style={S.formHeader}>
                      <Ionicons name="card" size={22} color="#6366F1" />
                      <Text style={S.formTitle}>{t('paymentMethods.addCard')}</Text>
                      <TouchableOpacity onPress={resetForms} style={S.formClose}>
                        <Ionicons name="close" size={22} color={Colors.textMuted} />
                      </TouchableOpacity>
                    </View>

                    <Text style={S.inputLabel}>{t('paymentMethods.cardName')}</Text>
                    <TextInput
                      style={S.input}
                      placeholder={t("paymentMethods.cardNamePlaceholder")}
                      placeholderTextColor={Colors.textMuted}
                      value={cardName}
                      onChangeText={setCardName}
                      autoCapitalize="words"
                    />

                    <Text style={S.inputLabel}>{t('paymentMethods.cardNumberLabel')}</Text>
                    <TextInput
                      style={S.input}
                      placeholder="1234 5678 9012 3456"
                      placeholderTextColor={Colors.textMuted}
                      value={cardNumber}
                      onChangeText={(t) => setCardNumber(formatCardInput(t))}
                      keyboardType="number-pad"
                      maxLength={19}
                    />

                    <View style={S.cardRow}>
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={S.inputLabel}>{t('paymentMethods.expiration')}</Text>
                        <TextInput
                          style={S.input}
                          placeholder="MM/YY"
                          placeholderTextColor={Colors.textMuted}
                          value={cardExp}
                          onChangeText={(t) => setCardExp(formatExpInput(t))}
                          keyboardType="number-pad"
                          maxLength={5}
                        />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={S.inputLabel}>CVV</Text>
                        <TextInput
                          style={S.input}
                          placeholder="123"
                          placeholderTextColor={Colors.textMuted}
                          value={cardCvv}
                          onChangeText={(t) => setCardCvv(t.replace(/\D/g, '').slice(0, 4))}
                          keyboardType="number-pad"
                          maxLength={4}
                          secureTextEntry
                        />
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[S.saveBtn, { backgroundColor: '#6366F1' }, saving && { opacity: 0.6 }]}
                      onPress={handleSaveCard}
                      disabled={saving}
                    >
                      {saving ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={S.saveBtnText}>{t('paymentMethods.saveToVault')}</Text>
                      )}
                    </TouchableOpacity>

                    <View style={S.securityNote}>
                      <Ionicons name="lock-closed" size={16} color="#6366F1" />
                      <Text style={S.securityNoteText}>{t('paymentMethods.cardSecurity')}</Text>
                    </View>
                  </View>
                )}

                {/* ═══ EDIT FORM MODAL (inline) ═══ */}
                {editingMethod && (
                  <View style={S.formSection}>
                    <View style={S.formHeader}>
                      <Ionicons name="create-outline" size={22} color={Colors.primaryLight} />
                      <Text style={S.formTitle}>{t('paymentMethods.editMethod')}</Text>
                      <TouchableOpacity onPress={() => setEditingMethod(null)} style={S.formClose}>
                        <Ionicons name="close" size={22} color={Colors.textMuted} />
                      </TouchableOpacity>
                    </View>

                    <View style={S.editPreview}>
                      <View style={[S.methodIcon, editingMethod.type === 'card' && { backgroundColor: 'rgba(99,102,241,0.1)' }]}>
                        <Ionicons
                          name={editingMethod.type === 'bank' ? 'business-outline' : 'card-outline'}
                          size={22}
                          color={editingMethod.type === 'card' ? '#6366F1' : Colors.primaryLight}
                        />
                      </View>
                      <Text style={S.editPreviewText}>
                        ····{editingMethod.account_last4 || editingMethod.card_last4 || '0000'}
                      </Text>
                    </View>

                    <Text style={S.inputLabel}>{t('paymentMethods.name')}</Text>
                    <TextInput
                      style={S.input}
                      value={editBankName}
                      onChangeText={setEditBankName}
                      autoCapitalize="words"
                      placeholder={t("paymentMethods.namePlaceholder")}
                      placeholderTextColor={Colors.textMuted}
                    />

                    {editingMethod.type === 'bank' && (
                      <>
                        <Text style={S.inputLabel}>{t('paymentMethods.accountType')}</Text>
                        <View style={S.typeToggle}>
                          <TouchableOpacity
                            style={[S.typeBtn, editAccountType === 'checking' && S.typeBtnActive]}
                            onPress={() => setEditAccountType('checking')}
                          >
                            <Text style={[S.typeBtnText, editAccountType === 'checking' && S.typeBtnTextActive]}>{t('paymentMethods.checking')}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[S.typeBtn, editAccountType === 'savings' && S.typeBtnActive]}
                            onPress={() => setEditAccountType('savings')}
                          >
                            <Text style={[S.typeBtnText, editAccountType === 'savings' && S.typeBtnTextActive]}>{t('paymentMethods.savings')}</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    )}

                    <TouchableOpacity
                      style={[S.saveBtn, saving && { opacity: 0.6 }]}
                      onPress={handleSaveEdit}
                      disabled={saving}
                    >
                      {saving ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={S.saveBtnText}>{t('paymentMethods.saveChanges')}</Text>
                      )}
                    </TouchableOpacity>

                    <View style={S.securityNote}>
                      <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
                      <Text style={S.securityNoteText}>
                        {t('pm.editSecurityNote')}
                      </Text>
                    </View>
                  </View>
                )}

                {/* ═══ INFO BOXES ═══ */}
                {!formMode && !editingMethod && (
                  <>
                    <View style={S.infoBox}>
                      <Ionicons name="shield-checkmark-outline" size={18} color={Colors.primaryLight} />
                      <Text style={S.infoText}>{t('paymentMethods.infoSecurity')}</Text>
                    </View>
                    <View style={[S.infoBox, { marginTop: 10 }]}>
                      <Ionicons name="cash-outline" size={18} color={Colors.gold} />
                      <Text style={S.infoText}>{t('paymentMethods.infoACH')}</Text>
                    </View>
                    <View style={[S.infoBox, { marginTop: 10, borderColor: 'rgba(239,68,68,0.15)', backgroundColor: 'rgba(239,68,68,0.04)' }]}>
                      <Ionicons name="alert-circle-outline" size={18} color="#EF4444" />
                      <Text style={S.infoText}>{t('pm.linkedWarning')}</Text>
                    </View>
                  </>
                )}
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* ═══ ACTION SHEET MODAL ═══ */}
        <Modal
          visible={showActions}
          transparent
          animationType="slide"
          onRequestClose={() => setShowActions(false)}
        >
          <TouchableOpacity
            style={S.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowActions(false)}
          >
            <View style={S.actionSheet}>
              {selectedMethod && (
                <>
                  <View style={S.actionSheetHeader}>
                    <View style={[S.methodIcon, selectedMethod.type === 'card' && { backgroundColor: 'rgba(99,102,241,0.1)' }]}>
                      <Ionicons
                        name={selectedMethod.type === 'bank' ? 'business-outline' : 'card-outline'}
                        size={22}
                        color={selectedMethod.type === 'card' ? '#6366F1' : Colors.primaryLight}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={S.actionSheetTitle}>{selectedMethod.bank_name || selectedMethod.name || t('paymentMethods.method', 'Method')}</Text>
                      <Text style={S.actionSheetSub}>····{selectedMethod.account_last4 || selectedMethod.card_last4 || '0000'}</Text>
                    </View>
                  </View>

                  <View style={S.actionSheetDivider} />

                  {/* Set as Default */}
                  {!selectedMethod.is_default && (
                    <TouchableOpacity
                      style={S.actionItem}
                      onPress={() => {
                        handleSetDefault(selectedMethod._id);
                        setShowActions(false);
                      }}
                    >
                      <Ionicons name="star-outline" size={22} color={Colors.primaryLight} />
                      <Text style={S.actionItemText}>{t('paymentMethods.setPrimary')}</Text>
                    </TouchableOpacity>
                  )}

                  {/* Edit */}
                  <TouchableOpacity
                    style={S.actionItem}
                    onPress={() => openEditModal(selectedMethod)}
                  >
                    <Ionicons name="create-outline" size={22} color="#3B82F6" />
                    <Text style={[S.actionItemText, { color: '#3B82F6' }]}>{t('paymentMethods.edit')}</Text>
                  </TouchableOpacity>

                  {/* Delete */}
                  <TouchableOpacity
                    style={S.actionItem}
                    onPress={() => handleDeleteMethod(selectedMethod)}
                    disabled={deleting}
                  >
                    <Ionicons name="trash-outline" size={22} color="#EF4444" />
                    <Text style={[S.actionItemText, { color: '#EF4444' }]}>
                      {deleting ? t('paymentMethods.deleting') : t('paymentMethods.delete')}
                    </Text>
                  </TouchableOpacity>

                  <View style={S.actionSheetDivider} />

                  {/* Cancel */}
                  <TouchableOpacity
                    style={[S.actionItem, { justifyContent: 'center' }]}
                    onPress={() => setShowActions(false)}
                  >
                    <Text style={[S.actionItemText, { color: Colors.textMuted, textAlign: 'center' }]}>{t('pm.cancel')}</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 20, paddingBottom: 60 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.5, marginBottom: 10, marginLeft: 4 },
  hintText: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', marginTop: 4 },

  // Vault Header
  vaultHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(5,150,105,0.08)', borderRadius: 14,
    padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(5,150,105,0.2)',
  },
  vaultIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(5,150,105,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  vaultTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  vaultDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  // Empty state
  emptyState: { alignItems: 'center', marginTop: 20, marginBottom: 32 },
  emptyIconWrap: { width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },

  // Method cards
  methodCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card,
    borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: Colors.border,
  },
  methodCardDefault: {
    borderColor: Colors.primaryLight, borderWidth: 1.5,
  },
  methodIcon: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(5, 150, 105, 0.1)',
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  methodName: { fontSize: 15, fontWeight: '600', color: Colors.text },
  methodDetail: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  methodActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  defaultBadge: { backgroundColor: 'rgba(5, 150, 105, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  defaultText: { fontSize: 11, fontWeight: '700', color: Colors.primaryLight },
  moreBtn: { padding: 4 },

  // Add option buttons
  addOption: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card,
    borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: Colors.border,
  },
  addOptionIcon: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(5, 150, 105, 0.1)',
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  addOptionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  addOptionDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 3 },

  // Form section
  formSection: {
    backgroundColor: Colors.card, borderRadius: 16, padding: 20, marginBottom: 20,
    borderWidth: 1, borderColor: Colors.border,
  },
  formHeader: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 20,
  },
  formTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: Colors.text, marginLeft: 10 },
  formClose: { padding: 4 },

  inputLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6, marginLeft: 2 },
  input: {
    backgroundColor: Colors.bg, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: Colors.text,
    marginBottom: 16,
  },

  typeToggle: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  typeBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5,
    borderColor: Colors.border, alignItems: 'center',
  },
  typeBtnActive: {
    borderColor: Colors.primaryLight, backgroundColor: 'rgba(5,150,105,0.08)',
  },
  typeBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  typeBtnTextActive: { color: Colors.primaryLight },

  cardRow: { flexDirection: 'row' },

  saveBtn: {
    backgroundColor: Colors.primaryLight, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 4,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  securityNote: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16,
    paddingHorizontal: 4,
  },
  securityNoteText: { flex: 1, fontSize: 12, color: Colors.textMuted, lineHeight: 17 },

  // Edit preview
  editPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.bg, borderRadius: 12, padding: 12, marginBottom: 16,
  },
  editPreviewText: { fontSize: 16, fontWeight: '600', color: Colors.textMuted, letterSpacing: 2 },

  // Info boxes
  infoBox: {
    flexDirection: 'row', gap: 10, backgroundColor: 'rgba(5, 150, 105, 0.06)',
    borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(5, 150, 105, 0.15)',
  },
  infoText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },

  // Action Sheet Modal
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  actionSheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    paddingHorizontal: 20,
  },
  actionSheetHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14,
  },
  actionSheetTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  actionSheetSub: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  actionSheetDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 6 },
  actionItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 16,
  },
  actionItemText: { fontSize: 16, fontWeight: '600', color: Colors.text },
});
