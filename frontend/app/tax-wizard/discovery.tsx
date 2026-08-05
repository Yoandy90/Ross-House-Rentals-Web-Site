import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 60) / 2;

interface SituationOption {
  id: string;
  icon: string;
  label: string;
  category: 'income' | 'deductions' | 'life';
  helpText?: string;
}

const SITUATION_OPTIONS: SituationOption[] = [
  // Income
  {
    id: 'has_w2',
    icon: 'briefcase',
    label: 'Tengo empleo (W-2)',
    category: 'income',
  },
  {
    id: 'self_employed',
    icon: 'storefront',
    label: 'Soy trabajador independiente',
    category: 'income',
    helpText: 'Contratista, freelancer, negocio propio',
  },
  {
    id: 'has_1099',
    icon: 'document-text',
    label: 'Recibí formularios 1099',
    category: 'income',
  },
  {
    id: 'rental_income',
    icon: 'home',
    label: 'Tengo ingresos por alquiler',
    category: 'income',
  },
  {
    id: 'investments',
    icon: 'trending-up',
    label: 'Tengo inversiones/acciones',
    category: 'income',
  },
  {
    id: 'unemployment',
    icon: 'cash',
    label: 'Recibí desempleo',
    category: 'income',
  },
  // Life situations
  {
    id: 'has_dependents',
    icon: 'people',
    label: 'Tengo hijos/dependientes',
    category: 'life',
  },
  {
    id: 'married',
    icon: 'heart',
    label: 'Estoy casado/a',
    category: 'life',
  },
  {
    id: 'homeowner',
    icon: 'business',
    label: 'Soy dueño de casa',
    category: 'life',
  },
  {
    id: 'paid_rent',
    icon: 'key',
    label: 'Pagué alquiler',
    category: 'life',
  },
  {
    id: 'student',
    icon: 'school',
    label: 'Soy estudiante',
    category: 'life',
  },
  {
    id: 'first_time',
    icon: 'star',
    label: 'Primera vez declarando',
    category: 'life',
    helpText: 'Te guiaremos paso a paso',
  },
  // Deductions
  {
    id: 'charitable_donations',
    icon: 'gift',
    label: 'Hice donaciones',
    category: 'deductions',
  },
  {
    id: 'medical_expenses',
    icon: 'medical',
    label: 'Gastos médicos altos',
    category: 'deductions',
  },
  {
    id: 'education_expenses',
    icon: 'library',
    label: 'Pagué educación',
    category: 'deductions',
  },
  {
    id: 'childcare',
    icon: 'happy',
    label: 'Pagué guardería/daycare',
    category: 'deductions',
  },
];

const DISCOVERY_KEYS: Record<string, { label: string; helpText?: string }> = {
  has_w2: { label: 'wizard.discovery.hasEmployment' },
  self_employed: { label: 'wizard.discovery.selfEmployed', helpText: 'wizard.discovery.selfEmployedHelp' },
  has_1099: { label: 'wizard.discovery.received1099' },
  rental_income: { label: 'wizard.discovery.rentalIncome' },
  investments: { label: 'wizard.discovery.investments' },
  unemployment: { label: 'wizard.discovery.receivedUnemployment' },
  has_dependents: { label: 'wizard.discovery.hasChildren' },
  married: { label: 'wizard.discovery.isMarried' },
  homeowner: { label: 'wizard.discovery.homeOwner' },
  paid_rent: { label: 'wizard.discovery.paidRent' },
  student: { label: 'wizard.discovery.isStudent' },
  first_time: { label: 'wizard.discovery.firstTime', helpText: 'wizard.discovery.firstTimeHelp' },
  charitable_donations: { label: 'wizard.discovery.madeDonations' },
  medical_expenses: { label: 'wizard.discovery.highMedical' },
  education_expenses: { label: 'wizard.discovery.paidEducation' },
  childcare: { label: 'wizard.discovery.paidDaycare' },
};

export default function DiscoveryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggleOption = (optionId: string) => {
    setSelectedOptions(prev => {
      if (prev.includes(optionId)) {
        return prev.filter(id => id !== optionId);
      }
      return [...prev, optionId];
    });
  };

  const handleContinue = async () => {
    setSaving(true);
    try {
      // Save discovery answers to the session
      await api.post(`/tax-wizard/session/${sessionId}/discovery`, {
        selections: selectedOptions,
      });

      router.push({
        pathname: '/tax-wizard/personal-info',
        params: { sessionId }
      });
    } catch (error) {
      console.error('Error saving discovery:', error);
      // Continue anyway - discovery is optional
      router.push({
        pathname: '/tax-wizard/personal-info',
        params: { sessionId }
      });
    } finally {
      setSaving(false);
    }
  };

  const renderCategory = (category: 'income' | 'deductions' | 'life', title: string) => {
    const options = SITUATION_OPTIONS.filter(opt => opt.category === category);
    
    return (
      <View style={styles.categoryContainer}>
        <Text style={styles.categoryTitle}>{title}</Text>
        <View style={styles.cardsGrid}>
          {options.map(option => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.card,
                selectedOptions.includes(option.id) && styles.cardSelected,
              ]}
              onPress={() => toggleOption(option.id)}
              activeOpacity={0.7}
            >
              {selectedOptions.includes(option.id) && (
                <View style={styles.checkmark}>
                  <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                </View>
              )}
              <View style={[
                styles.iconContainer,
                selectedOptions.includes(option.id) && styles.iconContainerSelected,
              ]}>
                <Ionicons 
                  name={option.icon as any} 
                  size={32} 
                  color={selectedOptions.includes(option.id) ? '#10B981' : '#6B7280'} 
                />
              </View>
              <Text style={[
                styles.cardLabel,
                selectedOptions.includes(option.id) && styles.cardLabelSelected,
              ]}>
                {t(DISCOVERY_KEYS[option.id]?.label || '', option.label)}
              </Text>
              {option.helpText && (
                <Text style={styles.helpText}>{t(DISCOVERY_KEYS[option.id]?.helpText || '', option.helpText)}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#065F46" />
      
      {/* Header */}
      <LinearGradient colors={['#065F46', '#10B981']} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>{t('wizard.discovery.title')}</Text>
            <Text style={styles.headerSubtitle}>{t('wizard.discovery.subtitle')}</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.introText}>
          {t('wizard.discovery.introText', 'Para darte las mejores recomendaciones y maximizar tu reembolso, necesitamos conocer un poco más sobre tu situación.')}
        </Text>

        {renderCategory('income', `💼 ${t('wizard.discovery.yourIncome')}`)}
        {renderCategory('life', `🏠 ${t('wizard.discovery.yourSituation')}`)}
        {renderCategory('deductions', `💰 ${t('wizard.discovery.possibleDeductions')}`)}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomCTA}>
        <View style={styles.selectionCount}>
          <Ionicons name="checkmark-circle" size={20} color="#10B981" />
          <Text style={styles.selectionCountText}>
            {selectedOptions.length} {t('wizard.selected')}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinue}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.continueButtonText}>{t('wizard.continue')}</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#065F46',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  content: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    padding: 20,
  },
  introText: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
    marginBottom: 24,
    textAlign: 'center',
  },
  categoryContainer: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
  },
  cardSelected: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainerSelected: {
    backgroundColor: '#D1FAE5',
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    lineHeight: 18,
  },
  cardLabelSelected: {
    color: '#065F46',
  },
  helpText: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 4,
  },
  bottomCTA: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectionCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectionCountText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 6,
  },
  continueButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
});
