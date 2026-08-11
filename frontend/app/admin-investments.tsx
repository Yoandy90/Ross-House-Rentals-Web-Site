import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Modal,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { apiCall } from '../src/utils/api';
import { useColors, Spacing, FontSizes, BorderRadius, Gradients } from '../src/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  evidence_url?: string;
}

interface Investment {
  id: string;
  _id?: string;
  address: string;
  city: string;
  state: string;
  zip_code?: string;
  purchase_price: number;
  current_value: number;
  estimated_sale_price?: number;
  total_invested: number;
  total_expenses: number;
  potential_profit: number;
  profit_margin: number;
  phase: string;
  status: string;
  expenses: Expense[];
  notes: string;
  rental_income?: number;
  sale_price?: number;
  created_at: string;
}

interface Dashboard {
  phases: Record<string, number>;
  total_invested: number;
  total_potential_value: number;
  total_potential_profit: number;
  avg_profit_margin: number;
  total_expenses: number;
}

const PHASE_CONFIG: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  acquisition: { label: 'Adquisición', icon: 'cart-outline', color: '#3B82F6' },
  adquirida: { label: 'Adquirida', icon: 'cart-outline', color: '#3B82F6' },
  repair: { label: 'Reparación', icon: 'hammer-outline', color: '#F59E0B' },
  en_remodelacion: { label: 'Remodelación', icon: 'hammer-outline', color: '#F59E0B' },
  reparacion: { label: 'Reparación', icon: 'hammer-outline', color: '#F59E0B' },
  listed: { label: 'En Venta', icon: 'pricetag-outline', color: '#8B5CF6' },
  en_venta: { label: 'En Venta', icon: 'pricetag-outline', color: '#8B5CF6' },
  rented: { label: 'Rentada', icon: 'home-outline', color: '#10B981' },
  rentada: { label: 'Rentada', icon: 'home-outline', color: '#10B981' },
  sold: { label: 'Vendida', icon: 'checkmark-circle-outline', color: '#EC4899' },
  vendida: { label: 'Vendida', icon: 'checkmark-circle-outline', color: '#EC4899' },
};

const EXPENSE_CATEGORIES = [
  { key: 'material', label: 'Materiales', icon: 'cube-outline' as const, color: '#3B82F6' },
  { key: 'labor', label: 'Mano de Obra', icon: 'people-outline' as const, color: '#F59E0B' },
  { key: 'permit', label: 'Permisos', icon: 'document-outline' as const, color: '#8B5CF6' },
  { key: 'utility', label: 'Servicios', icon: 'flash-outline' as const, color: '#10B981' },
  { key: 'repair', label: 'Reparación', icon: 'hammer-outline' as const, color: '#EF4444' },
  { key: 'other', label: 'Otro', icon: 'ellipsis-horizontal' as const, color: '#6B7280' },
];

// ─── Circular Chart Component ─────────────────────
interface CircularChartProps {
  value: number;
  maxValue: number;
  size?: number;
  strokeWidth?: number;
  gradientColors: string[];
  centerLabel: string;
  centerValue: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
}

function CircularChart({
  value,
  maxValue,
  size = 140,
  strokeWidth = 12,
  gradientColors,
  centerLabel,
  centerValue,
  icon,
  iconColor = '#fff',
}: CircularChartProps) {
  const Colors = useColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const center = size / 2;

  return (
    <View style={[styles.chartContainer, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgGradient id={`gradient-${centerLabel}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={gradientColors[0]} />
            <Stop offset="100%" stopColor={gradientColors[1]} />
          </SvgGradient>
        </Defs>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={`url(#gradient-${centerLabel})`}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          rotation="-90"
          origin={`${center}, ${center}`}
        />
      </Svg>
      <View style={[styles.chartCenter, { width: size, height: size }]}>
        {icon && <Ionicons name={icon} size={20} color={iconColor} style={{ marginBottom: 2 }} />}
        <Text style={styles.chartPercentage}>{Math.round(percentage)}%</Text>
        <Text style={styles.chartLabel}>{centerLabel}</Text>
        <Text style={[styles.chartValue, { color: gradientColors[0] }]}>{centerValue}</Text>
      </View>
    </View>
  );
}

// ─── Mini Card Component ─────────────────────────────────────
interface MiniCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  value: string | number;
  label: string;
}

function MiniCard({ icon, iconBg, iconColor, value, label }: MiniCardProps) {
  const Colors = useColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  return (
    <View style={styles.miniCard}>
      <View style={[styles.miniIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.miniContent}>
        <Text style={styles.miniValue}>{value}</Text>
        <Text style={styles.miniLabel}>{label}</Text>
      </View>
    </View>
  );
}

export default function AdminInvestmentsScreen() {
  const Colors = useColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'properties' | 'analytics'>('overview');
  const [generatingPdf, setGeneratingPdf] = useState(false);
  
  const [expenseForm, setExpenseForm] = useState({
    description: '',
    amount: '',
    category: 'repair',
  });

  const [propertyForm, setPropertyForm] = useState({
    address: '',
    city: '',
    state: 'TX',
    zip_code: '',
    purchase_price: '',
    estimated_sale_price: '',
    phase: 'adquirida',
    notes: '',
  });

  const fetchInvestments = useCallback(async () => {
    try {
      const [invRes, dashRes] = await Promise.all([
        apiCall('/admin/investments'),
        apiCall('/admin/investments/dashboard'),
      ]);
      const invList = invRes.investments || [];
      setInvestments(invList.map((inv: any) => ({
        ...inv,
        id: inv._id || inv.id,
        total_invested: (inv.purchase_price || 0) + (inv.total_expenses || 0),
        current_value: inv.estimated_sale_price || inv.current_value || inv.purchase_price || 0,
        total_expenses: inv.expenses?.reduce((sum: number, e: any) => sum + (e.amount || 0), 0) || 0,
      })));
      
      const dashboardData = dashRes.dashboard || dashRes.stats || {};
      const phases = dashRes.dashboard?.phases || dashRes.pipeline || {};
      
      setDashboard({
        phases,
        total_invested: dashboardData.total_invested || invList.reduce((sum: number, inv: any) => sum + (inv.purchase_price || 0), 0),
        total_potential_value: dashboardData.total_potential_value || invList.reduce((sum: number, inv: any) => sum + (inv.estimated_sale_price || inv.purchase_price || 0), 0),
        total_potential_profit: dashboardData.total_potential_profit || 0,
        avg_profit_margin: dashboardData.avg_profit_margin || dashboardData.avg_roi || 0,
        total_expenses: dashboardData.total_expenses || invList.reduce((sum: number, inv: any) => 
          sum + (inv.expenses?.reduce((s: number, e: any) => s + (e.amount || 0), 0) || 0), 0),
      });
    } catch (err) {
      console.log('Error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchInvestments(); }, []);
  const onRefresh = () => { setRefreshing(true); fetchInvestments(); };

  const fmtCurrency = (n: number) => {
    if (isNaN(n) || n === null || n === undefined) return '$0';
    return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const getPhaseConfig = (phase: string) => PHASE_CONFIG[phase] || PHASE_CONFIG.adquirida;

  // ─── CRUD Functions ─────────────────────────────────────
  const resetPropertyForm = () => {
    setPropertyForm({
      address: '',
      city: '',
      state: 'TX',
      zip_code: '',
      purchase_price: '',
      estimated_sale_price: '',
      phase: 'adquirida',
      notes: '',
    });
    setEditingInvestment(null);
  };

  const openCreateModal = () => {
    resetPropertyForm();
    setShowCreateModal(true);
  };

  const openEditModal = (inv: Investment) => {
    setPropertyForm({
      address: inv.address || '',
      city: inv.city || '',
      state: inv.state || 'TX',
      zip_code: inv.zip_code || '',
      purchase_price: String(inv.purchase_price || ''),
      estimated_sale_price: String(inv.estimated_sale_price || inv.current_value || ''),
      phase: inv.phase || 'adquirida',
      notes: inv.notes || '',
    });
    setEditingInvestment(inv);
    setShowCreateModal(true);
  };

  const saveProperty = async () => {
    if (!propertyForm.address || !propertyForm.purchase_price) {
      Alert.alert('Error', 'Dirección y precio de compra son requeridos');
      return;
    }

    try {
      const payload = {
        address: propertyForm.address,
        city: propertyForm.city,
        state: propertyForm.state,
        zip_code: propertyForm.zip_code,
        purchase_price: parseFloat(propertyForm.purchase_price) || 0,
        estimated_sale_price: parseFloat(propertyForm.estimated_sale_price) || parseFloat(propertyForm.purchase_price) || 0,
        phase: propertyForm.phase,
        notes: propertyForm.notes,
      };

      if (editingInvestment) {
        await apiCall(`/admin/investments/${editingInvestment.id}`, {
          method: 'PUT',
          body: payload,
        });
        Alert.alert('Éxito', 'Propiedad actualizada');
      } else {
        await apiCall('/admin/investments', {
          method: 'POST',
          body: payload,
        });
        Alert.alert('Éxito', 'Propiedad creada');
      }

      setShowCreateModal(false);
      resetPropertyForm();
      fetchInvestments();
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar la propiedad');
    }
  };

  const deleteProperty = async (inv: Investment) => {
    Alert.alert(
      'Eliminar Propiedad',
      `¿Estás seguro de eliminar "${inv.address}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiCall(`/admin/investments/${inv.id}`, { method: 'DELETE' });
              Alert.alert('Éxito', 'Propiedad eliminada');
              fetchInvestments();
            } catch (error) {
              Alert.alert('Error', 'No se pudo eliminar la propiedad');
            }
          },
        },
      ]
    );
  };

  const addExpense = async () => {
    if (!selectedInvestment || !expenseForm.description || !expenseForm.amount) return;
    
    try {
      await apiCall(`/admin/investments/${selectedInvestment.id}/expenses`, {
        method: 'POST',
        body: {
          description: expenseForm.description,
          amount: parseFloat(expenseForm.amount),
          category: expenseForm.category,
        },
      });
      setShowExpenseModal(false);
      setExpenseForm({ description: '', amount: '', category: 'repair' });
      fetchInvestments();
      Alert.alert('Éxito', 'Gasto agregado correctamente');
    } catch (e) {
      Alert.alert('Error', 'No se pudo agregar el gasto');
    }
  };

  const updatePhase = async (invId: string, newPhase: string) => {
    try {
      await apiCall(`/admin/investments/${invId}`, {
        method: 'PUT',
        body: { phase: newPhase },
      });
      fetchInvestments();
    } catch (e) {
      Alert.alert('Error', 'No se pudo actualizar la fase');
    }
  };

  // ─── PDF Generation ─────────────────────────────────────
  const generatePDF = async (type: 'balance' | 'monthly') => {
    setGeneratingPdf(true);
    
    const today = new Date();
    const dateStr = today.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
    const monthStr = today.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });

    const totalInvested = dashboard?.total_invested || 0;
    const totalExpenses = dashboard?.total_expenses || 0;
    const totalValue = dashboard?.total_potential_value || 0;
    const totalProfit = totalValue - totalInvested - totalExpenses;
    const avgROI = dashboard?.avg_profit_margin || 0;

    // Property rows for table
    const propertyRows = investments.map(inv => {
      const invested = (inv.purchase_price || 0) + (inv.total_expenses || 0);
      const value = inv.current_value || inv.purchase_price || 0;
      const profit = value - invested;
      const roi = invested > 0 ? ((profit / invested) * 100).toFixed(1) : '0.0';
      const phase = getPhaseConfig(inv.phase);
      
      return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            <strong>${inv.address}</strong><br>
            <span style="color: #6b7280; font-size: 12px;">${inv.city}, ${inv.state}</span>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${(inv.purchase_price || 0).toLocaleString()}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #f59e0b;">$${(inv.total_expenses || 0).toLocaleString()}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${invested.toLocaleString()}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #10b981;">$${value.toLocaleString()}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: ${profit >= 0 ? '#10b981' : '#ef4444'};">${profit >= 0 ? '+' : ''}$${profit.toLocaleString()}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
            <span style="background: ${phase.color}20; color: ${phase.color}; padding: 4px 8px; border-radius: 4px; font-size: 11px;">${phase.label}</span>
          </td>
        </tr>
      `;
    }).join('');

    // Expense breakdown by category
    const expensesByCategory: Record<string, number> = {};
    investments.forEach(inv => {
      (inv.expenses || []).forEach(exp => {
        const cat = exp.category || 'other';
        expensesByCategory[cat] = (expensesByCategory[cat] || 0) + exp.amount;
      });
    });

    const expenseCategoryRows = Object.entries(expensesByCategory).map(([cat, amount]) => {
      const catConfig = EXPENSE_CATEGORIES.find(c => c.key === cat) || EXPENSE_CATEGORIES[5];
      return `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
            <span style="color: ${catConfig.color}; font-weight: 600;">${catConfig.label}</span>
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">$${amount.toLocaleString()}</td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${type === 'balance' ? 'Balance de Inversiones' : 'Reporte Mensual'}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1f2937; line-height: 1.5; }
          .container { max-width: 800px; margin: 0 auto; padding: 40px; }
          
          /* Header */
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 3px solid #C8102E; }
          .logo-section { display: flex; align-items: center; gap: 15px; }
          .logo { width: 60px; height: 60px; background: linear-gradient(135deg, #C8102E, #9B1B30); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: bold; }
          .company-name { font-size: 24px; font-weight: 700; color: #1f2937; }
          .company-subtitle { font-size: 12px; color: #6b7280; }
          .report-info { text-align: right; }
          .report-title { font-size: 18px; font-weight: 700; color: #C8102E; }
          .report-date { font-size: 12px; color: #6b7280; margin-top: 4px; }
          
          /* Summary Cards */
          .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
          .summary-card { background: #f9fafb; border-radius: 12px; padding: 20px; text-align: center; border: 1px solid #e5e7eb; }
          .summary-card.highlight { background: linear-gradient(135deg, #C8102E, #9B1B30); color: white; border: none; }
          .summary-card.highlight .summary-label { color: rgba(255,255,255,0.8); }
          .summary-label { font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px; margin-bottom: 5px; }
          .summary-value { font-size: 22px; font-weight: 700; }
          .summary-value.green { color: #10b981; }
          .summary-value.yellow { color: #f59e0b; }
          
          /* Section */
          .section { margin-bottom: 30px; }
          .section-title { font-size: 16px; font-weight: 700; color: #1f2937; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb; }
          
          /* Table */
          table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          th { background: #f3f4f6; padding: 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px; }
          th:not(:first-child) { text-align: right; }
          th:last-child { text-align: center; }
          
          /* Footer */
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 11px; }
          .footer-logo { font-weight: 700; color: #C8102E; }
          
          /* Page break for print */
          .page-break { page-break-after: always; }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Header -->
          <div class="header">
            <div class="logo-section">
              <div class="logo">RH</div>
              <div>
                <div class="company-name">Ross House Rentals LLC</div>
                <div class="company-subtitle">Investment Portfolio Management</div>
              </div>
            </div>
            <div class="report-info">
              <div class="report-title">${type === 'balance' ? 'BALANCE DE INVERSIONES' : 'REPORTE MENSUAL'}</div>
              <div class="report-date">${type === 'balance' ? dateStr : monthStr}</div>
            </div>
          </div>
          
          <!-- Summary Cards -->
          <div class="summary-grid">
            <div class="summary-card highlight">
              <div class="summary-label">Total Invertido</div>
              <div class="summary-value">$${totalInvested.toLocaleString()}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Total Gastos</div>
              <div class="summary-value yellow">$${totalExpenses.toLocaleString()}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Valor Estimado</div>
              <div class="summary-value">$${totalValue.toLocaleString()}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Ganancia Potencial</div>
              <div class="summary-value green">${totalProfit >= 0 ? '+' : ''}$${totalProfit.toLocaleString()}</div>
            </div>
          </div>
          
          <!-- Properties Table -->
          <div class="section">
            <div class="section-title">📊 Detalle de Propiedades (${investments.length} activas)</div>
            <table>
              <thead>
                <tr>
                  <th>Propiedad</th>
                  <th>Compra</th>
                  <th>Gastos</th>
                  <th>Total Inv.</th>
                  <th>Valor Est.</th>
                  <th>Ganancia</th>
                  <th>Fase</th>
                </tr>
              </thead>
              <tbody>
                ${propertyRows || '<tr><td colspan="7" style="padding: 20px; text-align: center; color: #9ca3af;">No hay propiedades registradas</td></tr>'}
              </tbody>
            </table>
          </div>
          
          ${Object.keys(expensesByCategory).length > 0 ? `
          <!-- Expense Breakdown -->
          <div class="section">
            <div class="section-title">💰 Desglose de Gastos por Categoría</div>
            <table>
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th>Monto Total</th>
                </tr>
              </thead>
              <tbody>
                ${expenseCategoryRows}
                <tr style="background: #f9fafb; font-weight: 700;">
                  <td style="padding: 12px;">TOTAL GASTOS</td>
                  <td style="padding: 12px; text-align: right; color: #f59e0b;">$${totalExpenses.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
          ` : ''}
          
          <!-- Analysis Summary -->
          <div class="section">
            <div class="section-title">📈 Análisis del Portafolio</div>
            <div style="background: #f9fafb; border-radius: 12px; padding: 20px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
              <div style="text-align: center;">
                <div style="font-size: 28px; font-weight: 700; color: #C8102E;">${investments.length}</div>
                <div style="font-size: 12px; color: #6b7280;">Propiedades Totales</div>
              </div>
              <div style="text-align: center;">
                <div style="font-size: 28px; font-weight: 700; color: #10b981;">${avgROI.toFixed(1)}%</div>
                <div style="font-size: 12px; color: #6b7280;">ROI Promedio</div>
              </div>
              <div style="text-align: center;">
                <div style="font-size: 28px; font-weight: 700; color: #3b82f6;">$${totalInvested > 0 ? Math.round(totalInvested / investments.length).toLocaleString() : 0}</div>
                <div style="font-size: 12px; color: #6b7280;">Inversión Promedio</div>
              </div>
            </div>
          </div>
          
          <!-- Footer -->
          <div class="footer">
            <div class="footer-logo">Ross House Rentals LLC</div>
            <div style="margin-top: 5px;">Generado el ${new Date().toLocaleString('es-MX')}</div>
            <div style="margin-top: 3px;">Este documento es confidencial y para uso interno únicamente.</div>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: type === 'balance' ? 'Balance de Inversiones' : 'Reporte Mensual',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Éxito', 'PDF generado correctamente');
      }
    } catch (error) {
      console.error('PDF Error:', error);
      Alert.alert('Error', 'No se pudo generar el PDF');
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.brandRed} />
      </View>
    );
  }

  const totalProps = investments.length;
  const totalExpenses = dashboard?.total_expenses || 0;
  const roiPct = dashboard?.avg_profit_margin || 0;

  return (
    <View style={styles.root}>
      {/* Premium Background */}
      <LinearGradient
        colors={['rgba(200,16,46,0.08)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.bgGradient}
      />
      <View style={styles.bgOrb1} />
      <View style={styles.bgOrb2} />

      <ScrollView
        style={[styles.container, { paddingTop: insets.top }]}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brandRed} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Portafolio de Inversiones</Text>
            <Text style={styles.headerSubtitle}>Ross House Rentals LLC</Text>
          </View>
          <TouchableOpacity onPress={openCreateModal} style={styles.addBtn}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabBar}>
          {[
            { key: 'overview', label: 'Resumen', icon: 'pie-chart-outline' as const },
            { key: 'properties', label: 'Propiedades', icon: 'home-outline' as const },
            { key: 'analytics', label: 'Análisis', icon: 'analytics-outline' as const },
          ].map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key as any)}
            >
              <Ionicons name={tab.icon} size={16} color={activeTab === tab.key ? Colors.brandRed : Colors.textMuted} />
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'overview' && (
          <>
            {/* Hero Card */}
            <View style={styles.heroCard}>
              <LinearGradient
                colors={['rgba(200,16,46,0.15)', 'rgba(200,16,46,0.02)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.heroAccentLine} />
              
              <View style={styles.heroContent}>
                <View style={styles.heroTop}>
                  <View>
                    <Text style={styles.heroLabel}>TOTAL INVERTIDO</Text>
                    <Text style={styles.heroAmount}>{fmtCurrency(dashboard?.total_invested || 0)}</Text>
                  </View>
                  <View style={styles.heroIconWrap}>
                    <Ionicons name="wallet" size={24} color={Colors.brandRed} />
                  </View>
                </View>
                
                <View style={styles.heroStats}>
                  <View style={styles.heroStatItem}>
                    <Text style={styles.heroStatLabel}>Gastos</Text>
                    <Text style={[styles.heroStatValue, { color: '#F59E0B' }]}>{fmtCurrency(totalExpenses)}</Text>
                  </View>
                  <View style={styles.heroStatDivider} />
                  <View style={styles.heroStatItem}>
                    <Text style={styles.heroStatLabel}>Valor Potencial</Text>
                    <Text style={styles.heroStatValue}>{fmtCurrency(dashboard?.total_potential_value || 0)}</Text>
                  </View>
                  <View style={styles.heroStatDivider} />
                  <View style={styles.heroStatItem}>
                    <Text style={styles.heroStatLabel}>Ganancia</Text>
                    <Text style={[styles.heroStatValue, { color: Colors.success }]}>{fmtCurrency(dashboard?.total_potential_profit || 0)}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Circular Charts */}
            <Text style={styles.sectionLabel}>✨ MÉTRICAS CLAVE</Text>
            <View style={styles.chartsRow}>
              <View style={styles.chartCard}>
                <CircularChart
                  value={totalProps}
                  maxValue={Math.max(totalProps, 10)}
                  size={130}
                  strokeWidth={10}
                  gradientColors={[Colors.brandRed, '#9B1B30']}
                  centerLabel="PROPIEDADES"
                  centerValue={`${totalProps}`}
                  icon="business"
                  iconColor={Colors.brandRed}
                />
              </View>
              <View style={styles.chartCard}>
                <CircularChart
                  value={roiPct}
                  maxValue={100}
                  size={130}
                  strokeWidth={10}
                  gradientColors={[Colors.success, '#059669']}
                  centerLabel="ROI"
                  centerValue={`${roiPct.toFixed(1)}%`}
                  icon="trending-up"
                  iconColor={Colors.success}
                />
              </View>
            </View>

            {/* Mini Cards Grid */}
            <View style={styles.miniGrid}>
              <MiniCard icon="business" iconBg="rgba(59,130,246,0.12)" iconColor="#3B82F6" value={totalProps} label="ACTIVAS" />
              <MiniCard icon="pricetag" iconBg="rgba(245,158,11,0.12)" iconColor="#F59E0B" value={investments.filter(i => i.phase === 'en_venta').length} label="EN VENTA" />
            </View>
            <View style={styles.miniGrid}>
              <MiniCard icon="hammer" iconBg="rgba(236,72,153,0.12)" iconColor="#EC4899" value={investments.filter(i => i.phase === 'en_remodelacion').length} label="EN OBRA" />
              <MiniCard icon="checkmark-circle" iconBg="rgba(16,185,129,0.12)" iconColor={Colors.success} value={investments.filter(i => i.phase === 'vendida').length} label="VENDIDAS" />
            </View>

            {/* Pipeline Status */}
            <Text style={styles.sectionLabel}>📊 PIPELINE DE INVERSIONES</Text>
            <View style={styles.pipelineCard}>
              {Object.entries(PHASE_CONFIG).slice(0, 5).filter(([k]) => !['acquisition', 'repair', 'listed', 'rented', 'sold'].includes(k)).map(([key, config]) => {
                const count = dashboard?.phases?.[key] || investments.filter(i => i.phase === key).length || 0;
                return (
                  <View key={key} style={styles.pipelineRow}>
                    <View style={[styles.pipelineDot, { backgroundColor: config.color }]} />
                    <Text style={styles.pipelineLabel}>{config.label}</Text>
                    <View style={styles.pipelineBarContainer}>
                      <View style={[styles.pipelineBar, { width: `${Math.min((count / Math.max(totalProps, 1)) * 100, 100)}%`, backgroundColor: config.color }]} />
                    </View>
                    <Text style={styles.pipelineValue}>{count}</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {activeTab === 'properties' && (
          <>
            {/* Add Property Button */}
            <TouchableOpacity style={styles.addPropertyCard} onPress={openCreateModal}>
              <View style={styles.addPropertyIcon}>
                <Ionicons name="add" size={28} color={Colors.brandRed} />
              </View>
              <View>
                <Text style={styles.addPropertyText}>Agregar Nueva Propiedad</Text>
                <Text style={styles.addPropertySubtext}>Registrar inversión inmobiliaria</Text>
              </View>
            </TouchableOpacity>

            {investments.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="briefcase-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No hay inversiones</Text>
                <Text style={styles.emptySubtitle}>Agrega tu primera propiedad de inversión</Text>
              </View>
            ) : (
              investments.map((inv) => {
                const phase = getPhaseConfig(inv.phase);
                const invested = (inv.purchase_price || 0) + (inv.total_expenses || 0);
                const value = inv.current_value || inv.purchase_price || 0;
                const profit = value - invested;
                const roi = invested > 0 ? ((profit / invested) * 100) : 0;
                
                return (
                  <View key={inv.id} style={styles.propertyCard}>
                    <LinearGradient
                      colors={[`${phase.color}15`, 'transparent']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={[styles.propertyAccent, { backgroundColor: phase.color }]} />
                    
                    <View style={styles.propertyHeader}>
                      <View style={[styles.propertyIconWrap, { backgroundColor: `${phase.color}20` }]}>
                        <Ionicons name={phase.icon} size={20} color={phase.color} />
                      </View>
                      <View style={styles.propertyInfo}>
                        <Text style={styles.propertyTitle}>{inv.address}</Text>
                        <Text style={styles.propertySubtitle}>{inv.city}, {inv.state}</Text>
                      </View>
                      <View style={[styles.phaseBadge, { backgroundColor: `${phase.color}20`, borderColor: `${phase.color}40` }]}>
                        <Text style={[styles.phaseBadgeText, { color: phase.color }]}>{phase.label.toUpperCase()}</Text>
                      </View>
                    </View>

                    {/* Financial Summary */}
                    <View style={styles.financialRow}>
                      <View style={styles.financialItem}>
                        <Text style={styles.financialLabel}>COMPRA</Text>
                        <Text style={styles.financialValue}>{fmtCurrency(inv.purchase_price)}</Text>
                      </View>
                      <View style={styles.financialItem}>
                        <Text style={styles.financialLabel}>GASTOS</Text>
                        <Text style={[styles.financialValue, { color: '#F59E0B' }]}>{fmtCurrency(inv.total_expenses)}</Text>
                      </View>
                      <View style={styles.financialItem}>
                        <Text style={styles.financialLabel}>ROI</Text>
                        <Text style={[styles.financialValue, { color: roi >= 0 ? Colors.success : Colors.error }]}>
                          {roi.toFixed(1)}%
                        </Text>
                      </View>
                    </View>

                    {/* Actions */}
                    <View style={styles.propertyActions}>
                      <TouchableOpacity 
                        style={[styles.actionBtn, { borderColor: '#F59E0B40' }]}
                        onPress={() => { setSelectedInvestment(inv); setShowExpenseModal(true); }}
                      >
                        <Ionicons name="add-circle-outline" size={16} color="#F59E0B" />
                        <Text style={[styles.actionBtnText, { color: '#F59E0B' }]}>Gasto</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.actionBtn, { borderColor: '#3B82F640' }]}
                        onPress={() => openEditModal(inv)}
                      >
                        <Ionicons name="create-outline" size={16} color="#3B82F6" />
                        <Text style={[styles.actionBtnText, { color: '#3B82F6' }]}>Editar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.actionBtn, { borderColor: '#EF444440' }]}
                        onPress={() => deleteProperty(inv)}
                      >
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Borrar</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Expenses Preview */}
                    {inv.expenses && inv.expenses.length > 0 && (
                      <View style={styles.expensesPreview}>
                        <Text style={styles.expensesTitle}>Últimos Gastos ({inv.expenses.length})</Text>
                        {inv.expenses.slice(0, 2).map((exp, i) => {
                          const cat = EXPENSE_CATEGORIES.find(c => c.key === exp.category);
                          return (
                            <View key={i} style={styles.expenseRow}>
                              <Ionicons name={cat?.icon || 'ellipsis-horizontal'} size={14} color={cat?.color || '#888'} />
                              <Text style={styles.expenseDesc} numberOfLines={1}>{exp.description}</Text>
                              <Text style={styles.expenseAmount}>{fmtCurrency(exp.amount)}</Text>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </>
        )}

        {activeTab === 'analytics' && (
          <>
            {/* ROI by Property */}
            <Text style={styles.sectionLabel}>📈 RENDIMIENTO POR PROPIEDAD</Text>
            <View style={styles.analyticsCard}>
              {investments.length === 0 ? (
                <Text style={styles.noDataText}>No hay datos para mostrar</Text>
              ) : (
                investments.map((inv) => {
                  const invested = (inv.purchase_price || 0) + (inv.total_expenses || 0);
                  const value = inv.current_value || inv.purchase_price || 0;
                  const profit = value - invested;
                  const margin = invested > 0 ? (profit / invested) * 100 : 0;
                  const shortAddr = inv.address?.split(' ').slice(0, 2).join(' ') || 'N/A';
                  
                  return (
                    <View key={inv.id} style={styles.roiRow}>
                      <Text style={styles.roiAddress} numberOfLines={1}>{shortAddr}</Text>
                      <View style={styles.roiBarContainer}>
                        <View style={[styles.roiBarFill, { 
                          width: `${Math.min(Math.abs(margin), 100)}%`,
                          backgroundColor: margin >= 0 ? Colors.success : Colors.error
                        }]} />
                      </View>
                      <Text style={[styles.roiValue, { color: margin >= 0 ? Colors.success : Colors.error }]}>
                        {margin >= 0 ? '+' : ''}{margin.toFixed(1)}%
                      </Text>
                    </View>
                  );
                })
              )}
            </View>

            {/* Export Actions */}
            <Text style={styles.sectionLabel}>📋 REPORTES PROFESIONALES</Text>
            <View style={styles.createActionsRow}>
              <TouchableOpacity 
                style={styles.createCard} 
                onPress={() => generatePDF('balance')}
                disabled={generatingPdf}
              >
                <LinearGradient colors={['rgba(59,130,246,0.15)', 'rgba(59,130,246,0.02)']} style={StyleSheet.absoluteFill} />
                <View style={[styles.createIconWrap, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
                  {generatingPdf ? (
                    <ActivityIndicator size="small" color="#3B82F6" />
                  ) : (
                    <Ionicons name="document-text-outline" size={24} color="#3B82F6" />
                  )}
                </View>
                <Text style={styles.createLabel}>Exportar Balance</Text>
                <Text style={styles.createDesc}>PDF profesional con logo</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.createCard}
                onPress={() => generatePDF('monthly')}
                disabled={generatingPdf}
              >
                <LinearGradient colors={['rgba(16,185,129,0.15)', 'rgba(16,185,129,0.02)']} style={StyleSheet.absoluteFill} />
                <View style={[styles.createIconWrap, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
                  {generatingPdf ? (
                    <ActivityIndicator size="small" color={Colors.success} />
                  ) : (
                    <Ionicons name="calendar-outline" size={24} color={Colors.success} />
                  )}
                </View>
                <Text style={styles.createLabel}>Reporte Mensual</Text>
                <Text style={styles.createDesc}>Análisis detallado del mes</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.reportNote}>
              Los reportes generados incluyen el logo de la empresa y están diseñados para presentación bancaria.
            </Text>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Create/Edit Property Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingInvestment ? 'Editar Propiedad' : 'Nueva Propiedad'}
              </Text>
              <TouchableOpacity onPress={() => { setShowCreateModal(false); resetPropertyForm(); }}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Dirección *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: 123 Main Street"
                placeholderTextColor={Colors.textMuted}
                value={propertyForm.address}
                onChangeText={(t) => setPropertyForm({...propertyForm, address: t})}
              />

              <View style={styles.inputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Ciudad</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ciudad"
                    placeholderTextColor={Colors.textMuted}
                    value={propertyForm.city}
                    onChangeText={(t) => setPropertyForm({...propertyForm, city: t})}
                  />
                </View>
                <View style={{ width: 100, marginLeft: 10 }}>
                  <Text style={styles.inputLabel}>Estado</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="TX"
                    placeholderTextColor={Colors.textMuted}
                    value={propertyForm.state}
                    onChangeText={(t) => setPropertyForm({...propertyForm, state: t})}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Precio de Compra *</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                value={propertyForm.purchase_price}
                onChangeText={(t) => setPropertyForm({...propertyForm, purchase_price: t})}
              />

              <Text style={styles.inputLabel}>Valor Estimado de Venta</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                value={propertyForm.estimated_sale_price}
                onChangeText={(t) => setPropertyForm({...propertyForm, estimated_sale_price: t})}
              />

              <Text style={styles.inputLabel}>Fase</Text>
              <View style={styles.phaseGrid}>
                {Object.entries(PHASE_CONFIG).filter(([k]) => !['acquisition', 'repair', 'listed', 'rented', 'sold'].includes(k)).map(([key, config]) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.phaseOption, propertyForm.phase === key && { backgroundColor: `${config.color}30`, borderColor: config.color }]}
                    onPress={() => setPropertyForm({...propertyForm, phase: key})}
                  >
                    <Ionicons name={config.icon} size={16} color={config.color} />
                    <Text style={[styles.phaseOptionText, { color: propertyForm.phase === key ? config.color : Colors.textMuted }]}>
                      {config.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Notas</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                placeholder="Notas adicionales..."
                placeholderTextColor={Colors.textMuted}
                multiline
                value={propertyForm.notes}
                onChangeText={(t) => setPropertyForm({...propertyForm, notes: t})}
              />

              <TouchableOpacity style={styles.saveBtn} onPress={saveProperty}>
                <LinearGradient colors={Gradients.brandRed} style={StyleSheet.absoluteFill} />
                <Text style={styles.saveBtnText}>
                  {editingInvestment ? 'Guardar Cambios' : 'Crear Propiedad'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Expense Modal */}
      <Modal visible={showExpenseModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.expenseModalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Agregar Gasto</Text>
              <TouchableOpacity onPress={() => setShowExpenseModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.expenseForm}>
              <Text style={styles.inputLabel}>Descripción</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: Pintura exterior"
                placeholderTextColor={Colors.textMuted}
                value={expenseForm.description}
                onChangeText={(t) => setExpenseForm({...expenseForm, description: t})}
              />

              <Text style={styles.inputLabel}>Monto ($)</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                value={expenseForm.amount}
                onChangeText={(t) => setExpenseForm({...expenseForm, amount: t})}
              />

              <Text style={styles.inputLabel}>Categoría</Text>
              <View style={styles.categoryGrid}>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.key}
                    style={[styles.categoryOption, expenseForm.category === cat.key && { backgroundColor: `${cat.color}30`, borderColor: cat.color }]}
                    onPress={() => setExpenseForm({...expenseForm, category: cat.key})}
                  >
                    <Ionicons name={cat.icon} size={20} color={cat.color} />
                    <Text style={[styles.categoryText, { color: expenseForm.category === cat.key ? cat.color : Colors.textMuted }]}>{cat.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={addExpense}>
                <LinearGradient colors={Gradients.brandRed} style={StyleSheet.absoluteFill} />
                <Text style={styles.saveBtnText}>Guardar Gasto</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  
  bgGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 300 },
  bgOrb1: { position: 'absolute', top: -100, right: -100, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(200,16,46,0.03)' },
  bgOrb2: { position: 'absolute', top: 200, left: -150, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(139,92,246,0.02)' },
  
  container: { flex: 1 },
  content: { padding: Spacing.base, paddingBottom: 40 },
  
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: Spacing.md },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.glassLight, borderWidth: 1, borderColor: Colors.glassBorderLight, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FontSizes['2xl'], fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  headerSubtitle: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 1 },
  addBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.brandRed, justifyContent: 'center', alignItems: 'center' },
  
  tabBar: { flexDirection: 'row', gap: 8, marginBottom: Spacing.md },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: BorderRadius.card, backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder },
  tabActive: { backgroundColor: 'rgba(200,16,46,0.1)', borderColor: 'rgba(200,16,46,0.2)' },
  tabText: { fontSize: FontSizes.sm, color: Colors.textMuted, fontWeight: '600' },
  tabTextActive: { color: Colors.brandRed },

  heroCard: { borderRadius: BorderRadius.card, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(200,16,46,0.15)', marginBottom: Spacing.lg },
  heroAccentLine: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: Colors.brandRed },
  heroContent: { padding: Spacing.lg },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroIconWrap: { width: 50, height: 50, borderRadius: 14, backgroundColor: 'rgba(200,16,46,0.1)', justifyContent: 'center', alignItems: 'center' },
  heroLabel: { fontSize: FontSizes.xs, color: Colors.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2 },
  heroAmount: { fontSize: 40, fontWeight: '800', color: Colors.brandRed, marginTop: 4, letterSpacing: -1 },
  heroStats: { flexDirection: 'row', marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.glassBorder },
  heroStatItem: { flex: 1, alignItems: 'center' },
  heroStatDivider: { width: 1, backgroundColor: Colors.glassBorder },
  heroStatLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroStatValue: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.textPrimary, marginTop: 4 },

  sectionLabel: { fontSize: FontSizes.xs, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12, marginTop: 8 },

  chartsRow: { flexDirection: 'row', gap: 12, marginBottom: Spacing.md },
  chartCard: { flex: 1, borderRadius: BorderRadius.card, overflow: 'hidden', borderWidth: 1, borderColor: Colors.glassBorder, padding: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.glass },
  chartContainer: { alignItems: 'center', justifyContent: 'center' },
  chartCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  chartPercentage: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  chartLabel: { fontSize: 9, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  chartValue: { fontSize: 12, fontWeight: '700', marginTop: 2 },

  miniGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  miniCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.glass, borderRadius: BorderRadius.card, padding: 14, borderWidth: 1, borderColor: Colors.glassBorder },
  miniIconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  miniContent: { flex: 1 },
  miniValue: { fontSize: FontSizes.xl, fontWeight: '800', color: Colors.textPrimary },
  miniLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', marginTop: 2 },

  pipelineCard: { backgroundColor: Colors.glass, borderRadius: BorderRadius.card, padding: Spacing.md, borderWidth: 1, borderColor: Colors.glassBorder, gap: 14, marginBottom: Spacing.lg },
  pipelineRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pipelineDot: { width: 8, height: 8, borderRadius: 4 },
  pipelineLabel: { width: 100, fontSize: FontSizes.sm, color: Colors.textSecondary, fontWeight: '500' },
  pipelineBarContainer: { flex: 1, height: 6, borderRadius: 3, backgroundColor: Colors.glassBorder },
  pipelineBar: { height: 6, borderRadius: 3 },
  pipelineValue: { width: 24, fontSize: FontSizes.sm, color: Colors.textPrimary, fontWeight: '700', textAlign: 'right' },

  addPropertyCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(200,16,46,0.08)', borderRadius: BorderRadius.card, padding: Spacing.md, borderWidth: 1, borderColor: 'rgba(200,16,46,0.2)', marginBottom: Spacing.md },
  addPropertyIcon: { width: 50, height: 50, borderRadius: 14, backgroundColor: 'rgba(200,16,46,0.15)', justifyContent: 'center', alignItems: 'center' },
  addPropertyText: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.textPrimary },
  addPropertySubtext: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 2 },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: FontSizes.lg, fontWeight: '600', color: Colors.textMuted, marginTop: 16 },
  emptySubtitle: { fontSize: FontSizes.sm, color: Colors.textDim, marginTop: 4 },

  propertyCard: { borderRadius: BorderRadius.card, overflow: 'hidden', marginBottom: 12, borderWidth: 1, borderColor: Colors.glassBorder, padding: Spacing.md },
  propertyAccent: { position: 'absolute', top: 0, left: 0, width: 4, height: '100%' },
  propertyHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  propertyIconWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  propertyInfo: { flex: 1, marginLeft: 12 },
  propertyTitle: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.textPrimary },
  propertySubtitle: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 2 },
  phaseBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: BorderRadius.full, borderWidth: 1 },
  phaseBadgeText: { fontSize: 10, fontWeight: '700' },

  financialRow: { flexDirection: 'row', marginBottom: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.glassBorder },
  financialItem: { flex: 1, alignItems: 'center' },
  financialLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '600', letterSpacing: 0.5 },
  financialValue: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.textPrimary, marginTop: 4 },

  propertyActions: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.glass, borderWidth: 1 },
  actionBtnText: { fontSize: 11, fontWeight: '600' },

  expensesPreview: { backgroundColor: Colors.glass, borderRadius: 12, padding: 12 },
  expensesTitle: { fontSize: 11, color: Colors.textMuted, marginBottom: 8, fontWeight: '600' },
  expenseRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  expenseDesc: { flex: 1, fontSize: 12, color: Colors.textSecondary },
  expenseAmount: { fontSize: 12, fontWeight: '600', color: '#F59E0B' },

  analyticsCard: { backgroundColor: Colors.glass, borderRadius: BorderRadius.card, padding: Spacing.md, borderWidth: 1, borderColor: Colors.glassBorder, marginBottom: Spacing.lg },
  noDataText: { color: Colors.textMuted, textAlign: 'center', paddingVertical: 40 },
  roiRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  roiAddress: { width: 70, fontSize: FontSizes.xs, color: Colors.textMuted },
  roiBarContainer: { flex: 1, height: 8, backgroundColor: Colors.glassBorderLight, borderRadius: 4, overflow: 'hidden' },
  roiBarFill: { height: '100%', borderRadius: 4 },
  roiValue: { width: 60, fontSize: FontSizes.sm, fontWeight: '700', textAlign: 'right' },

  createActionsRow: { flexDirection: 'row', gap: 10, marginBottom: Spacing.md },
  createCard: { flex: 1, borderRadius: BorderRadius.card, overflow: 'hidden', padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.glassBorderLight },
  createIconWrap: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  createLabel: { fontSize: FontSizes.sm, color: Colors.textPrimary, fontWeight: '700', textAlign: 'center' },
  createDesc: { fontSize: 9, color: Colors.textMuted, textAlign: 'center', marginTop: 4, lineHeight: 12 },
  reportNote: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', fontStyle: 'italic', lineHeight: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.glassBorderLight },
  modalTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.textPrimary },
  modalScroll: { padding: 20 },

  inputLabel: { fontSize: FontSizes.xs, color: Colors.textMuted, marginBottom: 8, fontWeight: '600', textTransform: 'uppercase' },
  input: { backgroundColor: Colors.glassLight, borderRadius: 12, padding: 14, color: Colors.textPrimary, fontSize: FontSizes.md, marginBottom: 16, borderWidth: 1, borderColor: Colors.glassBorderLight },
  inputRow: { flexDirection: 'row' },

  phaseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  phaseOption: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: BorderRadius.full, backgroundColor: Colors.glassLight, borderWidth: 1, borderColor: 'transparent' },
  phaseOptionText: { fontSize: 12, fontWeight: '600' },

  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  categoryOption: { width: '30%', alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: Colors.glass, borderWidth: 1, borderColor: 'transparent' },
  categoryText: { fontSize: 10, marginTop: 4, fontWeight: '600' },

  saveBtn: { borderRadius: 12, padding: 16, alignItems: 'center', overflow: 'hidden', marginTop: 10 },
  saveBtnText: { color: Colors.textPrimary, fontSize: FontSizes.md, fontWeight: '700' },

  expenseModalContent: { backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  expenseForm: { padding: 20 },
});
