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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import CustomHeader from '../../components/CustomHeader';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

interface TaxEstimate {
  id: string;
  tax_year: number;
  filing_status: string;
  annual_income: number;
  estimated_refund: number;
  estimated_tax: number;
  status: string;
  wants_office_appointment: boolean;
  created_at: string;
  calculation_results: any;
}

export default function MyTaxEstimatesScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { t } = useTranslation();
  const styles = createStyles(colors);

  const [estimates, setEstimates] = useState<TaxEstimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedEstimate, setSelectedEstimate] = useState<TaxEstimate | null>(null);

  const filingStatusLabels: { [key: string]: string } = {
    single: 'Soltero',
    married_joint: 'Casado (Conjunto)',
    married_separate: 'Casado (Separado)',
    head_of_household: 'Jefe de Familia',
    widow: 'Viudo(a)',
  };

  const statusLabels: { [key: string]: string } = {
    pending_review: 'Pendiente de Revisión',
    reviewed: 'Revisado',
    contacted: 'Contactado',
    appointment_scheduled: 'Cita Agendada',
    converted_to_case: 'Convertido a Caso',
    archived: 'Archivado',
  };

  const statusColors: { [key: string]: string } = {
    pending_review: '#FF9800',
    reviewed: '#2196F3',
    contacted: '#9C27B0',
    appointment_scheduled: '#4CAF50',
    converted_to_case: '#00BCD4',
    archived: '#9E9E9E',
  };

  useEffect(() => {
    loadEstimates();
  }, []);

  const loadEstimates = async () => {
    try {
      setLoading(true);
      const response = await api.get('/tax-estimates/my-estimates');
      setEstimates(response.data.estimates || []);
    } catch (error) {
      console.error('Error loading estimates:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadEstimates();
  };

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const toggleDetail = (estimate: TaxEstimate) => {
    if (selectedEstimate?.id === estimate.id) {
      setSelectedEstimate(null);
    } else {
      setSelectedEstimate(estimate);
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <CustomHeader
          title="Mis Estimados de Impuestos"
          showBackButton={true}
          onBackPress={() => router.back()}
        />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CustomHeader
        title="Mis Estimados de Impuestos"
        showBackButton={true}
        onBackPress={() => router.back()}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {estimates.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={80} color={colors.border} />
            <Text style={styles.emptyTitle}>No tienes estimados</Text>
            <Text style={styles.emptyText}>
              Solicita tu primer estimado de impuestos para ver tus resultados aquí
            </Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => router.push('/tax-calculator')}
            >
              <Ionicons name="add-circle-outline" size={20} color={colors.textWhite} />
              <Text style={styles.createButtonText}>Crear Estimado</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.headerInfo}>
              <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
              <Text style={styles.headerInfoText}>
                Aquí puedes ver todos tus estimados. Recuerda que son solo estimaciones preliminares.
              </Text>
            </View>

            {estimates.map((estimate) => (
              <View key={estimate.id} style={styles.estimateCard}>
                <TouchableOpacity
                  style={styles.estimateHeader}
                  onPress={() => toggleDetail(estimate)}
                  activeOpacity={0.7}
                >
                  <View style={styles.estimateHeaderLeft}>
                    <View style={styles.yearBadge}>
                      <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                      <Text style={styles.yearBadgeText}>{estimate.tax_year}</Text>
                    </View>
                    <Text style={styles.filingStatus}>
                      {filingStatusLabels[estimate.filing_status]}
                    </Text>
                  </View>
                  <View style={styles.estimateHeaderRight}>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: statusColors[estimate.status] || colors.textSecondary },
                      ]}
                    >
                      <Text style={styles.statusBadgeText}>
                        {statusLabels[estimate.status] || estimate.status}
                      </Text>
                    </View>
                    <Ionicons
                      name={selectedEstimate?.id === estimate.id ? 'chevron-up' : 'chevron-down'}
                      size={24}
                      color={colors.textSecondary}
                    />
                  </View>
                </TouchableOpacity>

                <View style={styles.estimateSummary}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Ingreso Anual:</Text>
                    <Text style={styles.summaryValue}>
                      {formatCurrency(estimate.annual_income)}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Impuesto Estimado:</Text>
                    <Text style={styles.summaryValue}>
                      {formatCurrency(estimate.estimated_tax)}
                    </Text>
                  </View>
                  <View style={[styles.summaryRow, styles.summaryRowMain]}>
                    <Text style={styles.summaryLabelMain}>
                      {estimate.estimated_refund >= 0 ? 'Reembolso Estimado:' : 'Adeudas:'}
                    </Text>
                    <Text
                      style={[
                        styles.summaryValueMain,
                        {
                          color: estimate.estimated_refund >= 0 ? '#4CAF50' : '#F44336',
                        },
                      ]}
                    >
                      {formatCurrency(Math.abs(estimate.estimated_refund))}
                    </Text>
                  </View>
                </View>

                {selectedEstimate?.id === estimate.id && estimate.calculation_results && (
                  <View style={styles.detailsSection}>
                    <View style={styles.detailsDivider} />
                    <Text style={styles.detailsTitle}>Desglose Detallado</Text>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Ingreso Bruto:</Text>
                      <Text style={styles.detailValue}>
                        {formatCurrency(estimate.calculation_results.breakdown?.gross_income || 0)}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Deducción Estándar:</Text>
                      <Text style={styles.detailValue}>
                        -{formatCurrency(estimate.calculation_results.breakdown?.standard_deduction || 0)}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Ingreso Gravable:</Text>
                      <Text style={styles.detailValue}>
                        {formatCurrency(estimate.calculation_results.breakdown?.taxable_income || 0)}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Tasa Efectiva:</Text>
                      <Text style={styles.detailValue}>
                        {estimate.calculation_results.effective_rate}%
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.estimateFooter}>
                  <Text style={styles.dateText}>Creado: {formatDate(estimate.created_at)}</Text>
                  {estimate.wants_office_appointment && (
                    <View style={styles.appointmentTag}>
                      <Ionicons name="calendar" size={14} color={colors.primary} />
                      <Text style={styles.appointmentTagText}>Cita solicitada</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}

            <TouchableOpacity
              style={styles.newEstimateButton}
              onPress={() => router.push('/tax-calculator')}
            >
              <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
              <Text style={styles.newEstimateButtonText}>Solicitar Nuevo Estimado</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: colors.textSecondary,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 100,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginTop: 24,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
      paddingHorizontal: 32,
      lineHeight: 20,
    },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 12,
    },
    createButtonText: {
      color: colors.textWhite,
      fontSize: 16,
      fontWeight: '700',
    },
    headerInfo: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      backgroundColor: colors.primary + '15',
      padding: 16,
      borderRadius: 12,
      marginBottom: 16,
    },
    headerInfoText: {
      flex: 1,
      fontSize: 13,
      color: colors.text,
      lineHeight: 18,
    },
    estimateCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    estimateHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.background,
    },
    estimateHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    estimateHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    yearBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary + '20',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    yearBadgeText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primary,
    },
    filingStatus: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
    },
    statusBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textWhite,
    },
    estimateSummary: {
      padding: 16,
      gap: 12,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    summaryRowMain: {
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      marginTop: 4,
    },
    summaryLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    summaryValue: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    summaryLabelMain: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    summaryValueMain: {
      fontSize: 20,
      fontWeight: '700',
    },
    detailsSection: {
      padding: 16,
      paddingTop: 0,
    },
    detailsDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginBottom: 16,
    },
    detailsTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 8,
    },
    detailLabel: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    detailValue: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    estimateFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      paddingTop: 0,
    },
    dateText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    appointmentTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary + '15',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
    },
    appointmentTagText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primary,
    },
    newEstimateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.primary,
      borderStyle: 'dashed',
      marginTop: 8,
    },
    newEstimateButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.primary,
    },
  });
