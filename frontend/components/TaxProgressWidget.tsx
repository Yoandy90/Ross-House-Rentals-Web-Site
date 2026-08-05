import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../services/api';

interface TaxProgressProps {
  colors: any;
}

interface TaxReturn {
  id: string;
  year: number;
  status: string;
  filing_status?: string;
  created_at: string;
  updated_at?: string;
}

const STEPS = [
  { key: 'documents', label: 'Documentos', icon: 'document-text' },
  { key: 'review', label: 'En Revisión', icon: 'search' },
  { key: 'preparation', label: 'Preparación', icon: 'create' },
  { key: 'approval', label: 'Aprobación', icon: 'checkmark-circle' },
  { key: 'filed', label: 'Presentada', icon: 'flag' },
];

const STATUS_TO_STEP: Record<string, number> = {
  'pending': 0,
  'documents_pending': 0,
  'documents_received': 1,
  'in_review': 1,
  'reviewing': 1,
  'in_preparation': 2,
  'preparing': 2,
  'ready_for_review': 3,
  'pending_approval': 3,
  'approved': 3,
  'filed': 4,
  'completed': 4,
  'submitted': 4,
};

export default function TaxProgressWidget({ colors }: TaxProgressProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentReturn, setCurrentReturn] = useState<TaxReturn | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    loadCurrentTaxReturn();
  }, []);

  const loadCurrentTaxReturn = async () => {
    try {
      // Get user's most recent/active tax return
      const response = await api.get('/tax-returns/current');
      if (response.data?.success && response.data?.tax_return) {
        const tr = response.data.tax_return;
        setCurrentReturn(tr);
        setCurrentStep(STATUS_TO_STEP[tr.status] ?? 0);
      }
    } catch (error) {
      // No active tax return or error
      console.log('No active tax return found');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.card }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!currentReturn) {
    return null; // Don't show widget if no active tax return
  }

  const progressPercent = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <TouchableOpacity 
      activeOpacity={0.9}
      onPress={() => router.push('/(tabs)/tax-returns')}
    >
      <View style={[styles.container, { backgroundColor: colors.card }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.iconBg, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="receipt" size={20} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>
                Declaración {currentReturn.year}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {STEPS[currentStep]?.label || 'En proceso'}
              </Text>
            </View>
          </View>
          <View style={[styles.badge, { backgroundColor: getBadgeColor(currentStep) }]}>
            <Text style={styles.badgeText}>{Math.round(progressPercent)}%</Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
            <LinearGradient
              colors={['#6C1110', '#8B1A19']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${progressPercent}%` }]}
            />
          </View>
        </View>

        {/* Steps */}
        <View style={styles.stepsContainer}>
          {STEPS.map((step, index) => {
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;
            const isPending = index > currentStep;
            
            return (
              <View key={step.key} style={styles.stepItem}>
                <View style={[
                  styles.stepDot,
                  isCompleted && { backgroundColor: '#22c55e' },
                  isCurrent && { backgroundColor: colors.primary, transform: [{ scale: 1.2 }] },
                  isPending && { backgroundColor: colors.border },
                ]}>
                  {isCompleted ? (
                    <Ionicons name="checkmark" size={12} color="white" />
                  ) : isCurrent ? (
                    <View style={styles.currentDot} />
                  ) : null}
                </View>
                <Text style={[
                  styles.stepLabel,
                  { color: isCurrent ? colors.primary : isCompleted ? '#22c55e' : colors.textSecondary },
                  isCurrent && { fontWeight: '600' }
                ]} numberOfLines={1}>
                  {step.label}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Action hint */}
        <View style={styles.hintContainer}>
          <Ionicons name="information-circle" size={14} color={colors.textSecondary} />
          <Text style={[styles.hintText, { color: colors.textSecondary }]}>
            {getActionHint(currentStep)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function getBadgeColor(step: number): string {
  if (step >= 4) return '#22c55e'; // Green - completed
  if (step >= 2) return '#f59e0b'; // Amber - in progress
  return '#6C1110'; // Primary - early stage
}

function getActionHint(step: number): string {
  switch (step) {
    case 0: return 'Sube los documentos faltantes para continuar';
    case 1: return 'Estamos revisando tu documentación';
    case 2: return 'Tu declaración está siendo preparada';
    case 3: return 'Revisa y aprueba tu declaración';
    case 4: return '¡Tu declaración ha sido presentada!';
    default: return 'Toca para ver más detalles';
  }
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  currentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'white',
  },
  stepLabel: {
    fontSize: 10,
    textAlign: 'center',
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  hintText: {
    fontSize: 12,
    flex: 1,
  },
});
