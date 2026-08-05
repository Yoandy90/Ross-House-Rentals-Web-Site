import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '../../constants/colors';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import CustomHeader from '../../components/CustomHeader';
import { useGamblingEnabled } from '../../hooks/useGamblingEnabled';

export default function GamesScreen() {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { t } = useTranslation();
  const { loading, enabled } = useGamblingEnabled();

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!enabled) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
        <Ionicons name="game-controller-outline" size={64} color={colors.textSecondary} />
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text, marginTop: 16, textAlign: 'center' }}>
          {t('games.unavailable', 'No disponible')}
        </Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 8, textAlign: 'center' }}>
          {t('games.unavailableDesc', 'Esta sección no está habilitada en este momento.')}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginTop: 24, backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>{t('common.goBack', 'Volver')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.compactHeader}>
        <Text style={styles.compactHeaderTitle}>🎁 Sorteos</Text>
        <Text style={styles.compactHeaderSubtitle}>Participa y gana premios increíbles</Text>
      </View>
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        <View style={styles.gamesGrid}>
          {/* Row 1: Two columns */}
          <View style={styles.gameRow}>
            <TouchableOpacity
              style={styles.gameCardSmall}
              onPress={() => router.push('/(tabs)/raffles')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[colors.primary, colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gameCardGradient}
              >
                <View style={styles.gameCardBadge}>
                  <Ionicons name="star" size={12} color="#FCD34D" />
                  <Text style={styles.gameCardBadgeText}>Nuevo</Text>
                </View>
                
                <View style={styles.gameIconContainerSmall}>
                  <Ionicons name="gift" size={32} color="#FFF" />
                </View>
                <Text style={styles.gameCardTitleSmall}>{t('games.raffles.title')}</Text>
                <Text style={styles.gameCardDescriptionSmall}>
                  {t('games.raffles.subtitle')}
                </Text>
                
                <View style={styles.gameCardFooterSmall}>
                  <View style={styles.gameCardPriceSmall}>
                    <Ionicons name="wallet" size={14} color="rgba(255,255,255,0.9)" />
                    <Text style={styles.gameCardPriceTextSmall}>5 créditos</Text>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.gameCardSmall}
              onPress={() => router.push('/(tabs)/lottery')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#8B5CF6', '#EC4899']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gameCardGradient}
              >
                <View style={styles.gameCardBadge}>
                  <Ionicons name="flame" size={12} color="#FF6B6B" />
                  <Text style={styles.gameCardBadgeText}>Popular</Text>
                </View>

                <View style={styles.gameIconContainerSmall}>
                  <Ionicons name="trophy" size={32} color="#FFF" />
                </View>
                <Text style={styles.gameCardTitleSmall}>{t('games.lottery.title')}</Text>
                <Text style={styles.gameCardDescriptionSmall}>
                  {t('games.lottery.subtitle')}
                </Text>

                <View style={styles.gameCardFooterSmall}>
                  <View style={styles.gameCardPriceSmall}>
                  <Ionicons name="wallet" size={14} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.gameCardPriceTextSmall}>3 créditos</Text>
                </View>
              </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Row 2: Full width card for scratch cards */}
          <TouchableOpacity
            style={styles.gameCardFull}
            onPress={() => router.push('/(tabs)/scratch-cards')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#F59E0B', '#FBBF24']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gameCardGradientFull}
            >
              <View style={styles.gameCardBadgeFull}>
                <Ionicons name="flash" size={12} color="#FFF" />
                <Text style={styles.gameCardBadgeText}>Nuevo</Text>
              </View>
              
              <View style={styles.gameContentFull}>
                <View style={styles.gameIconContainerFull}>
                  <Ionicons name="ticket" size={56} color="#FFF" />
                </View>
                <View style={styles.gameTextContainerFull}>
                  <Text style={styles.gameCardTitleFull}>Raspaditos</Text>
                  <Text style={styles.gameCardDescriptionFull}>
                    Raspa y gana premios al instante con nuestros raspaditos virtuales
                  </Text>
                  <View style={styles.gameCardPriceFull}>
                    <Ionicons name="wallet" size={16} color="rgba(255,255,255,0.9)" />
                    <Text style={styles.gameCardPriceTextFull}>Desde 10 créditos</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={28} color="#FFF" style={styles.arrowIcon} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.featuresSection}>
          <Text style={styles.featuresSectionTitle}>{t('games.whyPlay')}</Text>
          
          <View style={styles.featureItem}>
            <View style={styles.featureIconContainer}>
              <Ionicons name="gift-outline" size={24} color={colors.primary} />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>{t('games.realPrizes')}</Text>
              <Text style={styles.featureDescription}>{t('games.realPrizesDesc')}</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIconContainer}>
              <Ionicons name="shield-checkmark-outline" size={24} color={colors.success} />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>{t('games.transparent')}</Text>
              <Text style={styles.featureDescription}>{t('games.transparentDesc')}</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIconContainer}>
              <Ionicons name="trending-up-outline" size={24} color={colors.accent} />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>{t('games.responsible')}</Text>
              <Text style={styles.featureDescription}>{t('games.responsibleDesc')}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  compactHeader: {
    backgroundColor: colors.primary,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  compactHeaderTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
  },
  compactHeaderSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textGray,
    marginTop: 4,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent + '15',
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
    gap: 10,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.accent,
    lineHeight: 18,
  },
  gamesGrid: {
    gap: 16,
    marginBottom: 32,
  },
  gameCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  gameCardGradient: {
    padding: 16,
    minHeight: 180,
    position: 'relative',
  },
  gameIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  gameCardTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 8,
  },
  gameCardDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 20,
    marginBottom: 16,
  },
  gameCardBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
  },
  gameCardBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  gameCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  gameCardPrice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gameCardPriceText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  featuresSection: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 20,
  },
  featuresSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.backgroundGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 13,
    color: colors.textGray,
    lineHeight: 18,
  },
  // Two-column grid styles
  gameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  gameCardSmall: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  gameIconContainerSmall: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  gameCardTitleSmall: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 4,
  },
  gameCardDescriptionSmall: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 15,
    marginBottom: 8,
    height: 45,
  },
  gameCardFooterSmall: {
    marginTop: 'auto',
  },
  gameCardPriceSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gameCardPriceTextSmall: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  // Full-width card styles
  gameCardFull: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  gameCardGradientFull: {
    padding: 20,
    minHeight: 140,
  },
  gameCardBadgeFull: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
  },
  gameContentFull: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  gameIconContainerFull: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameTextContainerFull: {
    flex: 1,
  },
  gameCardTitleFull: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 6,
  },
  gameCardDescriptionFull: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 18,
    marginBottom: 8,
  },
  gameCardPriceFull: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gameCardPriceTextFull: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  arrowIcon: {
    opacity: 0.8,
  },
});