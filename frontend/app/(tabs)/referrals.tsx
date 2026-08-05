import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
  ActivityIndicator,
  Linking,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../services/api';

const { width } = Dimensions.get('window');

export default function ReferralsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState('');
  const [referralLink, setReferralLink] = useState('');
  const [qrCodeData, setQrCodeData] = useState('');
  const [stats, setStats] = useState({
    totalReferrals: 0,
    completedReferrals: 0,
    pendingReferrals: 0,
    totalEarnedUsd: 0,
  });
  const [referrals, setReferrals] = useState([]);
  const [showQR, setShowQR] = useState(false);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    loadReferralData();
  }, []);

  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [loading]);

  const loadReferralData = async () => {
    try {
      setLoading(true);
      
      const codeResponse = await api.get('/referrals/my-code');
      const codeData = codeResponse.data;
      
      
      setReferralCode(codeData.code || '');
      setReferralLink(codeData.referral_link || '');
      setQrCodeData(codeData.qr_code_data || '');
      
      const referralsResponse = await api.get('/referrals/my-referrals');
      const referralsData = referralsResponse.data;
      
      
      // Map stats from V2 service format
      const statsData = referralsData.stats || {};
      setStats({
        totalReferrals: statsData.total_referrals || referralsData.total_referrals || 0,
        completedReferrals: statsData.successful_referrals || referralsData.completed_referrals || 0,
        pendingReferrals: statsData.pending_referrals || referralsData.pending_referrals || 0,
        totalEarnedUsd: statsData.total_earnings || referralsData.total_earned_usd || 0,
      });
      setReferrals(referralsData.referrals || []);
      
    } catch (error: any) {
      console.error('❌ Error loading referral data:', error);
      const errorMessage = error.response?.data?.detail || error.message || t('games.referrals.error');
      Alert.alert(
        t('games.referrals.error'), 
        t('games.referrals.errorLoadingData', { error: errorMessage })
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    try {
      await Clipboard.setStringAsync(referralCode);
      Alert.alert(t('referrals.copied', '✓ Copiado'), t('referrals.codeCopied', 'Código copiado al portapapeles'));
    } catch (error) {
      console.error('Error copying code:', error);
      Alert.alert(t('common.error', 'Error'), t('referrals.couldNotCopy', 'No se pudo copiar'));
    }
  };

  const handleCopyLink = async () => {
    try {
      await Clipboard.setStringAsync(referralLink);
      Alert.alert(t('referrals.copied', '✓ Copiado'), t('referrals.linkCopied', 'Enlace copiado al portapapeles'));
    } catch (error) {
      console.error('Error copying link:', error);
      Alert.alert(t('common.error', 'Error'), t('referrals.couldNotCopy', 'No se pudo copiar'));
    }
  };

  const handleShareWhatsApp = async () => {
    if (!referralCode || !referralLink) {
      Alert.alert(t('common.error', 'Error'), t('referrals.codeNotAvailable', 'Código no disponible'));
      return;
    }
    
    try {
      const message = `🎁 ¡Te invito a Ross Tax!\n\nUsa mi código: ${referralCode}\n\n📱 Descarga la app y agenda tu cita:\n${referralLink}\n\n¡Ambos ganamos cuando completes tu declaración!`;
      
      const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
      
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
      } else {
        await Share.share({ message });
      }
    } catch (error) {
      console.error('Error sharing via WhatsApp:', error);
      try {
        await Share.share({ message: `${referralCode} - ${referralLink}` });
      } catch (e) {
        Alert.alert(t('common.error', 'Error'), t('referrals.couldNotShare', 'No se pudo compartir'));
      }
    }
  };

  const handleShareCode = async () => {
    if (!referralCode || !referralLink) {
      Alert.alert(t('common.error', 'Error'), t('referrals.codeNotAvailable', 'Código no disponible'));
      return;
    }
    
    try {
      const message = `🎁 ¡Únete a Ross Tax!\n\nCódigo de referido: ${referralCode}\n📱 ${referralLink}\n\n¡Gana hasta $30 por cada referido!`;
      
      await Share.share({
        message,
        title: 'Referir a Ross Tax',
      });
    } catch (error) {
      console.error('Error sharing code:', error);
      Alert.alert(t('common.error', 'Error'), t('referrals.shareError', 'No se pudo compartir'));
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C1110" />
        <Text style={styles.loadingText}>Cargando tu programa...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Compact Header with safe area background */}
      <LinearGradient
        colors={['#6C1110', '#8B1918', '#A52020']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>{t('referrals.title', 'Referidos')}</Text>
            <Text style={styles.headerSubtitle}>{t('referrals.subtitle', 'Gana dinero real')}</Text>
          </View>
          <View style={styles.earningsBox}>
            <Text style={styles.earningsLabel}>{t('referrals.totalEarned', 'Total Ganado')}</Text>
            <Text style={styles.earningsAmount}>${stats.totalEarnedUsd.toFixed(2)}</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Code Card - Compact Design */}
        <Animated.View style={[
          styles.codeCard,
          {
            opacity: fadeAnim,
            transform: [
              { translateY: slideAnim },
              { scale: scaleAnim }
            ]
          }
        ]}>
          <View style={styles.codeHeader}>
            <View style={styles.codeIconContainer}>
              <Ionicons name="gift" size={24} color="#FFF" />
            </View>
            <View style={styles.codeTitleContainer}>
              <Text style={styles.codeTitle}>{t('referrals.yourCode', 'Tu Código')}</Text>
              <Text style={styles.codeSubtitle}>{t('referrals.shareAndEarn', 'Comparte y gana hasta $30')}</Text>
            </View>
          </View>
          
          <TouchableOpacity style={styles.codeBox} onPress={handleCopyCode} activeOpacity={0.8}>
            <Text style={styles.codeText}>{referralCode}</Text>
            <Ionicons name="copy" size={22} color="#6C1110" />
          </TouchableOpacity>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.whatsappBtn} onPress={handleShareWhatsApp}>
              <Ionicons name="logo-whatsapp" size={20} color="#FFF" />
              <Text style={styles.btnText}>WhatsApp</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.shareBtn} onPress={handleShareCode}>
              <Ionicons name="share-social" size={20} color="#FFF" />
              <Text style={styles.btnText}>{t('referrals.share', 'Compartir')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.qrBtn, showQR && styles.qrBtnActive]} 
              onPress={() => setShowQR(!showQR)}
            >
              <Ionicons name="qr-code" size={20} color={showQR ? '#FFF' : '#6C1110'} />
            </TouchableOpacity>
          </View>
          
          {/* Collapsible QR */}
          {showQR && qrCodeData && (
            <Animated.View style={styles.qrContainer}>
              <Image
                source={{ uri: `data:image/png;base64,${qrCodeData}` }}
                style={styles.qrImage}
                resizeMode="contain"
              />
              <Text style={styles.qrHint}>{t('referrals.scanToDownload', 'Escanear para descargar app')}</Text>
            </Animated.View>
          )}
          
          {/* Link row */}
          <TouchableOpacity style={styles.linkRow} onPress={handleCopyLink}>
            <Text style={styles.linkText} numberOfLines={1}>{referralLink}</Text>
            <Ionicons name="copy-outline" size={18} color="#888" />
          </TouchableOpacity>
        </Animated.View>

        {/* Stats Grid */}
        <Animated.View style={[
          styles.statsContainer,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}>
          <Text style={styles.sectionTitle}>{t('referrals.yourStats', 'Tus Estadísticas')}</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="people" size={20} color="#1976D2" />
              </View>
              <Text style={styles.statNumber}>{stats.totalReferrals}</Text>
              <Text style={styles.statLabel}>{t('referrals.total', 'Total')}</Text>
            </View>
            
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="checkmark-circle" size={20} color="#388E3C" />
              </View>
              <Text style={[styles.statNumber, { color: '#388E3C' }]}>{stats.completedReferrals}</Text>
              <Text style={styles.statLabel}>{t('referrals.completed', 'Completados')}</Text>
            </View>
            
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: '#FFF8E1' }]}>
                <Ionicons name="time" size={20} color="#F9A825" />
              </View>
              <Text style={[styles.statNumber, { color: '#F9A825' }]}>{stats.pendingReferrals}</Text>
              <Text style={styles.statLabel}>{t('referrals.pending', 'Pendientes')}</Text>
            </View>
          </View>
        </Animated.View>

        {/* How it Works - Compact */}
        <View style={styles.howItWorks}>
          <Text style={styles.sectionTitle}>{t('referrals.howItWorks', '¿Cómo Funciona?')}</Text>
          
          <View style={styles.stepsRow}>
            <View style={styles.step}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepNum}>1</Text>
              </View>
              <Text style={styles.stepText}>{t('referrals.step1', 'Comparte tu código')}</Text>
            </View>
            
            <Ionicons name="arrow-forward" size={16} color="#CCC" style={styles.stepArrow} />
            
            <View style={styles.step}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepNum}>2</Text>
              </View>
              <Text style={styles.stepText}>{t('referrals.step2', 'Tu amigo se registra')}</Text>
            </View>
            
            <Ionicons name="arrow-forward" size={16} color="#CCC" style={styles.stepArrow} />
            
            <View style={styles.step}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepNum}>3</Text>
              </View>
              <Text style={styles.stepText}>{t('referrals.bothWin', '¡Ambos ganan!')}</Text>
            </View>
          </View>
        </View>

        {/* Earnings Tiers - Compact Cards */}
        <View style={styles.tiersSection}>
          <Text style={styles.sectionTitle}>{t('referrals.earningsSystem', 'Sistema de Ganancias')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tiersScroll}>
            <View style={[styles.tierCard, { backgroundColor: '#FFF5F5' }]}>
              <Text style={styles.tierRange}>0-10</Text>
              <Text style={styles.tierAmount}>$10</Text>
              <Text style={styles.tierLabel}>por referido</Text>
            </View>
            <View style={[styles.tierCard, { backgroundColor: '#F0FFF4' }]}>
              <Text style={styles.tierRange}>11-20</Text>
              <Text style={[styles.tierAmount, { color: '#388E3C' }]}>$15</Text>
              <Text style={styles.tierLabel}>por referido</Text>
            </View>
            <View style={[styles.tierCard, { backgroundColor: '#E8F5E9' }]}>
              <Text style={styles.tierRange}>21+</Text>
              <Text style={[styles.tierAmount, { color: '#2E7D32' }]}>$20</Text>
              <Text style={styles.tierLabel}>por referido</Text>
            </View>
          </ScrollView>
        </View>

        {/* Referrals List */}
        <View style={styles.referralsSection}>
          <Text style={styles.sectionTitle}>{t('referrals.myReferrals', 'Mis Referidos')}</Text>
          
          {referrals.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="people-outline" size={40} color="#CCC" />
              </View>
              <Text style={styles.emptyTitle}>Sin referidos aún</Text>
              <Text style={styles.emptyText}>¡Comparte tu código y empieza a ganar!</Text>
            </View>
          ) : (
            referrals.map((referral: any, index: number) => (
              <View key={index} style={styles.referralItem}>
                <View style={styles.referralAvatar}>
                  <Text style={styles.avatarLetter}>
                    {referral.referred_name?.charAt(0).toUpperCase() || 'U'}
                  </Text>
                </View>
                <View style={styles.referralInfo}>
                  <Text style={styles.referralName}>{referral.referred_name}</Text>
                  <Text style={styles.referralDate}>
                    {new Date(referral.created_at).toLocaleDateString('es-MX', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </Text>
                </View>
                <View style={styles.referralRight}>
                  <View style={[
                    styles.statusPill,
                    referral.status === 'completed' ? styles.statusCompleted : styles.statusPending
                  ]}>
                    <Text style={styles.statusText}>
                      {referral.status === 'completed' ? t('common.completed', 'Completado') : t('common.pending', 'Pendiente')}
                    </Text>
                  </View>
                  {referral.status === 'completed' && (
                    <Text style={styles.rewardAmount}>+${referral.reward_amount_usd}</Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Bottom spacing */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 8,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  earningsBox: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  earningsLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  earningsAmount: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  codeCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  codeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  codeIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#6C1110',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  codeTitleContainer: {
    flex: 1,
  },
  codeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  codeSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#6C1110',
    borderStyle: 'dashed',
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginBottom: 16,
  },
  codeText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#6C1110',
    letterSpacing: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  whatsappBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
  },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C1110',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
  },
  qrBtn: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6C1110',
  },
  qrBtnActive: {
    backgroundColor: '#6C1110',
  },
  btnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  qrContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    marginTop: 8,
  },
  qrImage: {
    width: 150,
    height: 150,
    borderRadius: 8,
  },
  qrHint: {
    fontSize: 12,
    color: '#888',
    marginTop: 8,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  linkText: {
    flex: 1,
    fontSize: 12,
    color: '#666',
  },
  statsContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  statLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  howItWorks: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  step: {
    alignItems: 'center',
    flex: 1,
  },
  stepBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6C1110',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  stepNum: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  stepText: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  stepArrow: {
    marginHorizontal: 4,
  },
  tiersSection: {
    marginBottom: 20,
  },
  tiersScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  tierCard: {
    width: 90,
    borderRadius: 14,
    padding: 12,
    marginRight: 10,
    alignItems: 'center',
  },
  tierRange: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  tierAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#6C1110',
  },
  tierLabel: {
    fontSize: 10,
    color: '#888',
    marginTop: 2,
  },
  referralsSection: {
    marginBottom: 20,
  },
  emptyState: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
  },
  referralItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  referralAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6C1110',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarLetter: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  referralInfo: {
    flex: 1,
  },
  referralName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  referralDate: {
    fontSize: 12,
    color: '#888',
  },
  referralRight: {
    alignItems: 'flex-end',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusPending: {
    backgroundColor: '#FFF8E1',
  },
  statusCompleted: {
    backgroundColor: '#E8F5E9',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
  },
  rewardAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#388E3C',
    marginTop: 4,
  },
});
