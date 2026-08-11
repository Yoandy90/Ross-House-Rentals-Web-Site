import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Modal,
  Switch,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, G, Text as SvgText } from 'react-native-svg';
import { apiCall } from '../../src/utils/api';
import { Badge } from '../../src/components/ui/Badge';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, FontSizes, BorderRadius, Shadows, useColors } from '../../src/constants/theme';
import { formatCurrency, formatShortDate, capitalize } from '../../src/utils/formatters';
import { useAuth } from '../../src/contexts/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════════════════════════
// DONUT CHART COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface DonutData {
  label: string;
  value: number;
  color: string;
}

function PaymentDonutChart({ 
  data, 
  totalAmount, 
  centerLabel 
}: { 
  data: DonutData[]; 
  totalAmount: number;
  centerLabel?: string;
}) {
  const C = useColors();
  const donutStyles = React.useMemo(() => createDonutStyles(C), [C]);
  const size = 180;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Calculate stroke dasharray for each segment
  let cumulativePercent = 0;
  const segments = data.map(item => {
    const percent = totalAmount > 0 ? (item.value / totalAmount) * 100 : 0;
    const offset = cumulativePercent;
    cumulativePercent += percent;
    return {
      ...item,
      percent,
      dashArray: `${(percent / 100) * circumference} ${circumference}`,
      rotation: (offset / 100) * 360 - 90,
    };
  });

  return (
    <View style={donutStyles.container}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        
        {/* Data segments */}
        <G rotation={-90} origin={`${center}, ${center}`}>
          {segments.map((seg, i) => (
            <Circle
              key={i}
              cx={center}
              cy={center}
              r={radius}
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={seg.dashArray}
              strokeDashoffset={0}
              strokeLinecap="round"
              fill="none"
              transform={`rotate(${seg.rotation + 90}, ${center}, ${center})`}
              opacity={0.9}
            />
          ))}
        </G>

        {/* Center text */}
        <SvgText
          x={center}
          y={center - 8}
          textAnchor="middle"
          fill={C.textPrimary}
          fontSize={22}
          fontWeight="700"
        >
          {formatCurrency(totalAmount)}
        </SvgText>
        <SvgText
          x={center}
          y={center + 16}
          textAnchor="middle"
          fill={C.textMuted}
          fontSize={11}
          fontWeight="500"
        >
          {centerLabel || 'TOTAL'}
        </SvgText>
      </Svg>

      {/* Legend */}
      <View style={donutStyles.legend}>
        {data.map((item, i) => (
          <View key={i} style={donutStyles.legendItem}>
            <View style={[donutStyles.legendDot, { backgroundColor: item.color }]} />
            <Text style={donutStyles.legendLabel}>{item.label}</Text>
            <Text style={[donutStyles.legendValue, { color: item.color }]}>
              {formatCurrency(item.value)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const createDonutStyles = (C: any) => StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    gap: 24,
  },
  legendItem: {
    alignItems: 'center',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 6,
  },
  legendLabel: {
    fontSize: 11,
    color: C.textMuted,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  legendValue: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAYMENTS SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

export default function PaymentsScreen() {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const role = user?.role || 'tenant';

  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ownerData, setOwnerData] = useState<any>(null);
  const [leaseInfo, setLeaseInfo] = useState<any>(null);
  const [nextPaymentInfo, setNextPaymentInfo] = useState<any>(null);
  const [currentMonthPaid, setCurrentMonthPaid] = useState(false);
  
  // Autopay state
  const [autopayEnabled, setAutopayEnabled] = useState(false);
  const [autopayDay, setAutopayDay] = useState(1);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [savingAutopay, setSavingAutopay] = useState(false);
  const [showDayPicker, setShowDayPicker] = useState(false);

  const fetchPayments = useCallback(async () => {
    try {
      if (role === 'landlord') {
        const data = await apiCall('/owner/dashboard');
        setOwnerData(data);
        setPayments(data.recent_transactions || []);
      } else {
        // Fetch payment history
        const data = await apiCall('/tenant/payment-history');
        setPayments(data.payments || []);
        
        // Try to get lease info
        try {
          const dash = await apiCall('/tenant/dashboard');
          setLeaseInfo(dash.lease || dash.contract || null);
          setNextPaymentInfo(dash.next_payment || null);
          setCurrentMonthPaid(Boolean(dash?.next_payment?.current_month_paid));
        } catch (e) { /* ignore */ }
        
        // Load payment methods and autopay status
        try {
          const methodsData = await apiCall('/tenant/payment-methods');
          console.log('Payment methods loaded:', methodsData.payment_methods?.length || 0);
          setPaymentMethods(methodsData.payment_methods || []);
          if (!selectedPaymentMethod && methodsData.payment_methods?.length > 0) {
            const defaultMethod = methodsData.payment_methods.find((m: any) => m.is_default) || methodsData.payment_methods[0];
            setSelectedPaymentMethod(defaultMethod?.id || null);
          }
          // Also set autopay from this response if available
          if (methodsData.autopay) {
            setAutopayEnabled(methodsData.autopay.enabled || false);
            setAutopayDay(methodsData.autopay.day_of_month || 1);
            if (methodsData.autopay.payment_method_id) {
              setSelectedPaymentMethod(methodsData.autopay.payment_method_id);
            }
          }
        } catch (e: any) {
          console.log('Error loading payment methods:', e?.message || e);
        }
      }
    } catch (err) {
      console.log('Payments fetch error:', err);
      try {
        const dash = await apiCall('/tenant/dashboard');
        setPayments(dash.payments || []);
        setLeaseInfo(dash.lease || null);
      } catch (e) { /* ignore */ }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role, selectedPaymentMethod]);

  useEffect(() => { fetchPayments(); }, []);
  const onRefresh = () => { setRefreshing(true); fetchPayments(); };

  // Save autopay configuration
  const handleSaveAutopay = useCallback(async (enabled: boolean, methodId?: string, day?: number) => {
    setSavingAutopay(true);
    try {
      const res = await apiCall('/tenant/autopay/configure', {
        method: 'POST',
        body: {
          enabled,
          payment_method_id: methodId || selectedPaymentMethod || '',
          day_of_month: day || autopayDay,
        },
      });
      if (res.success) {
        setAutopayEnabled(enabled);
        const title = enabled ? 'Autopago Activado' : 'Autopago Desactivado';
        const message = enabled 
          ? `Tu renta se pagará automáticamente el día ${day || autopayDay} de cada mes.`
          : 'El pago automático ha sido desactivado.';
        Alert.alert(title, message);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo guardar la configuración');
    } finally {
      setSavingAutopay(false);
    }
  }, [selectedPaymentMethod, autopayDay]);

  // Toggle autopay
  const toggleAutopay = useCallback(async (value: boolean) => {
    // If trying to enable and no methods loaded, try to fetch them first
    if (value && paymentMethods.length === 0) {
      try {
        const methodsData = await apiCall('/tenant/payment-methods');
        const freshMethods = methodsData.payment_methods || [];
        setPaymentMethods(freshMethods);
        
        if (freshMethods.length === 0) {
          Alert.alert(
            'Método de Pago Requerido',
            'Necesitas agregar un método de pago para activar el pago automático.',
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Agregar Tarjeta', onPress: () => router.push('/payment-methods') },
            ]
          );
          return;
        }
        
        // Methods found, proceed with enabling
        const defaultMethod = freshMethods.find((m: any) => m.is_default) || freshMethods[0];
        if (defaultMethod) {
          setSelectedPaymentMethod(defaultMethod.id);
          handleSaveAutopay(true, defaultMethod.id);
        }
        return;
      } catch (e) {
        Alert.alert(
          'Método de Pago Requerido',
          'Necesitas agregar un método de pago para activar el pago automático.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Agregar Tarjeta', onPress: () => router.push('/payment-methods') },
          ]
        );
        return;
      }
    }
    
    if (value && !selectedPaymentMethod) {
      const defaultMethod = paymentMethods.find((m: any) => m.is_default) || paymentMethods[0];
      if (defaultMethod) {
        setSelectedPaymentMethod(defaultMethod.id);
        handleSaveAutopay(true, defaultMethod.id);
      }
    } else {
      handleSaveAutopay(value);
    }
  }, [paymentMethods, selectedPaymentMethod, handleSaveAutopay, router]);

  // Get selected payment method details
  const getSelectedMethodLabel = useCallback(() => {
    const method = paymentMethods.find((m: any) => m.id === selectedPaymentMethod);
    if (method) {
      const brand = method.brand || 'Card';
      return `${brand.charAt(0).toUpperCase()}${brand.slice(1)} •••• ${method.last4}`;
    }
    return 'Seleccionar tarjeta';
  }, [paymentMethods, selectedPaymentMethod]);

  // Calculate totals
  const totalPaid = payments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + (p.total_paid || p.amount || 0), 0);
  const totalPending = payments
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalLate = payments
    .filter(p => p.status === 'late')
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const grandTotal = totalPaid + totalPending + totalLate;
  const rentAmount = leaseInfo?.rent_amount || leaseInfo?.monthly_rent || 0;
  const dueDay = leaseInfo?.due_day || 1;

  // Donut chart data
  const chartData: DonutData[] = [
    { label: t('payments.paid'), value: totalPaid, color: '#10B981' },
    { label: t('payments.pending'), value: totalPending || (grandTotal === 0 ? 1 : 0), color: '#F59E0B' },
  ];
  if (totalLate > 0) {
    chartData.push({ label: t('payments.late'), value: totalLate, color: '#EF4444' });
  }

  const statusVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'pending': return 'warning';
      case 'late': return 'error';
      default: return 'default';
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'completed': return t('payments.status_completed');
      case 'pending': return t('payments.status_pending');
      case 'late': return t('payments.status_late');
      default: return capitalize(status);
    }
  };

  const getNextPaymentDate = () => {
    const now = new Date();
    let nextDate = new Date(now.getFullYear(), now.getMonth(), dueDay);
    if (nextDate <= now) {
      nextDate = new Date(now.getFullYear(), now.getMonth() + 1, dueDay);
    }
    return nextDate;
  };

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={C.brandRed} />
      </View>
    );
  }

  return (
    <View style={[styles.rootContainer, { backgroundColor: C.background }]}>
      <View style={styles.bgGlow1} />
      <View style={styles.bgGlow2} />

      <ScrollView
        style={[styles.container, { paddingTop: insets.top }]}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brandRed} />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>
          {role === 'landlord' ? t('owner_dashboard.income') : t('payments.title')}
        </Text>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* DONUT CHART SECTION */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <View style={styles.chartCard}>
          <LinearGradient
            colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.01)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <PaymentDonutChart 
            data={chartData} 
            totalAmount={grandTotal || rentAmount} 
            centerLabel={grandTotal > 0 ? 'BALANCE' : 'RENTA'}
          />
        </View>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* NEXT PAYMENT INFO */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {role !== 'landlord' && rentAmount > 0 && (
          <View style={styles.nextPaymentCard}>
            <LinearGradient
              colors={['rgba(200, 16, 46, 0.15)', 'rgba(200, 16, 46, 0.05)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.nextPaymentContent}>
              <View style={styles.nextPaymentLeft}>
                <View style={styles.calendarIcon}>
                  <Ionicons name="calendar" size={20} color={C.brandRed} />
                </View>
                <View>
                  <Text style={styles.nextPaymentLabel}>{t('payments.next_payment')}</Text>
                  <Text style={styles.nextPaymentDate}>
                    {formatShortDate(getNextPaymentDate().toISOString())}
                  </Text>
                </View>
              </View>
              <View style={styles.nextPaymentRight}>
                <Text style={styles.nextPaymentAmount}>{formatCurrency(rentAmount)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* PAY RENT BUTTON */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {role === 'landlord' ? (
          <TouchableOpacity
            style={styles.payRentBtn}
            activeOpacity={0.85}
            onPress={() => router.push('/owner-dashboard')}
          >
            <LinearGradient
              colors={['#059669', '#10B981']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[StyleSheet.absoluteFill, { borderRadius: BorderRadius.card }]}
            />
            <View style={styles.payRentBtnInner}>
              <View style={styles.payRentIconWrap}>
                <Ionicons name="stats-chart" size={22} color={C.white} />
              </View>
              <Text style={styles.payRentBtnText}>{t('owner_dashboard.view_full')}</Text>
              <Ionicons name="arrow-forward" size={20} color={C.white} />
            </View>
          </TouchableOpacity>
        ) : currentMonthPaid ? (
          // Current month already paid — show success badge instead of pay button
          <View style={[styles.payRentBtn, { overflow: 'hidden' }]}>
            <LinearGradient
              colors={['#065F46', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[StyleSheet.absoluteFill, { borderRadius: BorderRadius.card }]}
            />
            <View style={styles.payRentBtnInner}>
              <View style={styles.payRentIconWrap}>
                <Ionicons name="checkmark-circle" size={22} color={C.white} />
              </View>
              <Text style={styles.payRentBtnText}>Renta al día este mes</Text>
              <Ionicons name="shield-checkmark" size={20} color={C.white} />
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.payRentBtn}
            activeOpacity={0.85}
            onPress={() => router.push('/pay')}
          >
            <LinearGradient
              colors={['#C8102E', '#9B1B30']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[StyleSheet.absoluteFill, { borderRadius: BorderRadius.card }]}
            />
            <View style={styles.payRentBtnInner}>
              <View style={styles.payRentIconWrap}>
                <Ionicons name="wallet" size={22} color={C.white} />
              </View>
              <Text style={styles.payRentBtnText}>{t('home.pay_rent')}</Text>
              <Ionicons name="arrow-forward" size={20} color={C.white} />
            </View>
          </TouchableOpacity>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* AUTOPAY SECTION (Only for tenants) */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {role !== 'landlord' && (
          <View style={styles.autopayCard}>
            <LinearGradient
              colors={autopayEnabled 
                ? ['rgba(16, 185, 129, 0.12)', 'rgba(16, 185, 129, 0.04)'] 
                : ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.01)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            
            {/* Header Row */}
            <View style={styles.autopayHeader}>
              <View style={styles.autopayHeaderLeft}>
                <View style={[
                  styles.autopayIconWrap,
                  autopayEnabled && styles.autopayIconWrapActive
                ]}>
                  <Ionicons 
                    name="repeat" 
                    size={20} 
                    color={autopayEnabled ? C.success : C.textMuted} 
                  />
                </View>
                <View>
                  <Text style={styles.autopayTitle}>Pago Automático</Text>
                  <Text style={styles.autopaySubtitle}>
                    {autopayEnabled 
                      ? `Día ${autopayDay} de cada mes` 
                      : 'Desactivado'}
                  </Text>
                </View>
              </View>
              <Switch
                value={autopayEnabled}
                onValueChange={toggleAutopay}
                trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(16, 185, 129, 0.4)' }}
                thumbColor={autopayEnabled ? C.success : C.textMuted}
                disabled={savingAutopay}
              />
            </View>

            {/* Config Details (only when enabled) */}
            {autopayEnabled && (
              <View style={styles.autopayDetails}>
                {/* Day Selector */}
                <TouchableOpacity 
                  style={styles.autopayDetailRow}
                  onPress={() => setShowDayPicker(true)}
                  activeOpacity={0.7}
                >
                  <View style={styles.autopayDetailLeft}>
                    <Ionicons name="calendar-outline" size={18} color={C.textMuted} />
                    <Text style={styles.autopayDetailLabel}>Día del Mes</Text>
                  </View>
                  <View style={styles.autopayDetailRight}>
                    <Text style={styles.autopayDetailValue}>Día {autopayDay}</Text>
                    <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
                  </View>
                </TouchableOpacity>

                {/* Payment Method */}
                <TouchableOpacity 
                  style={styles.autopayDetailRow}
                  onPress={() => router.push('/payment-methods')}
                  activeOpacity={0.7}
                >
                  <View style={styles.autopayDetailLeft}>
                    <Ionicons name="card-outline" size={18} color={C.textMuted} />
                    <Text style={styles.autopayDetailLabel}>Método de Pago</Text>
                  </View>
                  <View style={styles.autopayDetailRight}>
                    <Text style={styles.autopayDetailValue}>{getSelectedMethodLabel()}</Text>
                    <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
                  </View>
                </TouchableOpacity>

                {/* Rent Amount */}
                {rentAmount > 0 && (
                  <View style={[styles.autopayDetailRow, { borderBottomWidth: 0 }]}>
                    <View style={styles.autopayDetailLeft}>
                      <Ionicons name="cash-outline" size={18} color={C.textMuted} />
                      <Text style={styles.autopayDetailLabel}>Monto Mensual</Text>
                    </View>
                    <Text style={[styles.autopayDetailValue, { color: C.success, fontWeight: '700' }]}>
                      {formatCurrency(rentAmount)}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Info message when disabled */}
            {!autopayEnabled && (
              <View style={styles.autopayInfo}>
                <Ionicons name="information-circle-outline" size={16} color={C.textMuted} />
                <Text style={styles.autopayInfoText}>
                  Activa el pago automático para nunca olvidar tu renta
                </Text>
              </View>
            )}

            {/* Loading overlay */}
            {savingAutopay && (
              <View style={styles.autopayLoading}>
                <ActivityIndicator size="small" color={C.success} />
              </View>
            )}
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* DAY PICKER MODAL */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <Modal
          visible={showDayPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDayPicker(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowDayPicker(false)}
          >
            <View style={styles.dayPickerContent}>
              <Text style={styles.dayPickerTitle}>Seleccionar Día</Text>
              <Text style={styles.dayPickerSubtitle}>¿Qué día del mes quieres pagar?</Text>
              
              <ScrollView 
                style={styles.dayPickerList}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.dayPickerGrid}>
                  {[1, 5, 10, 15, 20, 25, 28].map((day) => (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.dayPickerItem,
                        autopayDay === day && styles.dayPickerItemSelected
                      ]}
                      onPress={async () => {
                        setAutopayDay(day);
                        setShowDayPicker(false);
                        if (autopayEnabled) {
                          await handleSaveAutopay(true, selectedPaymentMethod || undefined, day);
                        }
                      }}
                    >
                      <Text style={[
                        styles.dayPickerItemText,
                        autopayDay === day && styles.dayPickerItemTextSelected
                      ]}>
                        {day}
                      </Text>
                      {day === 1 && (
                        <Text style={styles.dayPickerItemLabel}>Popular</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <TouchableOpacity
                style={styles.dayPickerClose}
                onPress={() => setShowDayPicker(false)}
              >
                <Text style={styles.dayPickerCloseText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* QUICK STATS ROW */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <View style={styles.quickStatsRow}>
          <View style={styles.quickStatItem}>
            <Ionicons name="checkmark-circle" size={20} color={C.success} />
            <Text style={styles.quickStatValue}>{payments.filter(p => p.status === 'completed').length}</Text>
            <Text style={styles.quickStatLabel}>{t('payments.completed')}</Text>
          </View>
          <View style={styles.quickStatDivider} />
          <View style={styles.quickStatItem}>
            <Ionicons name="time" size={20} color={C.warning} />
            <Text style={styles.quickStatValue}>{payments.filter(p => p.status === 'pending').length}</Text>
            <Text style={styles.quickStatLabel}>{t('payments.pending')}</Text>
          </View>
          <View style={styles.quickStatDivider} />
          <View style={styles.quickStatItem}>
            <Ionicons name="receipt" size={20} color={C.textMuted} />
            <Text style={styles.quickStatValue}>{payments.length}</Text>
            <Text style={styles.quickStatLabel}>{t('payments.total')}</Text>
          </View>
        </View>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* PAYMENT HISTORY */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <Text style={styles.sectionHeader}>{t('payments.history')}</Text>

        {payments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="receipt-outline" size={48} color={C.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>{t('payments.no_payments')}</Text>
            <Text style={styles.emptyDesc}>{t('payments.no_payments_desc')}</Text>
          </View>
        ) : (
          payments.map((p, idx) => (
            <View key={p._id || idx} style={styles.paymentCard}>
              <LinearGradient
                colors={['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.01)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.paymentCardContent}>
                <View style={styles.paymentIconWrap}>
                  <Ionicons 
                    name={p.status === 'completed' ? 'checkmark-circle' : 'time'} 
                    size={24} 
                    color={p.status === 'completed' ? C.success : C.warning} 
                  />
                </View>
                <View style={styles.paymentInfo}>
                  <Text style={styles.paymentType}>
                    {capitalize(p.payment_type || p.type || 'Renta')}
                  </Text>
                  <Text style={styles.paymentDate}>
                    {formatShortDate(p.payment_date || p.created_at)}
                  </Text>
                </View>
                <View style={styles.paymentAmountWrap}>
                  <Text style={[
                    styles.paymentAmount,
                    p.status === 'completed' && { color: C.success }
                  ]}>
                    {formatCurrency(p.total_paid || p.amount || 0)}
                  </Text>
                  <Badge label={statusLabel(p.status)} variant={statusVariant(p.status)} />
                </View>
              </View>
            </View>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const createStyles = (C: any) => StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: C.background,
  },
  bgGlow1: {
    position: 'absolute',
    top: -80,
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(200, 16, 46, 0.08)',
  },
  bgGlow2: {
    position: 'absolute',
    bottom: 100,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.background,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: C.textPrimary,
    marginBottom: Spacing.lg,
    letterSpacing: -0.5,
  },

  // Chart Card
  chartCard: {
    borderRadius: BorderRadius.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.glassBorder,
    marginBottom: Spacing.md,
  },

  // Next Payment Card
  nextPaymentCard: {
    borderRadius: BorderRadius.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(200, 16, 46, 0.2)',
    marginBottom: Spacing.md,
  },
  nextPaymentContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  nextPaymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  calendarIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(200, 16, 46, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextPaymentLabel: {
    fontSize: 11,
    color: C.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nextPaymentDate: {
    fontSize: 16,
    color: C.textPrimary,
    fontWeight: '700',
    marginTop: 2,
  },
  nextPaymentRight: {},
  nextPaymentAmount: {
    fontSize: 22,
    color: C.brandRed,
    fontWeight: '800',
  },

  // Quick Stats
  quickStatsRow: {
    flexDirection: 'row',
    backgroundColor: C.glass,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    borderColor: C.glassBorder,
    paddingVertical: 16,
    marginBottom: Spacing.lg,
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  quickStatValue: {
    fontSize: 20,
    fontWeight: '800',
    color: C.textPrimary,
  },
  quickStatLabel: {
    fontSize: 10,
    color: C.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickStatDivider: {
    width: 1,
    height: '60%',
    backgroundColor: C.glassLight,
    alignSelf: 'center',
  },

  // Pay Button
  payRentBtn: {
    borderRadius: BorderRadius.card,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
    ...Shadows.card,
  },
  payRentBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  payRentIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  payRentBtnText: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: C.white,
  },

  // Section Header
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: C.glass,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.textPrimary,
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 14,
    color: C.textMuted,
    textAlign: 'center',
  },

  // Payment Card
  paymentCard: {
    borderRadius: BorderRadius.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.glassBorder,
    marginBottom: 10,
  },
  paymentCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
  },
  paymentIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.glass,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentType: {
    fontSize: 15,
    fontWeight: '600',
    color: C.textPrimary,
  },
  paymentDate: {
    fontSize: 12,
    color: C.textMuted,
    marginTop: 2,
  },
  paymentAmountWrap: {
    alignItems: 'flex-end',
    gap: 4,
  },
  paymentAmount: {
    fontSize: 17,
    fontWeight: '700',
    color: C.textPrimary,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTOPAY STYLES
  // ═══════════════════════════════════════════════════════════════════════════
  autopayCard: {
    borderRadius: BorderRadius.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.glassBorder,
    marginBottom: Spacing.lg,
    position: 'relative',
  },
  autopayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  autopayHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  autopayIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.glassLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  autopayIconWrapActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  autopayTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.textPrimary,
  },
  autopaySubtitle: {
    fontSize: 12,
    color: C.textMuted,
    marginTop: 2,
  },
  autopayDetails: {
    borderTopWidth: 1,
    borderTopColor: C.glassBorder,
  },
  autopayDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: C.glassBorder,
  },
  autopayDetailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  autopayDetailLabel: {
    fontSize: 14,
    color: C.textSecondary,
  },
  autopayDetailRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  autopayDetailValue: {
    fontSize: 14,
    color: C.textPrimary,
    fontWeight: '500',
  },
  autopayInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.md,
    paddingTop: 0,
  },
  autopayInfoText: {
    fontSize: 12,
    color: C.textMuted,
    flex: 1,
  },
  autopayLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.card,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DAY PICKER MODAL
  // ═══════════════════════════════════════════════════════════════════════════
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  dayPickerContent: {
    backgroundColor: '#1A1A1E',
    borderRadius: BorderRadius.card,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  dayPickerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: C.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  dayPickerSubtitle: {
    fontSize: 14,
    color: C.textMuted,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  dayPickerList: {
    maxHeight: 200,
  },
  dayPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  dayPickerItem: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: C.glass,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  dayPickerItemSelected: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: C.success,
  },
  dayPickerItemText: {
    fontSize: 20,
    fontWeight: '700',
    color: C.textPrimary,
  },
  dayPickerItemTextSelected: {
    color: C.success,
  },
  dayPickerItemLabel: {
    fontSize: 9,
    color: C.textMuted,
    marginTop: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  dayPickerClose: {
    marginTop: Spacing.lg,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    backgroundColor: C.glassLight,
    alignItems: 'center',
  },
  dayPickerCloseText: {
    fontSize: 15,
    fontWeight: '600',
    color: C.textMuted,
  },
});
