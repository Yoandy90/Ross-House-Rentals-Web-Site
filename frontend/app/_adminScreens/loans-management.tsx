import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import AdminHeader from '../../components/admin/AdminHeader';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

type TabType = 'applications' | 'products' | 'dashboard' | 'payments';

interface LoanApplication {
  id: string;
  user_id: string;
  product_id: string;
  amount: number;
  term_count: number;
  status: string;
  contacts: {
    phone: string;
    email: string;
    language: string;
  };
  financials: {
    income_monthly: number;
    expenses_monthly: number;
    employment_status: string;
    employer_name?: string;
  };
  dti: number;
  submitted_at: string;
  decision_at?: string;
  decision_by?: string;
  decision_notes?: string;
}

interface LoanProduct {
  id: string;
  name: string;
  description: string;
  min_amount: number;
  max_amount: number;
  interest_rate: number;
  is_active: boolean;
  terms_available: number[];
}

export default function LoansManagementScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [activeTab, setActiveTab] = useState<TabType>('applications');
  const [loading, setLoading] = useState(false);
  
  // Applications state
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedApplication, setSelectedApplication] = useState<LoanApplication | null>(null);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [decisionNotes, setDecisionNotes] = useState('');
  
  // Products state
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<LoanProduct | null>(null);
  
  // Dashboard state
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    totalAmount: 0,
  });

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'applications') {
        await loadApplications();
      } else if (activeTab === 'products') {
        await loadProducts();
      } else if (activeTab === 'dashboard') {
        await loadDashboard();
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'No se pudo cargar la información');
    } finally {
      setLoading(false);
    }
  };

  const loadApplications = async () => {
    try {
      const response = await api.get('/admin/loan-applications');
      console.log('📊 Loan applications loaded:', response.data.length, 'total');
      
      // Count by status
      const statusCounts = response.data.reduce((acc: any, app: LoanApplication) => {
        acc[app.status] = (acc[app.status] || 0) + 1;
        return acc;
      }, {});
      console.log('📊 Status counts:', statusCounts);
      
      setApplications(response.data);
    } catch (error) {
      console.error('Error loading applications:', error);
    }
  };

  const loadProducts = async () => {
    try {
      const response = await api.get('/loan-products?active_only=false');
      setProducts(response.data);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadDashboard = async () => {
    try {
      const response = await api.get('/admin/loan-applications');
      const apps = response.data;
      
      setStats({
        total: apps.length,
        pending: apps.filter((a: LoanApplication) => a.status === 'submitted').length,
        approved: apps.filter((a: LoanApplication) => a.status === 'approved').length,
        rejected: apps.filter((a: LoanApplication) => a.status === 'rejected').length,
        totalAmount: apps
          .filter((a: LoanApplication) => a.status === 'approved')
          .reduce((sum: number, a: LoanApplication) => sum + a.amount, 0),
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  };

  const handleDecision = async (decision: 'approve' | 'reject') => {
    if (!selectedApplication) return;

    try {
      setLoading(true);
      await api.post(`/admin/loan-applications/${selectedApplication.id}/review`, {
        decision,
        notes: decisionNotes,
      });

      Alert.alert('Éxito', `Solicitud ${decision === 'approve' ? 'aprobada' : 'rechazada'} correctamente`);
      setShowDecisionModal(false);
      setSelectedApplication(null);
      setDecisionNotes('');
      loadApplications();
    } catch (error: any) {
      console.error('Error making decision:', error);
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo procesar la decisión');
    } finally {
      setLoading(false);
    }
  };

  const toggleProductStatus = async (productId: string, isActive: boolean) => {
    try {
      setLoading(true);
      await api.patch(`/loan-products/${productId}`, { is_active: !isActive });
      Alert.alert('Éxito', `Producto ${!isActive ? 'activado' : 'desactivado'} correctamente`);
      loadProducts();
    } catch (error) {
      console.error('Error toggling product:', error);
      Alert.alert('Error', 'No se pudo actualizar el producto');
    } finally {
      setLoading(false);
    }
  };

  const filteredApplications = applications.filter((app) => {
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    const matchesSearch =
      searchQuery === '' ||
      app.contacts.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.contacts.phone.includes(searchQuery) ||
      app.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesStatus && matchesSearch;
  });

  const renderApplications = () => (
    <View style={styles.tabContent}>
      {/* Filters */}
      <View style={styles.filtersContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('admin.searchLoansPlaceholder', 'Buscar por email, teléfono o ID...')}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={colors.textGray}
        />
        
        <View style={styles.statusFilters}>
          {[
            { value: 'all', label: 'Todas' },
            { value: 'submitted', label: 'Pendientes' },
            { value: 'approved', label: 'Aprobadas' },
            { value: 'rejected', label: 'Rechazadas' }
          ].map((filter) => (
            <TouchableOpacity
              key={filter.value}
              style={[
                styles.filterButton,
                statusFilter === filter.value && styles.filterButtonActive,
              ]}
              onPress={() => setStatusFilter(filter.value)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  statusFilter === filter.value && styles.filterButtonTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Applications List */}
      <ScrollView style={styles.listContainer}>
        {filteredApplications.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color={colors.textGray} />
            <Text style={styles.emptyText}>No hay solicitudes</Text>
            <Text style={styles.emptySubtext}>
              {statusFilter !== 'all' ? `Prueba con otro filtro` : ''}
            </Text>
          </View>
        ) : (
          filteredApplications.map((app) => {
            // Calculate additional metrics
            const monthlyDisposable = app.financials.income_monthly - app.financials.expenses_monthly;
            const dtiPercentage = (app.dti * 100).toFixed(1);
            const riskLevel = app.dti > 0.5 ? 'high' : app.dti > 0.35 ? 'medium' : 'low';
            
            return (
            <View key={app.id} style={styles.applicationCard}>
              {/* Header with Amount and Status */}
              <View style={styles.applicationHeader}>
                <View style={styles.headerLeft}>
                  <Text style={styles.applicationAmount}>${app.amount.toLocaleString()}</Text>
                  <Text style={styles.applicationId}>ID: {app.id.substring(0, 8)}...</Text>
                </View>
                <View style={[
                  styles.statusBadge,
                  app.status === 'approved' && styles.statusApproved,
                  app.status === 'rejected' && styles.statusRejected,
                  app.status === 'submitted' && styles.statusPending,
                ]}>
                  <Ionicons 
                    name={
                      app.status === 'approved' ? 'checkmark-circle' : 
                      app.status === 'rejected' ? 'close-circle' : 
                      'time'
                    } 
                    size={16} 
                    color={
                      app.status === 'approved' ? '#065F46' : 
                      app.status === 'rejected' ? '#991B1B' : 
                      '#92400E'
                    } 
                  />
                  <Text style={styles.statusText}>
                    {app.status === 'submitted' ? 'Pendiente' : app.status === 'approved' ? 'Aprobado' : 'Rechazado'}
                  </Text>
                </View>
              </View>

              {/* Contact Information */}
              <View style={styles.contactSection}>
                <View style={styles.contactRow}>
                  <Ionicons name="mail" size={16} color={colors.primary} />
                  <Text style={styles.contactText}>{app.contacts.email}</Text>
                </View>
                <View style={styles.contactRow}>
                  <Ionicons name="call" size={16} color={colors.primary} />
                  <Text style={styles.contactText}>{app.contacts.phone}</Text>
                </View>
                <View style={styles.contactRow}>
                  <Ionicons name="language" size={16} color={colors.primary} />
                  <Text style={styles.contactText}>{app.contacts.language === 'es' ? 'Español' : 'English'}</Text>
                </View>
              </View>

              {/* Loan Details */}
              <View style={styles.detailsSection}>
                <Text style={styles.sectionTitle}>Detalles del Préstamo</Text>
                <View style={styles.detailsGrid}>
                  <View style={styles.detailItem}>
                    <Ionicons name="calendar-outline" size={18} color="#3B82F6" />
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Plazo</Text>
                      <Text style={styles.detailValue}>{app.term_count} meses</Text>
                    </View>
                  </View>
                  <View style={styles.detailItem}>
                    <Ionicons name="calendar-clear-outline" size={18} color="#8B5CF6" />
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Fecha</Text>
                      <Text style={styles.detailValue}>
                        {new Date(app.submitted_at).toLocaleDateString('es-ES')}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Financial Information */}
              <View style={styles.financialSection}>
                <Text style={styles.sectionTitle}>Información Financiera</Text>
                
                <View style={styles.financialRow}>
                  <View style={styles.financialItem}>
                    <View style={styles.financialIconContainer} style={{backgroundColor: '#DCFCE7'}}>
                      <Ionicons name="trending-up" size={20} color="#16A34A" />
                    </View>
                    <View style={styles.financialInfo}>
                      <Text style={styles.financialLabel}>Ingresos Mensuales</Text>
                      <Text style={styles.financialAmount}>${app.financials.income_monthly.toLocaleString()}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.financialItem}>
                    <View style={styles.financialIconContainer} style={{backgroundColor: '#FEE2E2'}}>
                      <Ionicons name="trending-down" size={20} color="#DC2626" />
                    </View>
                    <View style={styles.financialInfo}>
                      <Text style={styles.financialLabel}>Gastos Mensuales</Text>
                      <Text style={styles.financialAmount}>${app.financials.expenses_monthly.toLocaleString()}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.financialRow}>
                  <View style={styles.financialItem}>
                    <View style={styles.financialIconContainer} style={{backgroundColor: '#E0E7FF'}}>
                      <Ionicons name="wallet" size={20} color="#4F46E5" />
                    </View>
                    <View style={styles.financialInfo}>
                      <Text style={styles.financialLabel}>Disponible Mensual</Text>
                      <Text style={[styles.financialAmount, monthlyDisposable < 0 && {color: '#DC2626'}]}>
                        ${monthlyDisposable.toLocaleString()}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.financialItem}>
                    <View style={styles.financialIconContainer} style={{backgroundColor: '#FEF3C7'}}>
                      <Ionicons name="briefcase" size={20} color="#CA8A04" />
                    </View>
                    <View style={styles.financialInfo}>
                      <Text style={styles.financialLabel}>Empleo</Text>
                      <Text style={styles.financialValue}>
                        {app.financials.employment_status === 'employed' ? 'Empleado' : 
                         app.financials.employment_status === 'self_employed' ? 'Independiente' : 'Otro'}
                      </Text>
                    </View>
                  </View>
                </View>

                {app.financials.employer_name && (
                  <View style={styles.employerInfo}>
                    <Ionicons name="business" size={16} color={colors.textGray} />
                    <Text style={styles.employerText}>{app.financials.employer_name}</Text>
                    {app.financials.employment_years && (
                      <Text style={styles.employerYears}>
                        ({app.financials.employment_years} {app.financials.employment_years === 1 ? 'año' : 'años'})
                      </Text>
                    )}
                  </View>
                )}
              </View>

              {/* Risk Assessment */}
              <View style={[
                styles.riskSection,
                riskLevel === 'high' && styles.riskHigh,
                riskLevel === 'medium' && styles.riskMedium,
                riskLevel === 'low' && styles.riskLow,
              ]}>
                <View style={styles.riskHeader}>
                  <Ionicons 
                    name={riskLevel === 'low' ? 'shield-checkmark' : riskLevel === 'medium' ? 'alert' : 'warning'} 
                    size={20} 
                    color={riskLevel === 'low' ? '#16A34A' : riskLevel === 'medium' ? '#CA8A04' : '#DC2626'} 
                  />
                  <Text style={styles.riskTitle}>
                    Análisis de Riesgo: {riskLevel === 'low' ? 'Bajo' : riskLevel === 'medium' ? 'Medio' : 'Alto'}
                  </Text>
                </View>
                <View style={styles.dtiContainer}>
                  <Text style={styles.dtiLabel}>Relación Deuda-Ingreso (DTI):</Text>
                  <Text style={[
                    styles.dtiValue,
                    riskLevel === 'high' && {color: '#DC2626'},
                    riskLevel === 'medium' && {color: '#CA8A04'},
                    riskLevel === 'low' && {color: '#16A34A'},
                  ]}>
                    {dtiPercentage}%
                  </Text>
                </View>
                <View style={styles.dtiBar}>
                  <View 
                    style={[
                      styles.dtiBarFill,
                      {width: `${Math.min(parseFloat(dtiPercentage), 100)}%`},
                      riskLevel === 'high' && {backgroundColor: '#DC2626'},
                      riskLevel === 'medium' && {backgroundColor: '#CA8A04'},
                      riskLevel === 'low' && {backgroundColor: '#16A34A'},
                    ]} 
                  />
                </View>
                <Text style={styles.riskNote}>
                  {riskLevel === 'low' && '✓ Capacidad de pago excelente'}
                  {riskLevel === 'medium' && '⚠ Revisar capacidad de pago cuidadosamente'}
                  {riskLevel === 'high' && '✗ Alto riesgo - Capacidad de pago limitada'}
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.reviewButton]}
                  onPress={() => {
                    console.log('✅ Review button pressed for application:', app.id);
                    setSelectedApplication(app);
                    setDecisionNotes('');
                    setShowDecisionModal(true);
                  }}
                >
                  <Ionicons name="eye" size={22} color="#FFF" />
                  <Text style={styles.actionButtonText}>
                    {app.status === 'submitted' ? '👁️ Revisar y Decidir' : '📋 Ver Detalles'}
                  </Text>
                </TouchableOpacity>
              </View>

              {(app.status === 'approved' || app.status === 'rejected') && app.decision_notes && (
                <View style={styles.notesContainer}>
                  <View style={styles.notesHeader}>
                    <Ionicons name="document-text" size={16} color={colors.textGray} />
                    <Text style={styles.notesLabel}>Notas de decisión:</Text>
                  </View>
                  <Text style={styles.notesText}>{app.decision_notes}</Text>
                  {app.decision_at && (
                    <Text style={styles.notesDate}>
                      {new Date(app.decision_at).toLocaleDateString('es-ES')}
                    </Text>
                  )}
                </View>
              )}
            </View>
          );
          })
        )}
      </ScrollView>
    </View>
  );

  const renderProducts = () => (
    <View style={styles.tabContent}>
      <View style={styles.headerActions}>
        <Text style={styles.sectionTitle}>Productos de Préstamo</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            setEditingProduct(null);
            setShowProductModal(true);
          }}
        >
          <Ionicons name="add-circle" size={24} color={colors.primary} />
          <Text style={styles.addButtonText}>Nuevo Producto</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.listContainer}>
        {products.map((product) => (
          <View key={product.id} style={styles.productCard}>
            <View style={styles.productHeader}>
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.productDescription}>{product.description}</Text>
              </View>
              <View style={[
                styles.productStatusBadge,
                product.is_active ? styles.productActive : styles.productInactive,
              ]}>
                <Text style={styles.productStatusText}>
                  {product.is_active ? 'Activo' : 'Inactivo'}
                </Text>
              </View>
            </View>

            <View style={styles.productDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Monto:</Text>
                <Text style={styles.detailValue}>
                  ${product.min_amount.toLocaleString()} - ${product.max_amount.toLocaleString()}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Tasa de Interés:</Text>
                <Text style={styles.detailValue}>{(product.interest_rate * 100).toFixed(2)}%</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Plazos:</Text>
                <Text style={styles.detailValue}>
                  {product.terms_available && product.terms_available.length > 0
                    ? `${product.terms_available.join(', ')} meses`
                    : 'No especificado'}
                </Text>
              </View>
            </View>

            <View style={styles.productActions}>
              <TouchableOpacity
                style={styles.productActionButton}
                onPress={() => toggleProductStatus(product.id, product.is_active)}
              >
                <Ionicons
                  name={product.is_active ? 'pause-circle-outline' : 'play-circle-outline'}
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.productActionText}>
                  {product.is_active ? 'Desactivar' : 'Activar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );

  const renderDashboard = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Dashboard de Préstamos</Text>
      
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, styles.statCardBlue]}>
          <Ionicons name="document-text" size={32} color="#3B82F6" />
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total Solicitudes</Text>
        </View>

        <View style={[styles.statCard, styles.statCardYellow]}>
          <Ionicons name="time" size={32} color="#F59E0B" />
          <Text style={styles.statNumber}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pendientes</Text>
        </View>

        <View style={[styles.statCard, styles.statCardGreen]}>
          <Ionicons name="checkmark-circle" size={32} color="#10B981" />
          <Text style={styles.statNumber}>{stats.approved}</Text>
          <Text style={styles.statLabel}>Aprobadas</Text>
        </View>

        <View style={[styles.statCard, styles.statCardRed]}>
          <Ionicons name="close-circle" size={32} color="#EF4444" />
          <Text style={styles.statNumber}>{stats.rejected}</Text>
          <Text style={styles.statLabel}>Rechazadas</Text>
        </View>
      </View>

      <View style={styles.amountCard}>
        <Text style={styles.amountLabel}>Monto Total Aprobado</Text>
        <Text style={styles.amountValue}>${stats.totalAmount.toLocaleString()}</Text>
      </View>
    </View>
  );

  const renderPayments = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Gestión de Pagos</Text>
      <View style={styles.comingSoonContainer}>
        <Ionicons name="construct-outline" size={64} color={colors.textGray} />
        <Text style={styles.comingSoonText}>Próximamente</Text>
        <Text style={styles.comingSoonSubtext}>
          La gestión de pagos estará disponible pronto
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <AdminHeader title="Gestión de Préstamos" />
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="cash" size={32} color={colors.primary} />
        <Text style={styles.headerTitle}>Administración de Préstamos</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'dashboard' && styles.tabActive]}
          onPress={() => setActiveTab('dashboard')}
        >
          <Ionicons
            name="stats-chart"
            size={20}
            color={activeTab === 'dashboard' ? colors.primary : colors.textGray}
          />
          <Text style={[styles.tabText, activeTab === 'dashboard' && styles.tabTextActive]}>
            Dashboard
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'applications' && styles.tabActive]}
          onPress={() => setActiveTab('applications')}
        >
          <Ionicons
            name="document-text"
            size={20}
            color={activeTab === 'applications' ? colors.primary : colors.textGray}
          />
          <Text style={[styles.tabText, activeTab === 'applications' && styles.tabTextActive]}>
            Solicitudes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'products' && styles.tabActive]}
          onPress={() => setActiveTab('products')}
        >
          <Ionicons
            name="pricetag"
            size={20}
            color={activeTab === 'products' ? colors.primary : colors.textGray}
          />
          <Text style={[styles.tabText, activeTab === 'products' && styles.tabTextActive]}>
            Productos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'payments' && styles.tabActive]}
          onPress={() => setActiveTab('payments')}
        >
          <Ionicons
            name="card"
            size={20}
            color={activeTab === 'payments' ? colors.primary : colors.textGray}
          />
          <Text style={[styles.tabText, activeTab === 'payments' && styles.tabTextActive]}>
            Pagos
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading && <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />}
      {!loading && activeTab === 'applications' && renderApplications()}
      {!loading && activeTab === 'products' && renderProducts()}
      {!loading && activeTab === 'dashboard' && renderDashboard()}
      {!loading && activeTab === 'payments' && renderPayments()}

      {/* Decision Modal */}
      <Modal
        visible={showDecisionModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDecisionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Revisar Solicitud</Text>
            
            {selectedApplication && (
              <View style={styles.modalDetails}>
                <Text style={styles.modalDetailText}>
                  Monto: ${selectedApplication.amount.toLocaleString()}
                </Text>
                <Text style={styles.modalDetailText}>
                  Plazo: {selectedApplication.term_count} meses
                </Text>
                <Text style={styles.modalDetailText}>
                  DTI: {(selectedApplication.dti * 100).toFixed(2)}%
                </Text>
              </View>
            )}

            <TextInput
              style={styles.notesInput}
              placeholder={t('admin.loanDecisionPlaceholder', 'Notas de decisión (opcional)...')}
              value={decisionNotes}
              onChangeText={setDecisionNotes}
              multiline
              numberOfLines={4}
              placeholderTextColor={colors.textGray}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.rejectButton]}
                onPress={() => handleDecision('reject')}
                disabled={loading}
              >
                <Ionicons name="close-circle" size={20} color="#FFF" />
                <Text style={styles.modalButtonText}>Rechazar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.approveButton]}
                onPress={() => handleDecision('approve')}
                disabled={loading}
              >
                <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                <Text style={styles.modalButtonText}>Aprobar</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowDecisionModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textDark,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textGray,
  },
  tabTextActive: {
    color: colors.primary,
  },
  tabContent: {
    flex: 1,
    padding: 20,
  },
  loader: {
    marginTop: 40,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: 20,
  },
  filtersContainer: {
    marginBottom: 20,
  },
  searchInput: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.textDark,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  statusFilters: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textGray,
  },
  filterButtonTextActive: {
    color: '#FFF',
  },
  listContainer: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textGray,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textGray,
    marginTop: 4,
  },
  applicationCard: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  applicationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flex: 1,
  },
  applicationAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  applicationId: {
    fontSize: 12,
    color: colors.textGray,
    fontFamily: 'monospace',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusApproved: {
    backgroundColor: '#D1FAE5',
  },
  statusRejected: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
  },
  contactSection: {
    marginBottom: 16,
    gap: 8,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  contactText: {
    fontSize: 14,
    color: colors.textDark,
  },
  detailsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  detailItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.backgroundGray,
    padding: 12,
    borderRadius: 8,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: colors.textGray,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
  },
  financialSection: {
    marginBottom: 16,
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
  },
  financialRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  financialItem: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  financialIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  financialInfo: {
    flex: 1,
  },
  financialLabel: {
    fontSize: 11,
    color: colors.textGray,
    marginBottom: 2,
  },
  financialAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textDark,
  },
  financialValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
  },
  employerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  employerText: {
    fontSize: 13,
    color: colors.textDark,
    fontWeight: '600',
  },
  employerYears: {
    fontSize: 13,
    color: colors.textGray,
  },
  riskSection: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  riskLow: {
    backgroundColor: '#F0FDF4',
    borderColor: '#16A34A',
  },
  riskMedium: {
    backgroundColor: '#FFFBEB',
    borderColor: '#CA8A04',
  },
  riskHigh: {
    backgroundColor: '#FEF2F2',
    borderColor: '#DC2626',
  },
  riskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  riskTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textDark,
  },
  dtiContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dtiLabel: {
    fontSize: 13,
    color: colors.textGray,
  },
  dtiValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  dtiBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  dtiBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  riskNote: {
    fontSize: 12,
    color: colors.textGray,
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 2,
    borderTopColor: '#E5E7EB',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  reviewButton: {
    backgroundColor: colors.primary,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notesContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  notesLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textGray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notesText: {
    fontSize: 14,
    color: colors.textDark,
    lineHeight: 20,
  },
  notesDate: {
    fontSize: 12,
    color: colors.textGray,
    marginTop: 8,
    fontStyle: 'italic',
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  productCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: 4,
  },
  productDescription: {
    fontSize: 14,
    color: colors.textGray,
  },
  productStatusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  productActive: {
    backgroundColor: '#D1FAE5',
  },
  productInactive: {
    backgroundColor: '#FEE2E2',
  },
  productStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  productDetails: {
    marginBottom: 16,
  },
  productActions: {
    flexDirection: 'row',
    gap: 12,
  },
  productActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  productActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
  },
  statCardBlue: {
    borderColor: '#3B82F6',
  },
  statCardYellow: {
    borderColor: '#F59E0B',
  },
  statCardGreen: {
    borderColor: '#10B981',
  },
  statCardRed: {
    borderColor: '#EF4444',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textDark,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 14,
    color: colors.textGray,
    marginTop: 4,
    textAlign: 'center',
  },
  amountCard: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  amountValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFF',
  },
  comingSoonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  comingSoonText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textDark,
    marginTop: 16,
  },
  comingSoonSubtext: {
    fontSize: 14,
    color: colors.textGray,
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 500,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalDetails: {
    backgroundColor: colors.backgroundGray,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  modalDetailText: {
    fontSize: 14,
    color: colors.textDark,
    marginBottom: 4,
  },
  notesInput: {
    backgroundColor: colors.backgroundGray,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: colors.textDark,
    marginBottom: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
  },
  rejectButton: {
    backgroundColor: '#EF4444',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textGray,
  },
});