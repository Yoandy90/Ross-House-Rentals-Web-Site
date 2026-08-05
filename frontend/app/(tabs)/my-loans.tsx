import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';
import CustomHeader from '../../components/CustomHeader';
import { useTranslation } from 'react-i18next';

interface LoanApplication {
  id: string;
  amount: number;
  term_count: number;
  status: string;
  created_at: string;
}

interface Loan {
  id: string;
  principal: number;
  term_count: number;
  status: string;
  outstanding_balance: number;
  total_paid: number;
  disbursed_at: string;
  first_payment_date: string;
}

export default function MyLoansScreen() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [activeTab, setActiveTab] = useState<'loans' | 'applications'>('loans');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [loansResponse, appsResponse] = await Promise.all([
        api.get('/loans'),
        api.get('/loan-applications'),
      ]);

      setLoans(loansResponse.data);
      setApplications(appsResponse.data);
    } catch (error: any) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'approved':
        return colors.success;
      case 'pending_disbursement':
      case 'pending_signature':
      case 'submitted':
      case 'under_review':
        return colors.warning;
      case 'paid_off':
        return colors.accent;
      case 'rejected':
      case 'defaulted':
        return colors.error;
      default:
        return colors.textGray;
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      active: t('myLoans.active'),
      pending_signature: t('loans.pendingSignature', 'Pendiente de Firma'),
      pending_disbursement: t('loans.pendingDisbursement', 'Pendiente de Desembolso'),
      paid_off: t('myLoans.paidOff'),
      defaulted: 'En Mora',
      submitted: 'Enviada',
      under_review: 'En Revisión',
      approved: 'Aprobada',
      rejected: 'Rechazada',
    };
    return statusMap[status] || status;
  };

  const renderLoanCard = (loan: Loan) => (
    <TouchableOpacity
      key={loan.id}
      style={styles.card}
      onPress={() => router.push(`/loan-detail?id=${loan.id}`)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="cash" size={24} color={colors.primary} />
          <View style={styles.cardTitleText}>
            <Text style={styles.cardTitle}>
              ${loan.principal.toLocaleString()}
            </Text>
            <Text style={styles.cardSubtitle}>
              {loan.term_count} meses
            </Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(loan.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(loan.status) }]}>
            {getStatusText(loan.status)}
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Saldo pendiente:</Text>
          <Text style={styles.cardValue}>
            ${loan.outstanding_balance.toLocaleString()}
          </Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Total pagado:</Text>
          <Text style={styles.cardValue}>
            ${loan.total_paid.toLocaleString()}
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Ionicons name="chevron-forward" size={20} color={colors.primary} />
      </View>
    </TouchableOpacity>
  );

  const renderApplicationCard = (app: LoanApplication) => (
    <View key={app.id} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="document-text" size={24} color={colors.accent} />
          <View style={styles.cardTitleText}>
            <Text style={styles.cardTitle}>
              ${app.amount.toLocaleString()}
            </Text>
            <Text style={styles.cardSubtitle}>
              Solicitud • {app.term_count} meses
            </Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(app.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(app.status) }]}>
            {getStatusText(app.status)}
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Fecha de solicitud:</Text>
          <Text style={styles.cardValue}>
            {new Date(app.created_at).toLocaleDateString('es-ES')}
          </Text>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <CustomHeader 
          title={t('myLoans.title')}
          showBackButton={true}
          backRoute="/(tabs)/profile"
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CustomHeader 
        title="Mis Préstamos"
        showBackButton={true}
        backRoute="/(tabs)/profile"
      />
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >

        <View style={styles.content}>
          {/* Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'loans' && styles.tabActive]}
              onPress={() => setActiveTab('loans')}
            >
              <Text style={[styles.tabText, activeTab === 'loans' && styles.tabTextActive]}>
                Préstamos ({loans.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'applications' && styles.tabActive]}
              onPress={() => setActiveTab('applications')}
            >
              <Text style={[styles.tabText, activeTab === 'applications' && styles.tabTextActive]}>
                Solicitudes ({applications.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          {activeTab === 'loans' ? (
            loans.length > 0 ? (
              <View style={styles.list}>
                {loans.map(renderLoanCard)}
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="cash-outline" size={64} color={colors.textGray} />
                <Text style={styles.emptyText}>No tienes préstamos activos</Text>
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={() => router.push('/loans')}
                >
                  <Text style={styles.emptyButtonText}>{t('myLoans.applyForLoan')}</Text>
                </TouchableOpacity>
              </View>
            )
          ) : (
            applications.length > 0 ? (
              <View style={styles.list}>
                {applications.map(renderApplicationCard)}
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="document-text-outline" size={64} color={colors.textGray} />
                <Text style={styles.emptyText}>No tienes solicitudes</Text>
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={() => router.push('/loans')}
                >
                  <Text style={styles.emptyButtonText}>{t('myLoans.applyForLoan')}</Text>
                </TouchableOpacity>
              </View>
            )
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textGray,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingTop: Platform.OS === 'web' ? 32 : 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
  },
  content: {
    padding: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  tabTextActive: {
    color: '#FFF',
  },
  list: {
    gap: 16,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  cardTitleText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  cardSubtitle: {
    fontSize: 14,
    color: colors.textGray,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardBody: {
    gap: 8,
    marginBottom: 12,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardLabel: {
    fontSize: 14,
    color: colors.textGray,
  },
  cardValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  cardFooter: {
    alignItems: 'flex-end',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textGray,
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});