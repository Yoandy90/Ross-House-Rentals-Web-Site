import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors } from '../constants/theme';

interface TrustBannerProps {
  variant?: 'default' | 'inline' | 'card';
}

export default function TrustBanner({ variant = 'default' }: TrustBannerProps) {
  const { t } = useTranslation();

  if (variant === 'inline') {
    return (
      <View style={styles.inlineContainer}>
        <Ionicons name="shield-checkmark" size={14} color={Colors.primaryLight} />
        <Text style={styles.inlineText}>
          {t('trust.noImpactCredit', 'Checking rates won\'t impact your credit score')}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, variant === 'card' && styles.cardContainer]}>
      {/* No Credit Impact */}
      <View style={styles.trustItem}>
        <View style={[styles.iconCircle, { backgroundColor: 'rgba(5,150,105,0.15)' }]}>
          <Ionicons name="shield-checkmark" size={18} color={Colors.primaryLight} />
        </View>
        <View style={styles.trustContent}>
          <Text style={styles.trustTitle}>
            {t('trust.noImpact', 'No impact to your credit')}
          </Text>
          <Text style={styles.trustSub}>
            {t('trust.noImpactSub', 'Check rates without affecting your score')}
          </Text>
        </View>
      </View>

      {/* Secure & Encrypted */}
      <View style={styles.trustItem}>
        <View style={[styles.iconCircle, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
          <Ionicons name="lock-closed" size={18} color="#3B82F6" />
        </View>
        <View style={styles.trustContent}>
          <Text style={styles.trustTitle}>
            {t('trust.encrypted', 'Bank-grade encryption')}
          </Text>
          <Text style={styles.trustSub}>
            {t('trust.encryptedSub', 'Your data is protected with 256-bit SSL')}
          </Text>
        </View>
      </View>

      {/* Texas Licensed */}
      <View style={styles.trustItem}>
        <View style={[styles.iconCircle, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
          <Ionicons name="ribbon" size={18} color="#F59E0B" />
        </View>
        <View style={styles.trustContent}>
          <Text style={styles.trustTitle}>
            {t('trust.licensed', 'Texas Licensed Lender')}
          </Text>
          <Text style={styles.trustSub}>
            {t('trust.licensedSub', 'Regulated by the OCCC under Chapter 342')}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    marginVertical: 8,
  },
  cardContainer: {
    backgroundColor: 'rgba(5,150,105,0.04)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(5,150,105,0.1)',
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trustContent: {
    flex: 1,
  },
  trustTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  trustSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  // Inline variant
  inlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(5,150,105,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(5,150,105,0.12)',
  },
  inlineText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primaryLight,
  },
});
