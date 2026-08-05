import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';
import AdminHeader from '../../components/admin/AdminHeader';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

interface InvoiceDetail {
  id: string;
  invoice_number: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  service_name?: string;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
  subtotal: number;
  tax: number;
  tax_rate?: number;
  total: number;
  status: string;
  due_date?: string;
  created_at: string;
  paid_at?: string;
  notes?: string;
}

export default function InvoiceDetailsScreen() {
  const { invoiceId } = useLocalSearchParams<{ invoiceId: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (invoiceId) {
      loadInvoice();
    }
  }, [invoiceId]);

  const loadInvoice = async () => {
    try {
      const response = await api.get(`/admin/invoices/${invoiceId}`);
      setInvoice(response.data);
    } catch (error: any) {
      console.error('Error loading invoice:', error);
      Alert.alert('Error', 'No se pudo cargar la factura');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return '$0.00';
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return 'N/A';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return { bg: '#d1fae5', text: '#059669', label: 'Pagada' };
      case 'pending':
        return { bg: '#fef3c7', text: '#d97706', label: 'Pendiente' };
      case 'overdue':
        return { bg: '#fee2e2', text: '#dc2626', label: 'Vencida' };
      case 'cancelled':
        return { bg: '#e5e7eb', text: '#6b7280', label: 'Cancelada' };
      default:
        return { bg: '#f3f4f6', text: '#374151', label: status };
    }
  };

  const handleMarkAsPaid = async () => {
    Alert.alert(
      'Confirmar',
      '¿Marcar esta factura como pagada?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, marcar como pagada',
          onPress: async () => {
            try {
              await api.put(`/admin/invoices/${invoiceId}/status`, { status: 'paid' });
              Alert.alert('Éxito', 'Factura marcada como pagada');
              loadInvoice();
            } catch (error) {
              Alert.alert('Error', 'No se pudo actualizar el estado');
            }
          },
        },
      ]
    );
  };

  const handleSendReminder = async () => {
    try {
      await api.post(`/admin/invoices/${invoiceId}/send-reminder`);
      Alert.alert('Éxito', 'Recordatorio enviado al cliente');
    } catch (error) {
      Alert.alert('Error', 'No se pudo enviar el recordatorio');
    }
  };

  const handleShare = async () => {
    if (!invoice) return;
    
    try {
      // Obtener el nombre del cliente correctamente
      const clientName = invoice.user_name || invoice.client_name || 'Cliente';
      
      // Primero intentar compartir el PDF
      try {
        const response = await api.get(`/admin/invoices/${invoice.id}/pdf`, {
          responseType: 'blob'
        });
        
        // Si hay PDF disponible, compartirlo
        if (response.data) {
          const fileUri = FileSystem.documentDirectory + `factura_${invoice.invoice_number}.pdf`;
          
          // Convertir blob a base64
          const reader = new FileReader();
          reader.readAsDataURL(response.data);
          reader.onloadend = async () => {
            const base64data = reader.result?.toString().split(',')[1];
            if (base64data) {
              await FileSystem.writeAsStringAsync(fileUri, base64data, {
                encoding: FileSystem.EncodingType.Base64,
              });
              
              await Sharing.shareAsync(fileUri, {
                mimeType: 'application/pdf',
                dialogTitle: `Factura ${invoice.invoice_number}`,
              });
            }
          };
          return;
        }
      } catch (pdfError) {
        console.log('PDF not available, sharing text instead');
      }
      
      // Fallback: compartir como texto
      await Share.share({
        message: `📄 FACTURA ${invoice.invoice_number}\n\n` +
          `👤 Cliente: ${clientName}\n` +
          `📧 Email: ${invoice.user_email || invoice.client_email || ''}\n` +
          `💰 Total: ${formatCurrency(invoice.total)}\n` +
          `📅 Fecha: ${formatDate(invoice.created_at)}\n` +
          `📋 Estado: ${getStatusColor(invoice.status).label}\n\n` +
          `Ross Tax Preparation LLC\n` +
          `Tel: (806) 922-2318`,
        title: `Factura ${invoice.invoice_number}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
      Alert.alert('Error', 'No se pudo compartir la factura');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <AdminHeader title="Detalles de Factura" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!invoice) {
    return (
      <View style={styles.container}>
        <AdminHeader title="Detalles de Factura" />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={colors.textGray} />
          <Text style={styles.errorText}>Factura no encontrada</Text>
        </View>
      </View>
    );
  }

  const statusInfo = getStatusColor(invoice.status);

  return (
    <View style={styles.container}>
      <AdminHeader 
        title={`Factura ${invoice.invoice_number}`}
        rightAction={{
          icon: 'share-outline',
          onPress: handleShare,
        }}
      />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Status Banner */}
        <View style={[styles.statusBanner, { backgroundColor: statusInfo.bg }]}>
          <Ionicons 
            name={invoice.status === 'paid' ? 'checkmark-circle' : 'time'} 
            size={24} 
            color={statusInfo.text} 
          />
          <Text style={[styles.statusBannerText, { color: statusInfo.text }]}>
            {statusInfo.label}
          </Text>
        </View>

        {/* Client Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cliente</Text>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={18} color={colors.textGray} />
            <Text style={styles.infoText}>{invoice.user_name || 'Sin nombre'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={18} color={colors.textGray} />
            <Text style={styles.infoText}>{invoice.user_email || 'Sin email'}</Text>
          </View>
        </View>

        {/* Dates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fechas</Text>
          <View style={styles.dateRow}>
            <Text style={styles.dateLabel}>Creada:</Text>
            <Text style={styles.dateValue}>{formatDate(invoice.created_at)}</Text>
          </View>
          {invoice.due_date && (
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>Vencimiento:</Text>
              <Text style={styles.dateValue}>{formatDate(invoice.due_date)}</Text>
            </View>
          )}
          {invoice.paid_at && (
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>Pagada:</Text>
              <Text style={[styles.dateValue, { color: colors.success }]}>
                {formatDate(invoice.paid_at)}
              </Text>
            </View>
          )}
        </View>

        {/* Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Servicios</Text>
          {invoice.items?.map((item, index) => (
            <View key={index} style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemDescription}>{item.description}</Text>
                <Text style={styles.itemQuantity}>
                  {item.quantity} x {formatCurrency(item.unit_price)}
                </Text>
              </View>
              <Text style={styles.itemTotal}>{formatCurrency(item.total)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatCurrency(invoice.subtotal || 0)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Impuesto ({(invoice.tax_rate || 0) * 100}%)</Text>
            <Text style={styles.totalValue}>{formatCurrency(invoice.tax || 0)}</Text>
          </View>
          <View style={[styles.totalRow, styles.grandTotalRow]}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(invoice.total)}</Text>
          </View>
        </View>

        {/* Notes */}
        {invoice.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notas</Text>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </View>
        )}

        {/* Actions */}
        {invoice.status === 'pending' && (
          <View style={styles.actionsSection}>
            <TouchableOpacity style={styles.primaryButton} onPress={handleMarkAsPaid}>
              <Ionicons name="checkmark-circle" size={20} color="#FFF" />
              <Text style={styles.primaryButtonText}>Marcar como Pagada</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.secondaryButton} onPress={handleSendReminder}>
              <Ionicons name="notifications" size={20} color={colors.primary} />
              <Text style={styles.secondaryButtonText}>Enviar Recordatorio</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bottomSpacing} />
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: colors.textGray,
    marginTop: 16,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  statusBannerText: {
    fontSize: 18,
    fontWeight: '700',
  },
  section: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textGray,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  infoText: {
    fontSize: 15,
    color: colors.text,
    flex: 1,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dateLabel: {
    fontSize: 14,
    color: colors.textGray,
  },
  dateValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemInfo: {
    flex: 1,
  },
  itemDescription: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  itemQuantity: {
    fontSize: 13,
    color: colors.textGray,
    marginTop: 4,
  },
  itemTotal: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
  },
  totalsSection: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  totalLabel: {
    fontSize: 14,
    color: colors.textGray,
  },
  totalValue: {
    fontSize: 14,
    color: colors.text,
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    marginTop: 8,
    marginBottom: 0,
  },
  grandTotalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  grandTotalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  notesText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  actionsSection: {
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.success,
    padding: 16,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSpacing: {
    height: 32,
  },
});
