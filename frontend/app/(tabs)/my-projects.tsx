/**
 * Mis Servicios - Client Service Orders View
 * Modern premium futuristic design
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Dimensions,
  FlatList,
  ScrollView,
  Animated,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

const { width } = Dimensions.get('window');

interface Project {
  id: string;
  order_number: string;
  service_type: string;
  description: string;
  tax_year: number;
  status: string;
  priority: string;
  estimated_amount: number;
  notes: string;
  assigned_to_name?: string;
  created_at: string;
  updated_at: string;
  payment_status?: string;
  timeline?: Array<{ status: string; date: string; note?: string }>;
}

interface Stats {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
}

type FilterType = 'all' | 'pending' | 'in_progress' | 'completed';

// ─── Translation Helpers ───────────────────────────────────────────

const getServiceName = (type: string, tr: any): string => {
  const s = (type || '').toLowerCase();
  if (s.includes('tax_preparation') || s.includes('tax preparation'))
    return tr('myProjects.taxPreparation');
  if (s.includes('itin')) return tr('myProjects.itinApplication');
  if (s.includes('llc') || s.includes('business_formation'))
    return tr('myProjects.llcFormation');
  if (s.includes('passport') || s.includes('pasaporte'))
    return tr('myProjects.passportProcessing');
  if (s.includes('translation') || s.includes('traduccion'))
    return tr('myProjects.documentTranslation');
  if (s.includes('notary') || s.includes('notari'))
    return tr('myProjects.notarization');
  if (s.includes('bookkeeping') || s.includes('contab'))
    return tr('myProjects.bookkeeping');
  if (s.includes('consultation') || s.includes('consult'))
    return tr('myProjects.taxConsulting');
  if (type && type.length > 0)
    return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
  return tr('myProjects.service');
};

const getServiceIcon = (type: string): string => {
  const s = (type || '').toLowerCase();
  if (s.includes('tax') || s.includes('impuesto')) return 'receipt-outline';
  if (s.includes('itin')) return 'card-outline';
  if (s.includes('llc') || s.includes('business')) return 'business-outline';
  if (s.includes('passport') || s.includes('pasaporte')) return 'airplane-outline';
  if (s.includes('translation') || s.includes('traduccion')) return 'language-outline';
  if (s.includes('notary') || s.includes('notari')) return 'document-text-outline';
  if (s.includes('bookkeeping') || s.includes('contab')) return 'calculator-outline';
  return 'briefcase-outline';
};

const getServiceColor = (type: string): [string, string] => {
  const s = (type || '').toLowerCase();
  if (s.includes('tax') || s.includes('impuesto')) return ['#1E40AF', '#3B82F6'];
  if (s.includes('itin')) return ['#7C3AED', '#8B5CF6'];
  if (s.includes('llc') || s.includes('business')) return ['#0891B2', '#06B6D4'];
  if (s.includes('passport')) return ['#0D9488', '#14B8A6'];
  if (s.includes('translation')) return ['#D97706', '#F59E0B'];
  if (s.includes('notary')) return ['#4F46E5', '#6366F1'];
  return ['#1E40AF', '#3B82F6'];
};

const getStatusConfig = (status: string, t: any) => {
  switch (status) {
    case 'pending':
    case 'pending_payment':
      return {
        label: t('myProjects.pending'),
        color: '#D97706',
        bg: '#FFFBEB',
        icon: 'time-outline' as const,
        step: 1,
      };
    case 'in_progress':
    case 'processing':
      return {
        label: t('myProjects.inProgress', 'En Curso'),
        color: '#2563EB',
        bg: '#EFF6FF',
        icon: 'sync-outline' as const,
        step: 2,
      };
    case 'review':
    case 'under_review':
      return {
        label: t('myProjects.inReview', 'En Revisión'),
        color: '#7C3AED',
        bg: '#F5F3FF',
        icon: 'eye-outline' as const,
        step: 3,
      };
    case 'completed':
    case 'done':
      return {
        label: t('myProjects.completed'),
        color: '#059669',
        bg: '#ECFDF5',
        icon: 'checkmark-circle-outline' as const,
        step: 4,
      };
    case 'cancelled':
      return {
        label: t('myProjects.cancelled'),
        color: '#DC2626',
        bg: '#FEF2F2',
        icon: 'close-circle-outline' as const,
        step: 0,
      };
    default:
      return {
        label: status ? status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : t('myProjects.pending'),
        color: '#6B7280',
        bg: '#F3F4F6',
        icon: 'help-circle-outline' as const,
        step: 1,
      };
  }
};

const getPaymentConfig = (status: string | undefined, t: any) => {
  switch (status) {
    case 'paid':
      return { label: t('myProjects.paid', 'Pagado'), color: '#059669', bg: '#ECFDF5', icon: 'checkmark-circle' as const };
    case 'partial':
      return { label: t('myProjects.partial', 'Parcial'), color: '#D97706', bg: '#FFFBEB', icon: 'remove-circle' as const };
    default:
      return { label: t('myProjects.pending'), color: '#DC2626', bg: '#FEF2F2', icon: 'alert-circle' as const };
  }
};

const formatOrderNumber = (orderNumber: string): string => {
  if (!orderNumber) return '#---';
  if (orderNumber.length > 16) {
    const parts = orderNumber.split('-');
    if (parts.length >= 2) return `#${parts[0]}-${parts[1]}`;
    return `#${orderNumber.slice(0, 12)}`;
  }
  return `#${orderNumber}`;
};

// ─── Component ───────────────────────────────────────────────────

const MyProjectsScreen = () => {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'es' ? es : enUS;
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, in_progress: 0, completed: 0 });
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [error, setError] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadProjects();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(headerAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    filterProjects();
  }, [projects, activeFilter]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/my-projects');
      const projectsData = response.data.projects || [];
      setProjects(projectsData);

      const newStats: Stats = {
        total: projectsData.length,
        pending: projectsData.filter((p: Project) => p.status === 'pending' || p.status === 'pending_payment').length,
        in_progress: projectsData.filter((p: Project) => p.status === 'in_progress' || p.status === 'processing' || p.status === 'review' || p.status === 'under_review').length,
        completed: projectsData.filter((p: Project) => p.status === 'completed' || p.status === 'done').length,
      };
      const backendStats = response.data.stats;
      setStats(backendStats && backendStats.total > 0 ? backendStats : newStats);
    } catch (err: any) {
      console.error('Error loading projects:', err);
      setError('No se pudieron cargar los servicios');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProjects();
  }, []);

  const filterProjects = () => {
    let filtered = [...projects];
    if (activeFilter === 'pending') {
      filtered = filtered.filter(p => p.status === 'pending' || p.status === 'pending_payment');
    } else if (activeFilter === 'in_progress') {
      filtered = filtered.filter(p => p.status === 'in_progress' || p.status === 'processing' || p.status === 'review' || p.status === 'under_review');
    } else if (activeFilter === 'completed') {
      filtered = filtered.filter(p => p.status === 'completed' || p.status === 'done');
    }
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setFilteredProjects(filtered);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), "d 'de' MMM, yyyy", { locale: dateLocale });
    } catch {
      return dateString;
    }
  };

  // ─── Stat Card ──────────────────────────────────────────────

  const StatCard = ({ value, label, icon, color, isFirst }: { value: number; label: string; icon: string; color: string; isFirst?: boolean }) => (
    <View style={[s.statCard, isFirst && s.statCardFirst]}>
      <View style={[s.statIconWrap, { backgroundColor: color + '30' }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <Text style={s.statNum}>{value}</Text>
      <Text style={s.statLbl}>{label}</Text>
    </View>
  );

  // ─── Progress Steps ─────────────────────────────────────────

  const renderProgressSteps = (currentStep: number) => {
    const steps = [
      { label: t('myProjects.received'), step: 1 },
      { label: t('myProjects.inCourse'), step: 2 },
      { label: t('myProjects.review'), step: 3 },
      { label: t('myProjects.ready'), step: 4 },
    ];
    return (
      <View style={s.stepsRow}>
        {steps.map((st, i) => {
          const active = currentStep >= st.step;
          const isLast = i === steps.length - 1;
          return (
            <React.Fragment key={st.step}>
              <View style={s.stepItem}>
                <View style={[s.stepDot, active && s.stepDotActive]}>
                  {active ? (
                    <Ionicons name="checkmark" size={10} color="#FFF" />
                  ) : (
                    <Text style={s.stepNumber}>{st.step}</Text>
                  )}
                </View>
                <Text style={[s.stepLabel, active && s.stepLabelActive]}>{st.label}</Text>
              </View>
              {!isLast && (
                <View style={s.stepLineWrap}>
                  <View style={s.stepLineBg} />
                  {currentStep > st.step && (
                    <LinearGradient
                      colors={['#1E40AF', '#3B82F6']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={s.stepLineFill}
                    />
                  )}
                </View>
              )}
            </React.Fragment>
          );
        })}
      </View>
    );
  };

  // ─── Card Render ────────────────────────────────────────────

  const renderCard = ({ item, index }: { item: Project; index: number }) => {
    const status = getStatusConfig(item.status, t);
    const payment = getPaymentConfig(item.payment_status, t);
    const svcColors = getServiceColor(item.service_type);

    return (
      <Animated.View style={[s.cardWrap, { 
        opacity: fadeAnim,
        transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }]
      }]}>
        <TouchableOpacity
          style={s.card}
          activeOpacity={0.7}
          onPress={() => {
            setSelectedProject(item);
            setShowDetailModal(true);
          }}
        >
          {/* Top color accent */}
          <LinearGradient
            colors={svcColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.cardAccent}
          />

          {/* Header Row */}
          <View style={s.cardHead}>
            <View style={[s.svcIcon, { backgroundColor: `${svcColors[0]}10` }]}>
              <Ionicons name={getServiceIcon(item.service_type) as any} size={22} color={svcColors[0]} />
            </View>
            <View style={s.cardHeadText}>
              <Text style={s.svcName} numberOfLines={2}>
                {getServiceName(item.service_type, t)}
              </Text>
              <Text style={s.ordNum}>{formatOrderNumber(item.order_number)}</Text>
            </View>
            <View style={[s.statusChip, { backgroundColor: status.bg }]}>
              <View style={[s.statusDot, { backgroundColor: status.color }]} />
              <Text style={[s.statusLabel, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>

          {/* Progress Steps */}
          {renderProgressSteps(status.step)}

          {/* Info Row */}
          <View style={s.infoRow}>
            <View style={s.infoBox}>
              <Text style={s.infoTitle}>{t('myProjects.year')}</Text>
              <Text style={s.infoVal}>{item.tax_year || '—'}</Text>
            </View>
            <View style={[s.infoBox, s.infoBorder]}>
              <Text style={s.infoTitle}>{t('myProjects.amount')}</Text>
              <Text style={[s.infoVal, { color: '#059669' }]}>
                {formatCurrency(item.estimated_amount)}
              </Text>
            </View>
            <View style={s.infoBox}>
              <Text style={s.infoTitle}>{t('myProjects.payment')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={[s.payDot, { backgroundColor: payment.color }]} />
                <Text style={[s.infoVal, { color: payment.color, fontSize: 13 }]}>{payment.label}</Text>
              </View>
            </View>
          </View>

          {/* Footer */}
          <View style={s.cardFoot}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="calendar-outline" size={12} color="#9CA3AF" />
              <Text style={s.dateLabel}>{formatDate(item.created_at)}</Text>
            </View>
            <TouchableOpacity
              style={s.detailBtn}
              onPress={() => {
                setSelectedProject(item);
                setShowDetailModal(true);
              }}
            >
              <Text style={s.detailBtnText}>{t('myProjects.viewDetails')}</Text>
              <Ionicons name="chevron-forward" size={14} color="#1E40AF" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // ─── Filter Data ────────────────────────────────────────────

  const filters: { type: FilterType; label: string; count: number; icon: string; color: string }[] = [
    { type: 'all', label: t('myProjects.all'), count: stats.total, icon: 'grid-outline', color: '#6C1110' },
    { type: 'pending', label: t('myProjects.pendingFilter'), count: stats.pending, icon: 'time-outline', color: '#D97706' },
    { type: 'in_progress', label: t('myProjects.inProgressFilter'), count: stats.in_progress, icon: 'sync-outline', color: '#2563EB' },
    { type: 'completed', label: t('myProjects.completedFilter'), count: stats.completed, icon: 'checkmark-circle-outline', color: '#059669' },
  ];

  // ─── Loading ────────────────────────────────────────────────

  if (loading && !refreshing) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color="#6C1110" />
          <Text style={s.loadingText}>{t('myProjects.loading')}</Text>
        </View>
      </View>
    );
  }

  // ─── Main Render ────────────────────────────────────────────

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      {/* ═══ Modern Header ═══ */}
      <LinearGradient
        colors={['#4A0E0E', '#6C1110', '#8B1A19']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.header, { paddingTop: insets.top + 8 }]}
      >
        {/* Background decoration */}
        <View style={s.headerDecor1} />
        <View style={s.headerDecor2} />

        {/* Top row */}
        <View style={s.headerRow}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color="#FFF" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Animated.Text style={[s.headerTitle, {
              transform: [{ scale: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }]
            }]}>
              {t('myProjects.title')}
            </Animated.Text>
            <Text style={s.headerSubtitle}>
              {stats.total} {i18n.language === 'es' ? 'servicios activos' : 'active services'}
            </Text>
          </View>
          <TouchableOpacity style={s.backBtn} onPress={onRefresh}>
            <Ionicons name="refresh-outline" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Stats Row */}
        <Animated.View style={[s.statsRow, {
          opacity: headerAnim,
          transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }]
        }]}>
          <StatCard value={stats.total} label={t('myProjects.total')} icon="layers-outline" color="#FFFFFF" isFirst />
          <StatCard value={stats.pending} label={t('myProjects.pendingLabel')} icon="time-outline" color="#FCD34D" />
          <StatCard value={stats.in_progress} label={t('myProjects.inProgressLabel')} icon="sync-outline" color="#60A5FA" />
          <StatCard value={stats.completed} label={t('myProjects.readyLabel')} icon="checkmark-circle-outline" color="#34D399" />
        </Animated.View>
      </LinearGradient>

      {/* ═══ Filter Pills ═══ */}
      <View style={s.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterRow}
          bounces={false}
          overScrollMode="never"
        >
          {filters.map((f) => {
            const active = activeFilter === f.type;
            return (
              <TouchableOpacity
                key={f.type}
                style={[s.filterPill, active && [s.filterPillActive, { borderColor: f.color }]]}
                onPress={() => setActiveFilter(f.type)}
                activeOpacity={0.7}
              >
                {active ? (
                  <LinearGradient
                    colors={[f.color, f.color + 'DD']}
                    style={StyleSheet.absoluteFillObject}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                ) : null}
                <Ionicons
                  name={f.icon as any}
                  size={14}
                  color={active ? '#FFF' : '#6B7280'}
                  style={{ zIndex: 1 }}
                />
                <Text style={[s.filterText, active && s.filterTextActive]}>{f.label}</Text>
                <View style={[s.filterBadge, active && s.filterBadgeActive]}>
                  <Text style={[s.filterBadgeNum, active && { color: f.color }]}>{f.count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ═══ List ═══ */}
      <FlatList
        data={filteredProjects}
        renderItem={renderCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C1110" />}
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <View style={s.emptyCircle}>
              <Ionicons name={activeFilter === 'all' ? 'folder-open-outline' : 'search-outline'} size={40} color="#6C1110" />
            </View>
            <Text style={s.emptyTitle}>
              {error 
                ? t('myProjects.errorLoading') 
                : activeFilter === 'all' 
                  ? t('myProjects.noServices') 
                  : t('myProjects.noFilterResults', `No hay servicios "${filters.find(f => f.type === activeFilter)?.label || ''}"`)
              }
            </Text>
            <Text style={s.emptyMsg}>
              {error || (activeFilter === 'all' 
                ? t('myProjects.noServicesDesc')
                : t('myProjects.tryOtherFilter', 'Prueba con otro filtro o selecciona "Todos"'))
              }
            </Text>
            {activeFilter !== 'all' && !error && (
              <TouchableOpacity style={s.retryBtn} onPress={() => setActiveFilter('all')}>
                <Ionicons name="grid-outline" size={16} color="#FFF" />
                <Text style={s.retryText}>{t('myProjects.showAll', 'Ver Todos')}</Text>
              </TouchableOpacity>
            )}
            {error && (
              <TouchableOpacity style={s.retryBtn} onPress={onRefresh}>
                <Ionicons name="refresh" size={16} color="#FFF" />
                <Text style={s.retryText}>{t('myProjects.retry')}</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* ═══ Detail Modal ═══ */}
      <Modal visible={showDetailModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            {selectedProject && (() => {
              const st = getStatusConfig(selectedProject.status, t);
              const py = getPaymentConfig(selectedProject.payment_status, t);
              const svcCol = getServiceColor(selectedProject.service_type);
              return (
                <>
                  <LinearGradient colors={svcCol} style={s.modalHead}>
                    <View style={s.modalDragBar} />
                    <View style={s.modalHeadRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.modalSvcName}>
                          {getServiceName(selectedProject.service_type, t)}
                        </Text>
                        <Text style={s.modalOrdNum}>{formatOrderNumber(selectedProject.order_number)}</Text>
                      </View>
                      <TouchableOpacity style={s.modalClose} onPress={() => setShowDetailModal(false)}>
                        <Ionicons name="close" size={18} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                    <View style={s.modalSteps}>
                      {renderProgressSteps(st.step)}
                    </View>
                  </LinearGradient>

                  <ScrollView style={s.modalBody} bounces={false}>
                    {/* Status */}
                    <View style={s.mSection}>
                      <Text style={s.mLabel}>{t('myProjects.status')}</Text>
                      <View style={[s.mStatusBadge, { backgroundColor: st.bg }]}>
                        <Ionicons name={st.icon} size={18} color={st.color} />
                        <Text style={[s.mStatusText, { color: st.color }]}>{st.label}</Text>
                      </View>
                    </View>

                    {/* Grid: Year + Amount */}
                    <View style={s.mGrid}>
                      <View style={s.mGridItem}>
                        <Text style={s.mLabel}>{t('myProjects.taxYear')}</Text>
                        <Text style={s.mVal}>{selectedProject.tax_year || '—'}</Text>
                      </View>
                      <View style={s.mGridItem}>
                        <Text style={s.mLabel}>{t('myProjects.amount')}</Text>
                        <Text style={[s.mVal, { color: '#059669' }]}>
                          {formatCurrency(selectedProject.estimated_amount)}
                        </Text>
                      </View>
                    </View>

                    {/* Payment */}
                    <View style={s.mSection}>
                      <Text style={s.mLabel}>{t('myProjects.paymentStatus')}</Text>
                      <View style={[s.mStatusBadge, { backgroundColor: py.bg }]}>
                        <Ionicons name={py.icon} size={18} color={py.color} />
                        <Text style={[s.mStatusText, { color: py.color }]}>{py.label}</Text>
                      </View>
                    </View>

                    {/* Service Type */}
                    <View style={s.mSection}>
                      <Text style={s.mLabel}>{t('myProjects.serviceType')}</Text>
                      <Text style={s.mText}>{getServiceName(selectedProject.service_type, t)}</Text>
                    </View>

                    {/* Assigned agent */}
                    {selectedProject.assigned_to_name && (
                      <View style={s.mSection}>
                        <Text style={s.mLabel}>{t('myProjects.assignedTo')}</Text>
                        <View style={s.agentRow}>
                          <View style={s.agentAvatar}>
                            <Ionicons name="person" size={18} color="#6366F1" />
                          </View>
                          <Text style={s.agentName}>{selectedProject.assigned_to_name}</Text>
                        </View>
                      </View>
                    )}

                    {/* Notes */}
                    {selectedProject.notes ? (
                      <View style={s.mSection}>
                        <Text style={s.mLabel}>{t('myProjects.notes')}</Text>
                        <View style={s.notesCard}>
                          <Ionicons name="chatbubble-outline" size={16} color="#1E40AF" />
                          <Text style={s.mText}>{selectedProject.notes}</Text>
                        </View>
                      </View>
                    ) : null}

                    {/* Dates */}
                    <View style={[s.mSection, s.dateCard]}>
                      <Text style={s.mLabel}>{t('myProjects.dates')}</Text>
                      <View style={s.dateItem}>
                        <Ionicons name="calendar-outline" size={16} color="#6B7280" />
                        <Text style={s.dateText}>{t('myProjects.created')}: {formatDate(selectedProject.created_at)}</Text>
                      </View>
                      <View style={s.dateItem}>
                        <Ionicons name="time-outline" size={16} color="#6B7280" />
                        <Text style={s.dateText}>{t('myProjects.updated')}: {formatDate(selectedProject.updated_at)}</Text>
                      </View>
                    </View>

                    {/* Pay Button */}
                    {(selectedProject.payment_status !== 'paid' && selectedProject.estimated_amount > 0) && (
                      <TouchableOpacity
                        style={s.payBtn}
                        onPress={() => {
                          setShowDetailModal(false);
                          router.push({
                            pathname: '/(tabs)/order-payment',
                            params: {
                              orderId: selectedProject.id,
                              orderNumber: selectedProject.order_number,
                              serviceType: selectedProject.service_type,
                              amount: selectedProject.estimated_amount.toString(),
                            },
                          });
                        }}
                      >
                        <LinearGradient colors={['#059669', '#10B981']} style={s.payBtnInner}>
                          <Ionicons name="card-outline" size={20} color="#FFF" />
                          <Text style={s.payBtnText}>{t('myProjects.payNow')}</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}

                    {/* Close button */}
                    <TouchableOpacity
                      style={s.closeSheetBtn}
                      onPress={() => setShowDetailModal(false)}
                    >
                      <Text style={s.closeSheetText}>{t('myProjects.close')}</Text>
                    </TouchableOpacity>

                    <View style={{ height: 40 }} />
                  </ScrollView>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  loadingWrap: {
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },

  // Header
  header: {
    paddingBottom: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  headerDecor1: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerDecor2: {
    position: 'absolute',
    bottom: -20,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 2,
    fontWeight: '500',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 6,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statCardFirst: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  statIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statNum: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -0.5,
  },
  statLbl: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },

  // Filters
  filterContainer: {
    backgroundColor: '#F1F5F9',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  filterRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingRight: 32,
    gap: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#FFF',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
      android: { elevation: 1 },
    }),
  },
  filterPillActive: {
    borderWidth: 0,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6 },
      android: { elevation: 4 },
    }),
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    zIndex: 1,
  },
  filterTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  filterBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 22,
    alignItems: 'center',
    zIndex: 1,
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  filterBadgeNum: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },

  // List
  list: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 100,
  },

  // Card
  cardWrap: {
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#1E293B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12 },
      android: { elevation: 3 },
    }),
  },
  cardAccent: {
    height: 3,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    paddingBottom: 8,
  },
  svcIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  cardHeadText: {
    flex: 1,
  },
  svcName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  ordNum: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '500',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Progress Steps
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  stepItem: {
    alignItems: 'center',
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepDotActive: {
    backgroundColor: '#1E40AF',
  },
  stepNumber: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
  },
  stepLabel: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '600',
  },
  stepLabelActive: {
    color: '#1E40AF',
    fontWeight: '700',
  },
  stepLineWrap: {
    flex: 1,
    height: 3,
    marginHorizontal: 4,
    marginBottom: 16,
    borderRadius: 2,
    overflow: 'hidden',
  },
  stepLineBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
  },
  stepLineFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 2,
  },

  // Info Row
  infoRow: {
    flexDirection: 'row',
    marginHorizontal: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  infoBox: {
    flex: 1,
    alignItems: 'center',
  },
  infoBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoTitle: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  payDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Footer
  cardFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 4,
  },
  dateLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  detailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  detailBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E40AF',
  },

  // Empty
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyMsg: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#6C1110',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  retryText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalHead: {
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  modalDragBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.4)',
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalHeadRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  modalSvcName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
  },
  modalOrdNum: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  modalClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  modalSteps: {
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    padding: 8,
  },
  modalBody: {
    padding: 20,
  },

  // Modal Sections
  mSection: {
    marginBottom: 20,
  },
  mLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  mVal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  mText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 21,
    flex: 1,
  },
  mStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    gap: 8,
    alignSelf: 'flex-start',
  },
  mStatusText: {
    fontSize: 14,
    fontWeight: '700',
  },
  mGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  mGridItem: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },

  // Pay button
  payBtn: {
    marginTop: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  payBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  payBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },

  // Close sheet
  closeSheetBtn: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  closeSheetText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },

  // Agent
  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  agentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  agentName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },

  // Notes
  notesCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#EFF6FF',
    padding: 14,
    borderRadius: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#1E40AF',
  },

  // Dates
  dateCard: {
    gap: 8,
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: 14,
    color: '#64748B',
  },
});

export default MyProjectsScreen;
