import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Colors } from '../constants/theme';

interface NMLSFooterProps {
  showLinks?: boolean;
  compact?: boolean;
}

export default function NMLSFooter({ showLinks = true, compact = false }: NMLSFooterProps) {
  const { t } = useTranslation();

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {/* Divider */}
      <View style={styles.divider} />

      {/* Equal Housing & NMLS */}
      <View style={styles.badgeRow}>
        <View style={styles.equalHousingBadge}>
          <Ionicons name="home-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.equalHousingText}>EQUAL HOUSING{"\n"}OPPORTUNITY</Text>
        </View>
        <View style={styles.nmlsBadge}>
          <Ionicons name="shield-checkmark-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.nmlsText}>OCCC Regulated Lender</Text>
        </View>
      </View>

      {/* Company Info */}
      <Text style={styles.companyName}>Ross Lending Solutions LLC</Text>
      <Text style={styles.companyAddress}>305 Bruce Ave, Dumas, TX 79029</Text>
      <Text style={styles.regulationText}>
        {t('nmlsFooter.regulation', 'Licensed under Chapter 342, Texas Finance Code. Regulated by the Office of Consumer Credit Commissioner (OCCC).')}
      </Text>

      {/* Legal Links — native navigation for Terms, Privacy, Disclosures */}
      {showLinks && (
        <View style={styles.linksRow}>
          <TouchableOpacity onPress={() => router.push('/profile/terms')}>
            <Text style={styles.linkText}>{t('nmlsFooter.terms', 'Terms')}</Text>
          </TouchableOpacity>
          <Text style={styles.linkDot}>·</Text>
          <TouchableOpacity onPress={() => router.push('/profile/privacy')}>
            <Text style={styles.linkText}>{t('nmlsFooter.privacy', 'Privacy')}</Text>
          </TouchableOpacity>
          <Text style={styles.linkDot}>·</Text>
          <TouchableOpacity onPress={() => router.push('/profile/disclosures')}>
            <Text style={styles.linkText}>{t('nmlsFooter.disclosures', 'Disclosures')}</Text>
          </TouchableOpacity>
          <Text style={styles.linkDot}>·</Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://occc.texas.gov')}>
            <Text style={styles.linkText}>OCCC</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Copyright */}
      <Text style={styles.copyright}>
        © {new Date().getFullYear()} Ross Lending Solutions LLC. {t('nmlsFooter.allRights', 'All rights reserved.')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    alignItems: 'center',
  },
  containerCompact: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 12,
  },
  equalHousingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  equalHousingText: {
    fontSize: 8,
    fontWeight: '700',
    color: Colors.textMuted,
    lineHeight: 10,
    letterSpacing: 0.5,
  },
  nmlsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  nmlsText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.3,
  },
  companyName: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  companyAddress: {
    fontSize: 10,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  regulationText: {
    fontSize: 9,
    color: Colors.textDim,
    textAlign: 'center',
    lineHeight: 14,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  linksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 10,
  },
  linkText: {
    fontSize: 11,
    color: Colors.primaryLight,
    fontWeight: '600',
  },
  linkDot: {
    fontSize: 11,
    color: Colors.textDim,
  },
  copyright: {
    fontSize: 9,
    color: Colors.textDim,
    textAlign: 'center',
  },
});
