import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
  package_id?: string;
  service_type?: string;
  service_name?: string;
  payment_amount_usd?: number;
  is_first_purchase_bonus?: boolean;
}

export default function CreditHistoryScreen() {
  const colors = useThemeColors();
  const { t, i18n } = useTranslation();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const response = await api.get('/credits/history', {
        params: { page: 1, per_page: 100 }
      });
      
      
      setTransactions(response.data.transactions || []);
      setCurrentBalance(response.data.current_balance || 0);
      setTotalCount(response.data.total_count || 0);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadHistory();
  };

  const getFilteredTransactions = () => {
    if (filterType === 'all') return transactions;
    if (filterType === 'transfer') {
      return transactions.filter(t => t.transaction_type === 'transfer_sent' || t.transaction_type === 'transfer_received');
    }
    return transactions.filter(t => t.transaction_type === filterType);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'purchase': return 'card';
      case 'bonus': return 'gift';
      case 'usage': return 'arrow-down-circle';
      case 'refund': return 'arrow-undo';
      case 'admin_add': return 'add-circle';
      case 'admin_deduct': return 'remove-circle';
      case 'transfer_sent': return 'arrow-up-circle';
      case 'transfer_received': return 'arrow-down-circle';
      case 'withdrawal': return 'wallet';
      case 'documents_completion_bonus': return 'document-text';
      case 'referral_bonus': return 'people';
      case 'welcome_bonus': return 'happy';
      case 'registration_bonus': return 'person-add';
      case 'appointment_bonus': return 'calendar';
      case 'review_bonus': return 'star';
      case 'loyalty_bonus': return 'heart';
      case 'promotion': return 'pricetag';
      case 'credit_purchase': return 'card';
      case 'apple_iap': return 'logo-apple';
      default: return 'swap-horizontal';
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'purchase':
      case 'bonus':
      case 'admin_add':
      case 'transfer_received':
      case 'documents_completion_bonus':
      case 'referral_bonus':
      case 'welcome_bonus':
      case 'registration_bonus':
      case 'appointment_bonus':
      case 'review_bonus':
      case 'loyalty_bonus':
      case 'promotion':
      case 'credit_purchase':
      case 'apple_iap':
        return colors.success;
      case 'usage':
      case 'admin_deduct':
      case 'transfer_sent':
      case 'withdrawal':
        return colors.error;
      case 'refund':
        return colors.warning;
      default:
        return colors.textGray;
    }
  };

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case 'purchase': return t('creditHistory.purchase');
      case 'bonus': return t('creditHistory.bonus');
      case 'usage': return t('creditHistory.usage');
      case 'refund': return t('creditHistory.refund');
      case 'admin_add': return t('creditHistory.adminAdd', 'Added by Admin');
      case 'admin_deduct': return t('creditHistory.adminDeduct', 'Deducted by Admin');
      case 'transfer_sent': return t('creditHistory.transferSent', 'Transfer Sent');
      case 'transfer_received': return t('creditHistory.transferReceived', 'Transfer Received');
      case 'withdrawal': return t('creditHistory.withdrawal');
      case 'documents_completion_bonus': return t('creditHistory.documentsBonus', 'Documents Bonus');
      case 'referral_bonus': return t('creditHistory.referralBonus', 'Referral Bonus');
      case 'welcome_bonus': return t('creditHistory.welcomeBonus', 'Welcome Bonus');
      case 'registration_bonus': return t('creditHistory.registrationBonus', 'Registration Bonus');
      case 'appointment_bonus': return t('creditHistory.appointmentBonus', 'Appointment Bonus');
      case 'review_bonus': return t('creditHistory.reviewBonus', 'Review Bonus');
      case 'loyalty_bonus': return t('creditHistory.loyaltyBonus', 'Loyalty Bonus');
      case 'promotion': return t('creditHistory.promotion');
      case 'credit_purchase': return t('creditHistory.creditPurchase', 'Credit Purchase');
      case 'apple_iap': return t('creditHistory.creditPurchase', 'Credit Purchase');
      default: return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const locale = i18n.language === 'en' ? 'en-US' : 'es-ES';
    return date.toLocaleDateString(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderTransaction = (transaction: Transaction, index: number) => {
    const color = getTransactionColor(transaction.transaction_type);
    const icon = getTransactionIcon(transaction.transaction_type);
    const isPositive = transaction.amount > 0;
    
    // Formato de fecha mejorado
    const date = new Date(transaction.created_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();
    
    let dateLabel = '';
    if (isToday) {
      dateLabel = t('creditHistory.today', 'Hoy');
    } else if (isYesterday) {
      dateLabel = t('creditHistory.yesterday', 'Ayer');
    } else {
      const locale = i18n.language === 'en' ? 'en-US' : 'es-ES';
      dateLabel = date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    }
    
    const timeLocale = i18n.language === 'en' ? 'en-US' : 'es-ES';
    const timeLabel = date.toLocaleTimeString(timeLocale, { hour: '2-digit', minute: '2-digit' });

    return (
      <View key={transaction.id} style={styles.transactionCard}>
        {/* Left Section: Icon */}
        <View style={[styles.transactionIconLarge, { backgroundColor: color + '15' }]}>
          <Ionicons name={icon as any} size={30} color={color} />
        </View>

        {/* Middle Section: Info */}
        <View style={styles.transactionInfo}>
          <View style={styles.transactionTopRow}>
            <Text style={styles.transactionTypeNew}>
              {getTransactionLabel(transaction.transaction_type)}
            </Text>
            {transaction.is_first_purchase_bonus && (
              <View style={styles.firstPurchaseBadge}>
                <Ionicons name="sparkles" size={10} color="#FFD700" />
                <Text style={styles.firstPurchaseBadgeText}>1ª</Text>
              </View>
            )}
          </View>
          
          {transaction.description && transaction.description !== 'N/A' && (
            <Text style={styles.transactionDescriptionNew} numberOfLines={1}>
              {transaction.description}
            </Text>
          )}

          {transaction.service_name && (
            <View style={styles.transactionMetaRow}>
              <Ionicons name="cube-outline" size={12} color={colors.textGray} />
              <Text style={styles.transactionMeta}>{transaction.service_name}</Text>
            </View>
          )}

          {transaction.payment_amount_usd && (
            <View style={styles.transactionMetaRow}>
              <Ionicons name="cash-outline" size={12} color={colors.textGray} />
              <Text style={styles.transactionMeta}>${transaction.payment_amount_usd.toFixed(2)} USD</Text>
            </View>
          )}

          <View style={styles.transactionDateRow}>
            <Ionicons name="time-outline" size={12} color={colors.textGray} />
            <Text style={styles.transactionDateNew}>
              {dateLabel} • {timeLabel}
            </Text>
          </View>
        </View>

        {/* Right Section: Amount */}
        <View style={styles.transactionAmountSection}>
          <Text style={[
            styles.amountTextLarge,
            { color: isPositive ? '#10B981' : '#EF4444' }
          ]}>
            {isPositive ? '+' : ''}{Math.abs(transaction.amount).toFixed(0)}
          </Text>
          {transaction.balance_after != null && (
            <View style={styles.balanceAfterBadge}>
              <Ionicons name="wallet-outline" size={10} color={colors.textGray} />
              <Text style={styles.balanceAfterText}>{transaction.balance_after.toFixed(0)}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('creditHistory.title')}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{t('creditHistory.loading', 'Cargando historial...')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const filteredTransactions = getFilteredTransactions();

  return (
    <View style={styles.container}>
      {/* Header con Gradient - Estilo Dashboard/Login */}
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientHeader}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => router.push('/credits')} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.gradientHeaderTitle}>{t('creditHistory.title')}</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>
          
          {/* Balance Banner Integrado */}
          <View style={styles.integratedBalanceBanner}>
            <View style={styles.balanceCard}>
              <View style={styles.balanceMainInfo}>
                <View style={styles.balanceIconWhite}>
                  <Ionicons name="wallet-outline" size={24} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.balanceLabelWhite}>{t('creditHistory.currentBalance', 'Balance Actual')}</Text>
                  <Text style={styles.balanceAmountWhite}>{currentBalance.toFixed(0)}</Text>
                </View>
              </View>
              <View style={styles.transactionCountBadge}>
                <Ionicons name="receipt-outline" size={18} color={colors.primary} />
                <View>
                  <Text style={styles.transactionCountNumber}>{totalCount}</Text>
                  <Text style={styles.transactionCountLabel}>{t('creditHistory.transactions', 'transacciones')}</Text>
                </View>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Filters - Chips Compactos */}
      <View style={styles.filtersContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersScroll}
        >
          {[
            { type: 'all', label: t('creditHistory.all', 'Todas'), icon: 'list' },
            { type: 'purchase', label: t('creditHistory.purchases', 'Compras'), icon: 'card' },
            { type: 'bonus', label: t('creditHistory.bonuses', 'Bonos'), icon: 'gift' },
            { type: 'usage', label: t('creditHistory.usages', 'Usos'), icon: 'arrow-down-circle' },
            { type: 'transfer', label: t('creditHistory.transfers', 'Transferencias'), icon: 'swap-horizontal' },
            { type: 'refund', label: t('creditHistory.refund', 'Reembolsos'), icon: 'arrow-undo' },
          ].map(({ type, label, icon }) => {
            const isActive = filterType === type;
            // For 'transfer', count both sent and received
            const count = type === 'all' 
              ? transactions.length 
              : type === 'transfer'
                ? transactions.filter(t => t.transaction_type === 'transfer_sent' || t.transaction_type === 'transfer_received').length
                : transactions.filter(t => t.transaction_type === type).length;
            
            return (
              <TouchableOpacity
                key={type}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setFilterType(type)}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name={icon as any} 
                  size={18} 
                  color={isActive ? '#FFF' : colors.primary} 
                />
                <Text style={[styles.filterChipLabel, isActive && styles.filterChipLabelActive]}>
                  {label}
                </Text>
                {count > 0 && (
                  <View style={[styles.filterChipBadge, isActive && styles.filterChipBadgeActive]}>
                    <Text style={[styles.filterChipBadgeText, isActive && styles.filterChipBadgeTextActive]}>
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Transactions List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredTransactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color={colors.textGray} />
            <Text style={styles.emptyStateTitle}>Sin transacciones</Text>
            <Text style={styles.emptyStateText}>
              {filterType === 'all' 
                ? 'Aún no tienes transacciones de créditos'
                : `No hay transacciones de tipo "${getTransactionLabel(filterType)}"`
              }
            </Text>
          </View>
        ) : (
          <>
            {filteredTransactions.map((transaction, index) => renderTransaction(transaction, index))}
          </>
        )}
      </ScrollView>
      
      {/* Safe Area Bottom */}
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.background }} />
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  
  // Gradient Header Styles
  gradientHeader: {
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  gradientHeaderTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -0.3,
  },
  
  // Integrated Balance Banner
  integratedBalanceBanner: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  balanceCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
  balanceMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  balanceIconWhite: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceLabelWhite: {
    fontSize: 13,
    color: colors.textGray,
    fontWeight: '600',
    marginBottom: 4,
  },
  balanceAmountWhite: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -1,
  },
  transactionCountBadge: {
    backgroundColor: colors.primary + '10',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  transactionCountNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
  },
  transactionCountLabel: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  
  // OLD STYLES (keeping for loading state)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textGray,
  },
  
  // Filters
  filtersContainer: {
    backgroundColor: '#FFF',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filtersScroll: {
    paddingHorizontal: 16,
    gap: 10,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.primary + '15',
    borderWidth: 1.5,
    borderColor: colors.primary + '30',
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 5,
  },
  filterChipLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  filterChipLabelActive: {
    color: '#FFF',
  },
  filterChipBadge: {
    backgroundColor: colors.primary,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  filterChipBadgeActive: {
    backgroundColor: '#FFF',
  },
  filterChipBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFF',
  },
  filterChipBadgeTextActive: {
    color: colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 0,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  transactionIconLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  transactionInfo: {
    flex: 1,
    marginRight: 12,
  },
  transactionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  transactionTypeNew: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  firstPurchaseBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  firstPurchaseBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  transactionDescriptionNew: {
    fontSize: 14,
    color: colors.textGray,
    marginBottom: 6,
    fontWeight: '500',
  },
  transactionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  transactionMeta: {
    fontSize: 13,
    color: colors.textGray,
    fontWeight: '600',
  },
  transactionDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  transactionDateNew: {
    fontSize: 12,
    color: colors.textGray,
    fontWeight: '700',
  },
  transactionAmountSection: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 90,
  },
  amountTextLarge: {
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  balanceAfterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 4,
  },
  balanceAfterText: {
    fontSize: 12,
    color: colors.textGray,
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: colors.textGray,
    textAlign: 'center',
    maxWidth: 250,
  },
  
  // OLD STYLES - TO BE REMOVED (keeping for compatibility)
  transactionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionContent: {
    flex: 1,
  },
  transactionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  transactionType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  transactionDescription: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 4,
  },
  transactionService: {
    fontSize: 12,
    color: colors.textGray,
    marginBottom: 2,
  },
  transactionPayment: {
    fontSize: 12,
    color: colors.textGray,
    fontWeight: '600',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: colors.textGray,
  },
  transactionAmount: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 80,
  },
  amountText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  amountLabel: {
    fontSize: 11,
    color: colors.textGray,
    marginTop: 2,
  },
  balanceAfter: {
    fontSize: 11,
    color: colors.textGray,
    marginTop: 4,
  },
});