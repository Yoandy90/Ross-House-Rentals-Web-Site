import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import api from '../services/api';

const { width } = Dimensions.get('window');
const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface InvoiceDetail {
  id: string;
  _id?: string;
  invoice_number: string;
  client_name?: string;
  client_email?: string;
  service_type?: string;
  description?: string;
  items?: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  amount?: number;
  status: string;
  payment_method?: string;
  payment_id?: string;
  card_last4?: string;
  card_brand?: string;
  paid_at?: string;
  created_at?: string;
  due_date?: string;
  order_number?: string;
}

export default function InvoiceDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { t } = useTranslation();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    loadInvoice();
  }, []);

  const loadInvoice = async () => {
    try {
      const invoiceId = params.invoiceId as string;
      // Try multiple endpoints
      let response;
      try {
        response = await api.get(`/invoices/${invoiceId}`);
      } catch {
        try {
          response = await api.get(`/invoices/detail/${invoiceId}`);
        } catch {
          // Use params data as fallback
          setInvoice({
            id: invoiceId,
            invoice_number: (params.invoiceNumber as string) || 'N/A',
            total: parseFloat(params.amount as string) || 0,
            subtotal: parseFloat(params.amount as string) || 0,
            tax: 0,
            status: (params.status as string) || 'paid',
            description: (params.description as string) || '',
            service_type: (params.serviceType as string) || '',
            created_at: (params.createdAt as string) || '',
            paid_at: (params.paidAt as string) || '',
          });
          setLoading(false);
          return;
        }
      }
      
      if (response?.data) {
        const data = response.data.invoice || response.data;
        setInvoice(data);
      }
    } catch (error) {
      console.error('Error loading invoice:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateInvoiceHTML = () => {
    if (!invoice) return '';
    const totalAmount = invoice.total || invoice.amount || 0;
    const statusLabel = invoice.status === 'paid' ? 'PAGADA' : invoice.status === 'pending' ? 'PENDIENTE' : invoice.status === 'overdue' ? 'VENCIDA' : invoice.status.toUpperCase();
    const statusColor = invoice.status === 'paid' ? '#10B981' : invoice.status === 'pending' ? '#F59E0B' : '#EF4444';

    const itemsHTML = (invoice.items && invoice.items.length > 0) ? invoice.items.map((item, i) => `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #E5E7EB; font-size: 14px; color: #374151;">${item.description}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #E5E7EB; text-align: center; font-size: 14px; color: #6B7280;">${item.quantity}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #E5E7EB; text-align: right; font-size: 14px; color: #374151;">$${(item.unit_price || 0).toFixed(2)}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #E5E7EB; text-align: right; font-size: 14px; font-weight: 600; color: #1F2937;">$${(item.total || item.unit_price * item.quantity).toFixed(2)}</td>
      </tr>
    `).join('') : `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #E5E7EB; font-size: 14px; color: #374151;">${invoice.service_type || invoice.description || 'Servicio'}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #E5E7EB; text-align: center; font-size: 14px; color: #6B7280;">1</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #E5E7EB; text-align: right; font-size: 14px; color: #374151;">$${totalAmount.toFixed(2)}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #E5E7EB; text-align: right; font-size: 14px; font-weight: 600; color: #1F2937;">$${totalAmount.toFixed(2)}</td>
      </tr>
    `;

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1F2937; background: #fff; }
      </style>
    </head>
    <body>
      <div style="max-width: 680px; margin: 0 auto; padding: 0;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1E3A5F 0%, #2C5282 100%); padding: 40px 32px; color: white;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <h1 style="font-size: 28px; font-weight: 800; margin-bottom: 4px; letter-spacing: -0.5px;">Ross Tax Preparation</h1>
              <p style="font-size: 13px; opacity: 0.8;">305 Bruce Ave, Dumas, TX 79029</p>
              <p style="font-size: 13px; opacity: 0.8;">(806) 934-2018 · yoandyross@gmail.com</p>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 32px; font-weight: 800; letter-spacing: 1px;">FACTURA</div>
              <div style="font-size: 14px; opacity: 0.8; margin-top: 4px;">${invoice.invoice_number}</div>
            </div>
          </div>
        </div>

        <!-- Status & Date Bar -->
        <div style="background: #F8FAFC; padding: 16px 32px; border-bottom: 2px solid #E2E8F0; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <span style="font-size: 12px; color: #6B7280; text-transform: uppercase; letter-spacing: 1px;">Fecha de Emisión</span>
            <div style="font-size: 15px; font-weight: 600; color: #374151; margin-top: 2px;">${formatDate(invoice.created_at)}</div>
          </div>
          <div style="background: ${statusColor}15; color: ${statusColor}; padding: 6px 16px; border-radius: 20px; font-weight: 700; font-size: 13px; border: 2px solid ${statusColor}30;">
            ● ${statusLabel}
          </div>
        </div>

        <div style="padding: 32px;">
          ${invoice.client_name ? `
          <!-- Client Info -->
          <div style="margin-bottom: 28px;">
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #9CA3AF; font-weight: 600; margin-bottom: 6px;">Facturado a</div>
            <div style="font-size: 16px; font-weight: 600; color: #1F2937;">${invoice.client_name}</div>
            ${invoice.client_email ? `<div style="font-size: 14px; color: #6B7280;">${invoice.client_email}</div>` : ''}
          </div>
          ` : ''}

          ${invoice.order_number ? `
          <div style="margin-bottom: 28px; padding: 12px 16px; background: #F0F4FF; border-radius: 8px; border-left: 4px solid #3B82F6;">
            <span style="font-size: 12px; color: #6B7280;">Orden de Servicio:</span>
            <span style="font-size: 14px; font-weight: 700; color: #1E3A5F; margin-left: 8px;">#${invoice.order_number}</span>
          </div>
          ` : ''}

          <!-- Items Table -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <thead>
              <tr style="background: #F8FAFC;">
                <th style="padding: 12px 16px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #6B7280; font-weight: 600; border-bottom: 2px solid #E5E7EB;">Descripción</th>
                <th style="padding: 12px 16px; text-align: center; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #6B7280; font-weight: 600; border-bottom: 2px solid #E5E7EB;">Cant.</th>
                <th style="padding: 12px 16px; text-align: right; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #6B7280; font-weight: 600; border-bottom: 2px solid #E5E7EB;">Precio</th>
                <th style="padding: 12px 16px; text-align: right; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #6B7280; font-weight: 600; border-bottom: 2px solid #E5E7EB;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHTML}
            </tbody>
          </table>

          <!-- Totals -->
          <div style="display: flex; justify-content: flex-end;">
            <div style="width: 260px;">
              <div style="display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; color: #6B7280;">
                <span>Subtotal</span>
                <span style="color: #374151; font-weight: 500;">$${(invoice.subtotal || totalAmount).toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; color: #6B7280; border-bottom: 1px solid #E5E7EB;">
                <span>Impuestos</span>
                <span style="color: #374151; font-weight: 500;">$${(invoice.tax || 0).toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 14px 0; font-size: 20px; font-weight: 800; color: #1E3A5F; border-top: 3px solid #1E3A5F; margin-top: 4px;">
                <span>Total</span>
                <span>$${totalAmount.toFixed(2)} USD</span>
              </div>
            </div>
          </div>

          ${invoice.status === 'paid' ? `
          <!-- Payment Confirmation -->
          <div style="margin-top: 28px; padding: 20px; background: #ECFDF5; border-radius: 12px; border: 1px solid #A7F3D0;">
            <div style="font-size: 16px; font-weight: 700; color: #065F46; margin-bottom: 8px;">✅ Pago Confirmado</div>
            ${invoice.card_last4 ? `<div style="font-size: 14px; color: #047857;">Tarjeta: ${invoice.card_brand || ''} ****${invoice.card_last4}</div>` : ''}
            ${invoice.paid_at ? `<div style="font-size: 14px; color: #047857; margin-top: 4px;">Fecha de pago: ${formatDate(invoice.paid_at)}</div>` : ''}
            ${invoice.payment_id ? `<div style="font-size: 12px; color: #6B7280; margin-top: 4px; font-family: monospace;">TXN: ${invoice.payment_id}</div>` : ''}
          </div>
          ` : ''}
        </div>

        <!-- Footer -->
        <div style="background: #F8FAFC; padding: 24px 32px; border-top: 1px solid #E5E7EB; text-align: center;">
          <p style="font-size: 14px; font-weight: 600; color: #6B7280;">Ross Tax Preparation LLC</p>
          <p style="font-size: 12px; color: #9CA3AF; margin-top: 4px;">Gracias por su confianza</p>
        </div>
      </div>
    </body>
    </html>
    `;
  };

  const handleShare = async () => {
    if (!invoice) return;
    setSharing(true);
    try {
      const html = generateInvoiceHTML();
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });
      
      // Rename file for better sharing
      const pdfName = `Factura_${invoice.invoice_number || 'RTP'}.pdf`;
      const newUri = uri.replace(/[^/]+$/, pdfName);
      
      // Try to rename, fall back to original URI
      let fileUri = uri;
      try {
        const FileSystem = require('expo-file-system');
        await FileSystem.moveAsync({ from: uri, to: newUri });
        fileUri = newUri;
      } catch {
        fileUri = uri;
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          dialogTitle: `Factura ${invoice.invoice_number}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Error', 'Compartir no está disponible en este dispositivo');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      Alert.alert('Error', 'No se pudo generar el PDF. Intente de nuevo.');
    } finally {
      setSharing(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'paid':
        return { label: 'PAGADA', color: '#10B981', icon: 'checkmark-circle' as const, bg: '#ECFDF5' };
      case 'pending':
        return { label: 'PENDIENTE', color: '#F59E0B', icon: 'time' as const, bg: '#FFFBEB' };
      case 'overdue':
        return { label: 'VENCIDA', color: '#EF4444', icon: 'alert-circle' as const, bg: '#FEF2F2' };
      default:
        return { label: status.toUpperCase(), color: '#6B7280', icon: 'document' as const, bg: '#F3F4F6' };
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1E3A5F" />
          <Text style={styles.loadingText}>Cargando factura...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!invoice) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Ionicons name="document-text-outline" size={60} color="#D1D5DB" />
          <Text style={styles.errorText}>Factura no encontrada</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusInfo = getStatusInfo(invoice.status);
  const totalAmount = invoice.total || invoice.amount || 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with extended gradient background */}
      <LinearGradient colors={['#1E3A5F', '#2C5282', '#3B6BA5']} style={styles.headerGradient}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Factura</Text>
          <TouchableOpacity onPress={handleShare} style={styles.headerBtn} disabled={sharing}>
            {sharing ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="share-outline" size={24} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Invoice Card */}
        <View style={styles.invoiceCard}>
          {/* Logo & Number */}
          <View style={styles.invoiceHeader}>
            <View>
              <Text style={styles.companyName}>Ross Tax Preparation</Text>
              <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
              <Ionicons name={statusInfo.icon} size={16} color={statusInfo.color} />
              <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Amount */}
          <View style={styles.amountSection}>
            <Text style={styles.amountLabel}>Monto Total</Text>
            <Text style={styles.amountValue}>${totalAmount.toFixed(2)}</Text>
            <Text style={styles.currency}>USD</Text>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Details Grid */}
          <View style={styles.detailsGrid}>
            {invoice.order_number && (
              <View style={styles.detailItem}>
                <Ionicons name="receipt-outline" size={18} color="#6B7280" />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Orden</Text>
                  <Text style={styles.detailValue}>#{invoice.order_number}</Text>
                </View>
              </View>
            )}

            {(invoice.service_type || invoice.description) && (
              <View style={styles.detailItem}>
                <Ionicons name="briefcase-outline" size={18} color="#6B7280" />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Servicio</Text>
                  <Text style={styles.detailValue}>{invoice.service_type || invoice.description}</Text>
                </View>
              </View>
            )}

            <View style={styles.detailItem}>
              <Ionicons name="calendar-outline" size={18} color="#6B7280" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Fecha de Emisión</Text>
                <Text style={styles.detailValue}>{formatDate(invoice.created_at)}</Text>
              </View>
            </View>

            {invoice.paid_at && (
              <View style={styles.detailItem}>
                <Ionicons name="checkmark-done-outline" size={18} color="#10B981" />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Fecha de Pago</Text>
                  <Text style={[styles.detailValue, { color: '#10B981' }]}>{formatDate(invoice.paid_at)}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Items */}
          {invoice.items && invoice.items.length > 0 && (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Detalle</Text>
              {invoice.items.map((item, index) => (
                <View key={index} style={styles.lineItem}>
                  <View style={styles.lineItemLeft}>
                    <Text style={styles.lineItemDesc}>{item.description}</Text>
                    <Text style={styles.lineItemQty}>Cant: {item.quantity}</Text>
                  </View>
                  <Text style={styles.lineItemPrice}>${(item.total || item.unit_price * item.quantity).toFixed(2)}</Text>
                </View>
              ))}
            </>
          )}

          {/* Totals */}
          <View style={styles.divider} />
          <View style={styles.totalsSection}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>${(invoice.subtotal || totalAmount).toFixed(2)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Impuestos</Text>
              <Text style={styles.totalValue}>${(invoice.tax || 0).toFixed(2)}</Text>
            </View>
            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalValue}>${totalAmount.toFixed(2)}</Text>
            </View>
          </View>

          {/* Payment Info */}
          {invoice.status === 'paid' && (
            <>
              <View style={styles.divider} />
              <View style={styles.paymentInfo}>
                <View style={styles.paymentBadge}>
                  <Ionicons name="shield-checkmark" size={20} color="#10B981" />
                  <Text style={styles.paymentBadgeText}>Pago Confirmado</Text>
                </View>
                {invoice.card_last4 && (
                  <View style={styles.paymentDetail}>
                    <Ionicons name="card-outline" size={16} color="#6B7280" />
                    <Text style={styles.paymentDetailText}>
                      {invoice.card_brand || 'Tarjeta'} ****{invoice.card_last4}
                    </Text>
                  </View>
                )}
                {invoice.payment_id && (
                  <View style={styles.paymentDetail}>
                    <Ionicons name="key-outline" size={16} color="#6B7280" />
                    <Text style={styles.paymentDetailText}>TXN: {invoice.payment_id}</Text>
                  </View>
                )}
              </View>
            </>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Ross Tax Preparation LLC</Text>
          <Text style={styles.footerSubtext}>Gracias por su confianza</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1E3A5F' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, backgroundColor: '#F3F4F6' },
  loadingText: { fontSize: 16, color: '#6B7280' },
  errorText: { fontSize: 18, color: '#6B7280', marginTop: 12 },
  backBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#1E3A5F', borderRadius: 10 },
  backBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },

  headerGradient: { paddingHorizontal: 20, paddingVertical: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFF' },

  content: { flex: 1, backgroundColor: '#EDF2F7', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 20 },

  invoiceCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  invoiceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  companyName: { fontSize: 18, fontWeight: '800', color: '#1E3A5F' },
  invoiceNumber: { fontSize: 14, color: '#6B7280', marginTop: 4, fontFamily: 'monospace' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: { fontSize: 12, fontWeight: '700' },

  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 16 },

  amountSection: { alignItems: 'center', paddingVertical: 8 },
  amountLabel: { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  amountValue: { fontSize: 42, fontWeight: '800', color: '#1E3A5F' },
  currency: { fontSize: 14, color: '#9CA3AF', fontWeight: '600', marginTop: 2 },

  detailsGrid: { gap: 14 },
  detailItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  detailContent: { flex: 1 },
  detailLabel: { fontSize: 12, color: '#9CA3AF', fontWeight: '600' },
  detailValue: { fontSize: 15, color: '#374151', fontWeight: '500', marginTop: 2 },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginBottom: 12 },
  lineItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  lineItemLeft: { flex: 1 },
  lineItemDesc: { fontSize: 15, color: '#374151', fontWeight: '500' },
  lineItemQty: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  lineItemPrice: { fontSize: 15, fontWeight: '600', color: '#374151' },

  totalsSection: { gap: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: 14, color: '#6B7280' },
  totalValue: { fontSize: 14, color: '#374151', fontWeight: '500' },
  grandTotalRow: { marginTop: 8, paddingTop: 12, borderTopWidth: 2, borderTopColor: '#1E3A5F' },
  grandTotalLabel: { fontSize: 18, fontWeight: '800', color: '#1E3A5F' },
  grandTotalValue: { fontSize: 18, fontWeight: '800', color: '#1E3A5F' },

  paymentInfo: { gap: 12 },
  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  paymentBadgeText: { fontSize: 14, fontWeight: '700', color: '#10B981' },
  paymentDetail: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  paymentDetailText: { fontSize: 14, color: '#6B7280', fontFamily: 'monospace' },

  footer: { alignItems: 'center', paddingVertical: 24 },
  footerText: { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
  footerSubtext: { fontSize: 13, color: '#D1D5DB', marginTop: 4 },
});
