/**
 * ProcessingScreen - Simple processing overlay (crash-safe)
 * No complex native animations - uses simple React state
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors } from '../constants/theme';

interface ProcessingScreenProps {
  visible: boolean;
}

export default function ProcessingScreen({ visible }: ProcessingScreenProps) {
  const { t } = useTranslation();
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setDotCount(prev => (prev % 3) + 1);
    }, 500);
    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) return null;

  const dots = '.'.repeat(dotCount);

  return (
    <View style={styles.container}>
      {/* Spinner */}
      <View style={styles.spinnerCard}>
        <ActivityIndicator size="large" color={Colors.primaryLight} style={{ marginBottom: 16 }} />
        <Text style={styles.mainText}>
          {t('processing.gettingOffers', 'Processing your application')}{dots}
        </Text>
        <Text style={styles.subText}>
          {t('processing.mayTake', 'This may take a few moments')}
        </Text>
      </View>

      {/* Trust Signals */}
      <View style={styles.trustCard}>
        <View style={styles.trustItem}>
          <View style={[styles.trustIcon, { backgroundColor: 'rgba(5,150,105,0.15)' }]}>
            <Ionicons name="shield-checkmark" size={20} color={Colors.primaryLight} />
          </View>
          <View style={styles.trustContent}>
            <Text style={styles.trustTitle}>
              {t('processing.noCredit', 'No impact to your credit')}
            </Text>
            <Text style={styles.trustSub}>
              {t('processing.noCreditSub', 'Soft inquiry only — your score stays the same')}
            </Text>
          </View>
        </View>

        <View style={styles.trustItem}>
          <View style={[styles.trustIcon, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
            <Ionicons name="lock-closed" size={20} color="#3B82F6" />
          </View>
          <View style={styles.trustContent}>
            <Text style={styles.trustTitle}>
              {t('processing.encrypted', 'Your data is encrypted')}
            </Text>
            <Text style={styles.trustSub}>
              {t('processing.encryptedSub', 'Bank-grade 256-bit SSL protection')}
            </Text>
          </View>
        </View>

        <View style={styles.trustItem}>
          <View style={[styles.trustIcon, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
            <Ionicons name="ribbon" size={20} color="#F59E0B" />
          </View>
          <View style={styles.trustContent}>
            <Text style={styles.trustTitle}>
              {t('processing.licensed', 'Texas Licensed & Regulated')}
            </Text>
            <Text style={styles.trustSub}>
              {t('processing.licensedSub', 'OCCC regulated under Chapter 342, TX Finance Code')}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: Colors.bg,
  },
  spinnerCard: {
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 32,
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  mainText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  subText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  trustCard: {
    backgroundColor: 'rgba(5,150,105,0.04)',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(5,150,105,0.1)',
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  trustIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trustContent: {
    flex: 1,
  },
  trustTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  trustSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
    lineHeight: 17,
  },
});
