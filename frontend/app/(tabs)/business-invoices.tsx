/**
 * Business Invoices — Create, send & track professional invoices
 * Users create invoices for THEIR OWN clients (not Ross Tax clients)
 * ARCHITECTURE: Single active modal to prevent iOS freeze from nested modals
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Modal,
  TextInput, KeyboardAvoidingView, Platform, Dimensions,
  Share, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

const C = {
  bg: '#F2F2F7', card: '#FFFFFF', text: '#1C1C1E', sub: '#636366',
  muted: '#AEAEB2', border: '#E5E5EA', brand: '#8B1A1A', brandSoft: '#FFF1F0',
  success: '#34C759', successSoft: '#E8F9ED', warning: '#FF9500',
  blue: '#007AFF', blueSoft: '#EFF6FF', purple: '#AF52DE', danger: '#FF3B30',
};

const STATUS_CONFIG: Record<string, any> = {
  draft:   { label: 'Borrador', labelEn: 'Draft',   color: '#636366', bg: '#F2F2F7', icon: 'document-outline' },
  sent:    { label: 'Enviada',  labelEn: 'Sent',    color: '#007AFF', bg: '#EFF6FF', icon: 'send-outline' },
  paid:    { label: 'Pagada',   labelEn: 'Paid',    color: '#34C759', bg: '#E8F9ED', icon: 'checkmark-circle' },
  overdue: { label: 'Vencida',  labelEn: 'Overdue', color: '#FF3B30', bg: '#FFF1F0', icon: 'alert-circle' },
};

const FILTER_TABS = ['all', 'draft', 'sent', 'paid', 'overdue'];

const PAYMENT_TYPES = [
  { id: 'cash', label: 'Efectivo', icon: 'cash-outline', color: '#059669', placeholder: '' },
  { id: 'cashapp', label: 'Cash App', icon: 'logo-usd', color: '#00D632', placeholder: '$usuario' },
  { id: 'zelle', label: 'Zelle', icon: 'flash', color: '#6D1ED4', placeholder: 'email o teléfono' },
  { id: 'venmo', label: 'Venmo', icon: 'card', color: '#008CFF', placeholder: '@usuario' },
  { id: 'paypal', label: 'PayPal', icon: 'globe', color: '#003087', placeholder: 'usuario o email' },
];

type ActiveModal = 'none' | 'form' | 'clients' | 'newClient' | 'profile';

const fmt = (n: number) => '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDateShort = (d: string) => {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return d; }
};

export default function BusinessInvoicesScreen() {
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith('en');
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Core state
  const [invoices, setInvoices] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [sharingId, setSharingId] = useState<string | null>(null);

  // Single active modal (prevents iOS nested modal freeze)
  const [activeModal, setActiveModal] = useState<ActiveModal>('none');

  // Business profile
  const [bizProfile, setBizProfile] = useState<any>({ business_name: '', business_phone: '', business_address: '', business_logo: '', default_tax_rate: 0, default_notes: '', payment_methods: [] });
  const [profileForm, setProfileForm] = useState<any>({ business_name: '', business_phone: '', business_address: '', business_logo: '', default_tax_rate: 0, default_notes: '', payment_methods: [] });
  const [savingProfile, setSavingProfile] = useState(false);

  // Client management
  const [myClients, setMyClients] = useState<any[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [newClientData, setNewClientData] = useState({ name: '', email: '', phone: '', business_name: '', address: '' });
  const [savingClient, setSavingClient] = useState(false);

  // Invoice form
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [formData, setFormData] = useState({
    client_name: '', client_email: '', client_phone: '', business_name: '',
    notes: '', tax_rate: '0', due_date: '',
    items: [{ description: '', quantity: '1', unit_price: '' }],
  });
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date(Date.now() + 30 * 86400000));

  // Load data
  useEffect(() => { loadAll(); }, [filter]);
  useEffect(() => { loadClients(); loadProfile(); }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [invRes, statsRes] = await Promise.all([
        api.get(`/business-invoices?status=${filter}`),
        api.get('/business-invoices/stats'),
      ]);
      setInvoices(invRes.data || []);
      setStats(statsRes.data);
    } catch (e) { console.error('Load error:', e); }
    finally { setLoading(false); }
  };

  const loadClients = async () => {
    try { const res = await api.get('/user-biz-clients'); setMyClients(res.data || []); }
    catch (e) { console.error('Load clients error:', e); }
  };

  const loadProfile = async () => {
    try {
      const res = await api.get('/user-biz-profile');
      if (res.data) {
        const p = { ...res.data, payment_methods: res.data.payment_methods || [] };
        setBizProfile(p);
      }
    } catch (e) { console.error('Load profile error:', e); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadAll(), loadClients(), loadProfile()]);
    setRefreshing(false);
  };

  // === Form management ===
  const resetForm = () => {
    const dd = new Date(Date.now() + 30 * 86400000);
    setFormData({
      client_name: '', client_email: '', client_phone: '',
      business_name: bizProfile.business_name || '',
      notes: bizProfile.default_notes || '',
      tax_rate: String(bizProfile.default_tax_rate || 0),
      due_date: dd.toISOString().split('T')[0],
      items: [{ description: '', quantity: '1', unit_price: '' }],
    });
    setSelectedDate(dd);
    setEditingInvoice(null);
  };

  const openCreate = () => { resetForm(); setActiveModal('form'); };

  const openEdit = (inv: any) => {
    setEditingInvoice(inv);
    setFormData({
      client_name: inv.client_name || '',
      client_email: inv.client_email || '',
      client_phone: inv.client_phone || '',
      business_name: inv.business_name || '',
      notes: inv.notes || '',
      tax_rate: String(inv.tax_rate || 0),
      due_date: inv.due_date || '',
      items: (inv.items || []).map((it: any) => ({ description: it.description || '', quantity: String(it.quantity || 1), unit_price: String(it.unit_price || 0) })),
    });
    if (inv.due_date) { try { setSelectedDate(new Date(inv.due_date)); } catch {} }
    setActiveModal('form');
  };

  // Item management
  const addItem = () => setFormData(p => ({ ...p, items: [...p.items, { description: '', quantity: '1', unit_price: '' }] }));
  const removeItem = (idx: number) => { if (formData.items.length <= 1) return; setFormData(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) })); };
  const updateItem = (idx: number, field: string, value: string) => setFormData(p => ({ ...p, items: p.items.map((it, i) => i === idx ? { ...it, [field]: value } : it) }));

  const calcSubtotal = () => formData.items.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 0);

  // Date picker
  const onDateChange = (_: any, date?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) { setSelectedDate(date); setFormData(p => ({ ...p, due_date: date.toISOString().split('T')[0] })); }
  };

  // === Client selection (modal switching) ===
  const openClientPicker = () => setActiveModal('clients');
  const goBackToForm = () => setActiveModal('form');

  const selectClient = (client: any) => {
    setFormData(p => ({ ...p, client_name: client.name || '', client_email: client.email || '', client_phone: client.phone || '' }));
    setActiveModal('form'); // Go back to form with data
  };

  const openNewClientForm = () => {
    setNewClientData({ name: '', email: '', phone: '', business_name: '', address: '' });
    setActiveModal('newClient');
  };

  const saveNewClient = async () => {
    if (!newClientData.name.trim()) { Alert.alert('Error', isEn ? 'Name required' : 'Nombre requerido'); return; }
    setSavingClient(true);
    try {
      const res = await api.post('/user-biz-clients', newClientData);
      const saved = res.data;
      setMyClients(prev => [...prev, saved]);
      setFormData(p => ({ ...p, client_name: saved.name || '', client_email: saved.email || '', client_phone: saved.phone || '' }));
      setActiveModal('form');
      Alert.alert('✅', isEn ? 'Client saved!' : '¡Cliente guardado!');
    } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Error'); }
    finally { setSavingClient(false); }
  };

  // === Save invoice ===
  const handleSave = async () => {
    if (!formData.client_name.trim()) { Alert.alert('Error', isEn ? 'Client name required' : 'Nombre del cliente requerido'); return; }
    if (!formData.items[0]?.description.trim()) { Alert.alert('Error', isEn ? 'Add at least one item' : 'Agrega al menos un concepto'); return; }
    setSaving(true);
    try {
      const payload = {
        client_name: formData.client_name.trim(),
        client_email: formData.client_email.trim(),
        client_phone: formData.client_phone.trim(),
        business_name: formData.business_name.trim() || bizProfile.business_name,
        notes: formData.notes.trim(),
        tax_rate: parseFloat(formData.tax_rate) || 0,
        due_date: formData.due_date || undefined,
        items: formData.items.filter(it => it.description.trim()).map(it => ({ description: it.description.trim(), quantity: parseFloat(it.quantity) || 1, unit_price: parseFloat(it.unit_price) || 0 })),
      };
      if (editingInvoice) { await api.put(`/business-invoices/${editingInvoice.id}`, payload); }
      else { await api.post('/business-invoices', payload); }
      setActiveModal('none');
      resetForm();
      await loadAll();
      Alert.alert('✅', isEn ? 'Invoice saved!' : '¡Factura guardada!');
    } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Error'); }
    finally { setSaving(false); }
  };

  // === Actions ===
  const handleAction = (inv: any, action: string) => {
    const title = action === 'send' ? (isEn ? 'Send?' : '¿Enviar?') : action === 'paid' ? (isEn ? 'Mark Paid?' : '¿Marcar Pagada?') : (isEn ? 'Delete?' : '¿Eliminar?');
    Alert.alert(title, `${inv.invoice_number}`, [
      { text: isEn ? 'Cancel' : 'Cancelar', style: 'cancel' },
      { text: 'OK', style: action === 'delete' ? 'destructive' : 'default', onPress: async () => {
        try {
          if (action === 'send') await api.put(`/business-invoices/${inv.id}/send`);
          else if (action === 'paid') await api.put(`/business-invoices/${inv.id}/mark-paid`);
          else await api.delete(`/business-invoices/${inv.id}`);
          await loadAll();
        } catch { Alert.alert('Error'); }
      }},
    ]);
  };

  // === PDF & Share ===
  const handleShare = async (inv: any) => {
    setSharingId(inv.id);
    try {
      const html = buildPdfHtml(inv);

      // Web fallback: open HTML in new window with print toolbar
      if (Platform.OS === 'web') {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          // Inject a toolbar above the invoice for print/download actions
          const toolbar = `<div class="no-print print-toolbar">
            <span style="font-size:16px;font-weight:bold">📄 Factura ${inv.invoice_number}</span>
            <div style="display:flex;gap:10px;align-items:center">
              <button onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
              <button onclick="window.close()" style="background:#64748B">✕ Cerrar</button>
            </div>
          </div>`;
          // Insert toolbar before the main table in the HTML
          const enhancedHtml = html.replace('</head><body>', '</head><body>' + toolbar);
          printWindow.document.write(enhancedHtml);
          printWindow.document.close();
        }
        setSharingId(null);
        return;
      }

      // Native (iOS/Android): Generate PDF file and share
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      let fileUri = uri;
      try {
        const newUri = FileSystem.documentDirectory + `Factura_${inv.invoice_number}.pdf`;
        await FileSystem.moveAsync({ from: uri, to: newUri });
        fileUri = newUri;
      } catch { /* use original uri */ }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      } else {
        await Share.share({ title: `Factura ${inv.invoice_number}`, message: `Factura ${inv.invoice_number} - $${(inv.total || 0).toFixed(2)}` });
      }
    } catch (err) {
      console.error('Share error:', err);
      Alert.alert('Error', isEn ? 'Could not share' : 'No se pudo compartir');
    } finally { setSharingId(null); }
  };

  // === Profile ===
  const openProfile = () => { setProfileForm({ ...bizProfile }); setActiveModal('profile'); };

  const pickLogo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.7, base64: true });
      if (!result.canceled && result.assets[0]?.base64) {
        setProfileForm((p: any) => ({ ...p, business_logo: `data:image/jpeg;base64,${result.assets[0].base64}` }));
      }
    } catch (e) { console.error(e); }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await api.put('/user-biz-profile', profileForm);
      setBizProfile(profileForm);
      setActiveModal('none');
      Alert.alert('✅', isEn ? 'Profile saved!' : '¡Perfil guardado!');
    } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Error'); }
    finally { setSavingProfile(false); }
  };

  // === PDF HTML Builder (WebKit-compatible, table-based layout) ===
  const buildPdfHtml = (inv: any): string => {
    const bName = inv.business_name || bizProfile.business_name || 'Mi Negocio';
    const bPhone = bizProfile.business_phone || '';
    const bAddress = bizProfile.business_address || '';
    const bLogo = bizProfile.business_logo || '';
    const total = (inv.total || 0).toFixed(2);
    const statusLabel = inv.status === 'paid' ? 'PAGADA' : inv.status === 'sent' ? 'ENVIADA' : inv.status === 'overdue' ? 'VENCIDA' : 'BORRADOR';
    const statusColor = inv.status === 'paid' ? '#16A34A' : inv.status === 'sent' ? '#2563EB' : inv.status === 'overdue' ? '#DC2626' : '#6B7280';
    const fDate = (d: string) => { if (!d) return 'N/A'; try { return new Date(d).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return d; } };

    const rows = (inv.items || []).map((it: any, i: number) => `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #E5E7EB;font-size:14px;color:#1F2937">${it.description}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #E5E7EB;text-align:center;font-size:14px;color:#6B7280">${it.quantity}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #E5E7EB;text-align:right;font-size:14px;color:#6B7280">$${(it.unit_price||0).toFixed(2)}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #E5E7EB;text-align:right;font-size:14px;font-weight:bold;color:#111827">$${((it.quantity||0)*(it.unit_price||0)).toFixed(2)}</td>
      </tr>`).join('');

    // Payment QR section
    const methods = bizProfile.payment_methods || [];
    let payHtml = '';
    if (inv.status !== 'paid' && methods.length > 0) {
      const cashMethod = methods.find((pm: any) => pm.type === 'cash');
      const digitalMethods = methods.filter((pm: any) => pm.type !== 'cash');

      // Digital payment QR codes
      let qrSection = '';
      if (digitalMethods.length > 0) {
        const qrCells = digitalMethods.map((pm: any) => {
          const pt = PAYMENT_TYPES.find(t => t.id === pm.type);
          const handle = (pm.handle || '').replace(/^[$@]/, '');
          let url = pm.handle;
          if (pm.type === 'cashapp') url = `https://cash.app/$${handle}/${total}`;
          else if (pm.type === 'venmo') url = `https://venmo.com/${handle}?txn=pay&amount=${total}&note=Factura+${inv.invoice_number}`;
          else if (pm.type === 'paypal') url = `https://paypal.me/${handle}/${total}`;
          const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
          return `<td style="text-align:center;padding:12px;vertical-align:top;width:${Math.floor(100/digitalMethods.length)}%">
            <img src="${qrImg}" width="130" height="130" style="display:block;margin:0 auto"/>
            <div style="margin-top:8px;font-size:14px;font-weight:bold;color:${pt?.color||'#333'}">${pt?.label||pm.type}</div>
            <div style="font-size:12px;color:#6B7280;margin-top:2px">${pm.handle}</div>
          </td>`;
        }).join('');

        qrSection = `
          <table width="100%" cellpadding="0" cellspacing="0"><tr>${qrCells}</tr></table>
          <div style="text-align:center;font-size:11px;color:#6B7280;margin-top:12px;font-style:italic">Escanea el código QR con la cámara de tu teléfono</div>`;
      }

      // Cash payment option
      let cashSection = '';
      if (cashMethod) {
        cashSection = `
          <div style="text-align:center;padding:14px;margin-top:${digitalMethods.length > 0 ? '12' : '0'}px;background-color:#FEF3C7;border-radius:8px;border:1px solid #F59E0B">
            <span style="font-size:22px">💵</span>
            <span style="font-size:15px;font-weight:bold;color:#92400E;margin-left:8px">TAMBIÉN SE ACEPTA PAGO EN EFECTIVO (CASH)</span>
          </div>`;
      }

      payHtml = `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:30px;border:2px solid #86EFAC;border-radius:8px">
          <tr><td style="background-color:#F0FDF4;padding:20px;text-align:center">
            <div style="font-size:18px;font-weight:bold;color:#166534;margin-bottom:4px">${digitalMethods.length > 0 ? 'MÉTODOS DE PAGO' : 'FORMA DE PAGO'}</div>
            <div style="font-size:14px;color:#15803D">Total a pagar: <strong>$${total} USD</strong></div>
          </td></tr>
          <tr><td style="background-color:#F0FDF4;padding:10px 20px 20px">
            ${qrSection}
            ${cashSection}
          </td></tr>
        </table>`;
    }

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Factura ${inv.invoice_number} - ${bName}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;color:#111827;background:#fff}
table{border-collapse:collapse}
@media print{
  body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .no-print{display:none!important}
  @page{margin:0.4in;size:letter}
}
.print-toolbar{background:#0F172A;color:#fff;padding:12px 24px;display:flex;justify-content:space-between;align-items:center;font-family:-apple-system,sans-serif}
.print-toolbar button{background:#2563EB;color:#fff;border:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:bold;cursor:pointer}
.print-toolbar button:hover{background:#1D4ED8}
</style>
</head><body>
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;margin:0 auto">
  
  <!-- HEADER -->
  <tr><td style="background-color:#0F172A;padding:36px 32px;color:#fff">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="vertical-align:top;width:55%">
        ${bLogo ? `<img src="${bLogo}" style="max-width:120px;max-height:60px;object-fit:contain;border-radius:8px;margin-bottom:10px;display:block"/>` : ''}
        <div style="font-size:20px;font-weight:bold;color:#fff">${bName}</div>
        ${bPhone ? `<div style="font-size:13px;color:#94A3B8;margin-top:4px">${bPhone}</div>` : ''}
        ${bAddress ? `<div style="font-size:12px;color:#94A3B8;margin-top:2px">${bAddress}</div>` : ''}
      </td>
      <td style="vertical-align:top;text-align:right">
        <div style="font-size:10px;letter-spacing:3px;color:#94A3B8;font-weight:bold">FACTURA</div>
        <div style="font-size:28px;font-weight:900;color:#fff;margin-top:2px">${inv.invoice_number}</div>
        <div style="display:inline-block;background-color:${statusColor};color:#fff;padding:4px 14px;border-radius:12px;font-size:11px;font-weight:bold;margin-top:10px">${statusLabel}</div>
      </td>
    </tr></table>
  </td></tr>

  <!-- DATES -->
  <tr><td style="background-color:#F1F5F9;padding:14px 32px;border-bottom:1px solid #E2E8F0">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><div style="font-size:10px;letter-spacing:1px;color:#94A3B8;font-weight:bold">EMISIÓN</div><div style="font-size:13px;font-weight:600;color:#334155;margin-top:2px">${fDate(inv.created_at)}</div></td>
      ${inv.due_date ? `<td style="text-align:right"><div style="font-size:10px;letter-spacing:1px;color:#94A3B8;font-weight:bold">VENCIMIENTO</div><div style="font-size:13px;font-weight:600;color:#334155;margin-top:2px">${fDate(inv.due_date)}</div></td>` : ''}
    </tr></table>
  </td></tr>

  <!-- BODY -->
  <tr><td style="padding:32px">

    <!-- CLIENT -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
      <tr><td style="padding:16px;background-color:#F8FAFC;border-left:4px solid #2563EB;border-radius:0 8px 8px 0">
        <div style="font-size:10px;letter-spacing:1.5px;color:#94A3B8;font-weight:bold;margin-bottom:6px">FACTURADO A</div>
        <div style="font-size:16px;font-weight:bold;color:#0F172A">${inv.client_name}</div>
        ${inv.client_email ? `<div style="font-size:13px;color:#64748B;margin-top:4px">${inv.client_email}</div>` : ''}
        ${inv.client_phone ? `<div style="font-size:13px;color:#64748B;margin-top:2px">${inv.client_phone}</div>` : ''}
      </td></tr>
    </table>

    <!-- ITEMS TABLE -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #E5E7EB">
      <tr style="background-color:#0F172A">
        <th style="padding:12px 16px;text-align:left;font-size:11px;letter-spacing:1px;color:#E2E8F0;font-weight:600">DESCRIPCIÓN</th>
        <th style="padding:12px 16px;text-align:center;font-size:11px;letter-spacing:1px;color:#E2E8F0;font-weight:600">CANT.</th>
        <th style="padding:12px 16px;text-align:right;font-size:11px;letter-spacing:1px;color:#E2E8F0;font-weight:600">PRECIO</th>
        <th style="padding:12px 16px;text-align:right;font-size:11px;letter-spacing:1px;color:#E2E8F0;font-weight:600">TOTAL</th>
      </tr>
      ${rows}
    </table>

    <!-- TOTALS -->
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="55%"></td>
      <td>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:6px 0;font-size:14px;color:#6B7280">Subtotal</td><td style="padding:6px 0;text-align:right;font-size:14px;color:#374151">$${(inv.subtotal||0).toFixed(2)}</td></tr>
          ${(inv.tax_amount||0) > 0 ? `<tr><td style="padding:6px 0;font-size:14px;color:#6B7280">Impuesto (${inv.tax_rate||0}%)</td><td style="padding:6px 0;text-align:right;font-size:14px;color:#374151">$${(inv.tax_amount||0).toFixed(2)}</td></tr>` : ''}
          <tr><td colspan="2" style="padding-top:8px"><div style="border-top:3px solid #0F172A"></div></td></tr>
          <tr><td style="padding:10px 0;font-size:22px;font-weight:900;color:#0F172A">TOTAL</td><td style="padding:10px 0;text-align:right;font-size:26px;font-weight:900;color:#0F172A">$${total}</td></tr>
        </table>
      </td>
    </tr></table>

    ${inv.notes ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px">
      <tr><td style="padding:14px 16px;background-color:#FFFBEB;border:1px solid #FDE68A;border-radius:8px">
        <div style="font-size:11px;font-weight:bold;color:#92400E;margin-bottom:4px">NOTAS</div>
        <div style="font-size:13px;color:#78350F;line-height:1.5">${inv.notes}</div>
      </td></tr>
    </table>` : ''}

    ${inv.status === 'paid' ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px">
      <tr><td style="padding:20px;background-color:#ECFDF5;border:2px solid #6EE7B7;border-radius:8px;text-align:center">
        <div style="font-size:20px;font-weight:bold;color:#065F46">✅ PAGO CONFIRMADO</div>
        ${inv.paid_date ? `<div style="font-size:14px;color:#047857;margin-top:6px">Pagado el ${fDate(inv.paid_date)}</div>` : ''}
      </td></tr>
    </table>` : ''}

    ${payHtml}

  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background-color:#0F172A;padding:20px 32px;text-align:center">
    <div style="font-size:13px;font-weight:bold;color:#94A3B8">${bName}</div>
    <div style="font-size:11px;color:#475569;margin-top:4px">Gracias por su preferencia</div>
  </td></tr>
</table>
</body></html>`;
  };

  // Computed
  const subtotal = calcSubtotal();
  const taxAmt = subtotal * ((parseFloat(formData.tax_rate) || 0) / 100);
  const totalAmt = subtotal + taxAmt;
  const filteredClients = myClients.filter(c => { if (!clientSearch) return true; const s = clientSearch.toLowerCase(); return (c.name||'').toLowerCase().includes(s) || (c.email||'').toLowerCase().includes(s) || (c.phone||'').includes(s); });

  // === RENDER ===
  return (
    <View style={s.container}>
      {/* Header */}
      <LinearGradient colors={['#0A1628', '#132240', '#1A2F55']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.headerGrad, { paddingTop: insets.top + 8 }]}>
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.replace('/my-business')} style={s.headerBtn}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{isEn ? 'Invoices' : 'Facturación'}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={openProfile} style={s.headerBtn}>
              <Ionicons name="business-outline" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={openCreate} style={[s.headerBtn, { backgroundColor: 'rgba(52,199,89,0.3)' }]}>
              <Ionicons name="add" size={22} color="#4ADE80" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Banner */}
        {bizProfile.business_name ? (
          <TouchableOpacity onPress={openProfile} style={s.profileBanner} activeOpacity={0.7}>
            {bizProfile.business_logo ? <Image source={{ uri: bizProfile.business_logo }} style={s.profileLogo} /> : (
              <View style={[s.profileLogo, { backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }]}><Ionicons name="business" size={18} color="#fff" /></View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.profileName}>{bizProfile.business_name}</Text>
              {bizProfile.business_phone ? <Text style={s.profileSub}>{bizProfile.business_phone}</Text> : null}
            </View>
            <Ionicons name="create-outline" size={16} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={openProfile} style={s.setupBanner} activeOpacity={0.7}>
            <Ionicons name="business-outline" size={20} color="#FBBF24" />
            <Text style={s.setupText}>{isEn ? 'Set up your business profile' : 'Configura tu perfil de negocio'}</Text>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        )}

        {/* Stats */}
        {stats && (
          <View style={{ flexDirection: 'row', marginHorizontal: 16, marginTop: 10, marginBottom: 16 }}>
            <View style={[s.statPill, { marginRight: 8 }]}>
              <Text style={s.statLabel}>{isEn ? 'Outstanding' : 'Pendiente'}</Text>
              <Text style={[s.statValue, { color: '#FBBF24' }]}>{fmt(stats.outstanding_total)}</Text>
            </View>
            <View style={[s.statPill, { marginRight: 8 }]}>
              <Text style={s.statLabel}>{isEn ? 'Paid' : 'Pagado'}</Text>
              <Text style={[s.statValue, { color: '#4ADE80' }]}>{fmt(stats.paid_this_month)}</Text>
            </View>
            <View style={s.statPill}>
              <Text style={s.statLabel}>{isEn ? 'Overdue' : 'Vencidas'}</Text>
              <Text style={[s.statValue, { color: '#F87171' }]}>{fmt(stats.overdue_total)}</Text>
            </View>
          </View>
        )}
      </LinearGradient>

      {/* Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={{ paddingHorizontal: 16 }}>
        {FILTER_TABS.map((tab, idx) => {
          const active = filter === tab;
          const labels: any = { all: isEn ? 'All' : 'Todas', draft: isEn ? 'Drafts' : 'Borradores', sent: isEn ? 'Sent' : 'Enviadas', paid: isEn ? 'Paid' : 'Pagadas', overdue: isEn ? 'Overdue' : 'Vencidas' };
          return (
            <TouchableOpacity key={tab} style={[s.filterTab, active && s.filterTabActive, idx > 0 && { marginLeft: 10 }]} onPress={() => setFilter(tab)}>
              <Text style={[s.filterTabText, active && s.filterTabTextActive]}>{labels[tab]}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Invoice List */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={C.brand} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} />} showsVerticalScrollIndicator={false}>
          {invoices.length === 0 ? (
            <View style={s.emptyState}>
              <Text style={{ fontSize: 48 }}>📄</Text>
              <Text style={s.emptyTitle}>{isEn ? 'No invoices yet' : 'Sin facturas aún'}</Text>
              <Text style={s.emptySub}>{isEn ? 'Create your first invoice' : 'Crea tu primera factura'}</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={openCreate}>
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={s.emptyBtnText}>{isEn ? 'New Invoice' : 'Nueva Factura'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            invoices.map((inv: any) => {
              const st = STATUS_CONFIG[inv.status] || STATUS_CONFIG.draft;
              return (
                <View key={inv.id} style={s.invoiceCard}>
                  <TouchableOpacity onPress={() => openEdit(inv)} activeOpacity={0.7}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.invNumber}>{inv.invoice_number}</Text>
                        <Text style={s.invClient}>{inv.client_name}</Text>
                      </View>
                      <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
                        <Ionicons name={st.icon} size={12} color={st.color} />
                        <Text style={[s.statusText, { color: st.color }]}>{isEn ? st.labelEn : st.label}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                      <Text style={s.invTotal}>{fmt(inv.total)}</Text>
                      <Text style={s.invDate}>{inv.due_date ? `${isEn ? 'Due' : 'Vence'}: ${fmtDateShort(inv.due_date)}` : ''}</Text>
                    </View>
                  </TouchableOpacity>
                  {/* Action buttons OUTSIDE the touchable card area */}
                  <View style={s.actionsRow}>
                    <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#F3E8FF' }]} onPress={() => handleShare(inv)} disabled={sharingId === inv.id}>
                      {sharingId === inv.id ? <ActivityIndicator size="small" color={C.purple} /> : (<><Ionicons name="share-outline" size={16} color={C.purple} /><Text style={[s.actionBtnText, { color: C.purple }]}>PDF</Text></>)}
                    </TouchableOpacity>
                    {inv.status === 'draft' && (
                      <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#EFF6FF' }]} onPress={() => handleAction(inv, 'send')}>
                        <Ionicons name="send" size={16} color="#007AFF" /><Text style={[s.actionBtnText, { color: '#007AFF' }]}>{isEn ? 'Send' : 'Enviar'}</Text>
                      </TouchableOpacity>
                    )}
                    {(inv.status === 'sent' || inv.status === 'overdue') && (
                      <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#E8F9ED' }]} onPress={() => handleAction(inv, 'paid')}>
                        <Ionicons name="checkmark-circle" size={16} color="#34C759" /><Text style={[s.actionBtnText, { color: '#34C759' }]}>{isEn ? 'Paid' : 'Pagada'}</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#FFF1F0' }]} onPress={() => handleAction(inv, 'delete')}>
                      <Ionicons name="trash-outline" size={16} color="#FF3B30" /><Text style={[s.actionBtnText, { color: '#FF3B30' }]}>{isEn ? 'Delete' : 'Borrar'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* FAB */}
      {invoices.length > 0 && (
        <TouchableOpacity style={[s.fab, { bottom: insets.bottom + 20 }]} onPress={openCreate} activeOpacity={0.85}>
          <LinearGradient colors={['#34C759', '#30B350']} style={s.fabInner}><Ionicons name="add" size={28} color="#fff" /></LinearGradient>
        </TouchableOpacity>
      )}

      {/* ====== MODAL: Invoice Form ====== */}
      <Modal visible={activeModal === 'form'} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[s.modalHeader, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity onPress={() => setActiveModal('none')} style={{ padding: 4 }}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
            <Text style={s.modalTitle}>{editingInvoice ? (isEn ? 'Edit Invoice' : 'Editar Factura') : (isEn ? 'New Invoice' : 'Nueva Factura')}</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving} style={[s.saveBtn, saving && { opacity: 0.5 }]}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveBtnText}>{isEn ? 'Save' : 'Guardar'}</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            {/* Client */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={s.sectionLabel}>{isEn ? 'Client' : 'Cliente'}</Text>
              <TouchableOpacity onPress={openClientPicker} style={s.clientPickerBtn}>
                <Ionicons name="people" size={14} color={C.blue} />
                <Text style={{ fontSize: 12, fontWeight: '600', color: C.blue }}>{isEn ? 'My Clients' : 'Mis Clientes'}</Text>
              </TouchableOpacity>
            </View>
            <View style={s.formCard}>
              <TextInput style={s.input} placeholder={isEn ? 'Client Name *' : 'Nombre del Cliente *'} placeholderTextColor={C.muted} value={formData.client_name} onChangeText={v => setFormData(p => ({ ...p, client_name: v }))} />
              <View style={s.divider} />
              <TextInput style={s.input} placeholder="Email" placeholderTextColor={C.muted} value={formData.client_email} onChangeText={v => setFormData(p => ({ ...p, client_email: v }))} keyboardType="email-address" autoCapitalize="none" />
              <View style={s.divider} />
              <TextInput style={s.input} placeholder={isEn ? 'Phone' : 'Teléfono'} placeholderTextColor={C.muted} value={formData.client_phone} onChangeText={v => setFormData(p => ({ ...p, client_phone: v }))} keyboardType="phone-pad" />
            </View>

            {/* Due Date */}
            <Text style={[s.sectionLabel, { marginTop: 20 }]}>{isEn ? 'Due Date' : 'Fecha de Vencimiento'}</Text>
            <TouchableOpacity style={s.dateBtn} onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar" size={20} color={C.blue} />
              <Text style={s.dateBtnText}>{formData.due_date ? fmtDateShort(formData.due_date) : (isEn ? 'Select date' : 'Seleccionar fecha')}</Text>
              <Ionicons name="chevron-forward" size={16} color={C.muted} />
            </TouchableOpacity>
            {showDatePicker && (
              <View style={{ backgroundColor: C.card, borderRadius: 14, marginTop: 8, padding: 8 }}>
                <DateTimePicker value={selectedDate} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onDateChange} minimumDate={new Date()} locale="es" />
                {Platform.OS === 'ios' && (
                  <TouchableOpacity style={s.dateConfirm} onPress={() => { setFormData(p => ({ ...p, due_date: selectedDate.toISOString().split('T')[0] })); setShowDatePicker(false); }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>{isEn ? 'Confirm' : 'Confirmar'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Tax */}
            <Text style={[s.sectionLabel, { marginTop: 20 }]}>{isEn ? 'Tax' : 'Impuesto'}</Text>
            <View style={s.formCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 48 }}>
                <Text style={{ flex: 1, fontSize: 15, color: C.text }}>{isEn ? 'Tax Rate (%)' : 'Tasa (%)'}</Text>
                <TextInput style={{ fontSize: 15, color: C.text, width: 60, textAlign: 'right' }} value={formData.tax_rate} onChangeText={v => setFormData(p => ({ ...p, tax_rate: v }))} keyboardType="decimal-pad" />
              </View>
            </View>

            {/* Items */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 8 }}>
              <Text style={s.sectionLabel}>{isEn ? 'Items' : 'Conceptos'}</Text>
              <TouchableOpacity onPress={addItem} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="add-circle" size={18} color={C.blue} /><Text style={{ fontSize: 13, fontWeight: '600', color: C.blue, marginLeft: 4 }}>{isEn ? 'Add' : 'Agregar'}</Text>
              </TouchableOpacity>
            </View>
            {formData.items.map((item, idx) => (
              <View key={idx} style={[s.formCard, { marginBottom: 8 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TextInput style={[s.input, { flex: 1 }]} placeholder={isEn ? 'Description *' : 'Descripción *'} placeholderTextColor={C.muted} value={item.description} onChangeText={v => updateItem(idx, 'description', v)} />
                  {formData.items.length > 1 && <TouchableOpacity onPress={() => removeItem(idx)} style={{ padding: 10 }}><Ionicons name="close-circle" size={20} color={C.danger} /></TouchableOpacity>}
                </View>
                <View style={s.divider} />
                <View style={{ flexDirection: 'row' }}>
                  <View style={{ flex: 1, borderRightWidth: 1, borderRightColor: C.border }}>
                    <Text style={s.miniLabel}>{isEn ? 'Qty' : 'Cant'}</Text>
                    <TextInput style={[s.input, { paddingTop: 0 }]} value={item.quantity} onChangeText={v => updateItem(idx, 'quantity', v)} keyboardType="decimal-pad" />
                  </View>
                  <View style={{ flex: 1, borderRightWidth: 1, borderRightColor: C.border }}>
                    <Text style={s.miniLabel}>{isEn ? 'Price' : 'Precio'}</Text>
                    <TextInput style={[s.input, { paddingTop: 0 }]} placeholder="$0.00" placeholderTextColor={C.muted} value={item.unit_price} onChangeText={v => updateItem(idx, 'unit_price', v)} keyboardType="decimal-pad" />
                  </View>
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 10 }}>
                    <Text style={s.miniLabel}>Total</Text>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>{fmt((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0))}</Text>
                  </View>
                </View>
              </View>
            ))}

            {/* Totals */}
            <View style={[s.formCard, { marginTop: 12 }]}>
              <View style={s.totalRow}><Text style={s.totalLabel}>Subtotal</Text><Text style={s.totalValue}>{fmt(subtotal)}</Text></View>
              {(parseFloat(formData.tax_rate) || 0) > 0 && <View style={s.totalRow}><Text style={s.totalLabel}>{isEn ? 'Tax' : 'Imp.'} ({formData.tax_rate}%)</Text><Text style={s.totalValue}>{fmt(taxAmt)}</Text></View>}
              <View style={[s.totalRow, { borderTopWidth: 2, borderTopColor: C.text, marginTop: 6, paddingTop: 10 }]}>
                <Text style={[s.totalLabel, { fontSize: 17, fontWeight: '800' }]}>Total</Text>
                <Text style={[s.totalValue, { fontSize: 20, fontWeight: '900', color: C.brand }]}>{fmt(totalAmt)}</Text>
              </View>
            </View>

            {/* Notes */}
            <Text style={[s.sectionLabel, { marginTop: 20 }]}>{isEn ? 'Notes' : 'Notas'}</Text>
            <View style={s.formCard}>
              <TextInput style={[s.input, { height: 80, textAlignVertical: 'top' }]} placeholder={isEn ? 'Payment terms...' : 'Términos de pago...'} placeholderTextColor={C.muted} value={formData.notes} onChangeText={v => setFormData(p => ({ ...p, notes: v }))} multiline />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ====== MODAL: Client Picker ====== */}
      <Modal visible={activeModal === 'clients'} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={[s.modalHeader, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity onPress={goBackToForm} style={{ padding: 4 }}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
            <Text style={s.modalTitle}>{isEn ? 'My Clients' : 'Mis Clientes'}</Text>
            <TouchableOpacity onPress={openNewClientForm} style={[s.saveBtn, { backgroundColor: C.success }]}>
              <Text style={s.saveBtnText}>{isEn ? '+ New' : '+ Nuevo'}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
            <View style={s.searchBox}>
              <Ionicons name="search" size={18} color={C.muted} />
              <TextInput style={s.searchInput} placeholder={isEn ? 'Search...' : 'Buscar...'} placeholderTextColor={C.muted} value={clientSearch} onChangeText={setClientSearch} autoCapitalize="none" />
              {clientSearch ? <TouchableOpacity onPress={() => setClientSearch('')}><Ionicons name="close-circle" size={18} color={C.muted} /></TouchableOpacity> : null}
            </View>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {filteredClients.length === 0 ? (
              <View style={s.emptyState}>
                <Text style={{ fontSize: 36 }}>👤</Text>
                <Text style={s.emptyTitle}>{isEn ? 'No clients' : 'Sin clientes'}</Text>
                <TouchableOpacity style={[s.emptyBtn, { backgroundColor: C.success }]} onPress={openNewClientForm}>
                  <Ionicons name="person-add" size={18} color="#fff" /><Text style={s.emptyBtnText}>{isEn ? 'Add' : 'Agregar'}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              filteredClients.map((c: any) => (
                <TouchableOpacity key={c.id} style={s.clientCard} onPress={() => selectClient(c)} activeOpacity={0.7}>
                  <View style={s.clientAvatar}><Text style={s.clientAvatarText}>{(c.name||'?').charAt(0).toUpperCase()}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.clientName}>{c.name}</Text>
                    {c.email ? <Text style={s.clientSub}>{c.email}</Text> : null}
                    {c.phone ? <Text style={s.clientSub}>{c.phone}</Text> : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.muted} />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ====== MODAL: New Client ====== */}
      <Modal visible={activeModal === 'newClient'} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[s.modalHeader, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity onPress={() => setActiveModal('clients')} style={{ padding: 4 }}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
            <Text style={s.modalTitle}>{isEn ? 'New Client' : 'Nuevo Cliente'}</Text>
            <TouchableOpacity onPress={saveNewClient} disabled={savingClient} style={[s.saveBtn, savingClient && { opacity: 0.5 }]}>
              {savingClient ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveBtnText}>{isEn ? 'Save' : 'Guardar'}</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View style={s.formCard}>
              <TextInput style={s.input} placeholder={isEn ? 'Full Name *' : 'Nombre Completo *'} placeholderTextColor={C.muted} value={newClientData.name} onChangeText={v => setNewClientData(p => ({ ...p, name: v }))} autoCapitalize="words" />
              <View style={s.divider} />
              <TextInput style={s.input} placeholder="Email" placeholderTextColor={C.muted} value={newClientData.email} onChangeText={v => setNewClientData(p => ({ ...p, email: v }))} keyboardType="email-address" autoCapitalize="none" />
              <View style={s.divider} />
              <TextInput style={s.input} placeholder={isEn ? 'Phone' : 'Teléfono'} placeholderTextColor={C.muted} value={newClientData.phone} onChangeText={v => setNewClientData(p => ({ ...p, phone: v }))} keyboardType="phone-pad" />
              <View style={s.divider} />
              <TextInput style={s.input} placeholder={isEn ? 'Business (optional)' : 'Negocio (opcional)'} placeholderTextColor={C.muted} value={newClientData.business_name} onChangeText={v => setNewClientData(p => ({ ...p, business_name: v }))} />
              <View style={s.divider} />
              <TextInput style={s.input} placeholder={isEn ? 'Address (optional)' : 'Dirección (opcional)'} placeholderTextColor={C.muted} value={newClientData.address} onChangeText={v => setNewClientData(p => ({ ...p, address: v }))} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ====== MODAL: Business Profile ====== */}
      <Modal visible={activeModal === 'profile'} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[s.modalHeader, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity onPress={() => setActiveModal('none')} style={{ padding: 4 }}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
            <Text style={s.modalTitle}>{isEn ? 'Business Profile' : 'Perfil de Negocio'}</Text>
            <TouchableOpacity onPress={saveProfile} disabled={savingProfile} style={[s.saveBtn, savingProfile && { opacity: 0.5 }]}>
              {savingProfile ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveBtnText}>{isEn ? 'Save' : 'Guardar'}</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            {/* Logo */}
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              <TouchableOpacity onPress={pickLogo} style={s.logoPicker}>
                {profileForm.business_logo ? <Image source={{ uri: profileForm.business_logo }} style={s.logoImg} resizeMode="contain" /> : (
                  <View style={s.logoPlaceholder}><Ionicons name="camera" size={32} color={C.muted} /><Text style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{isEn ? 'Logo' : 'Logo'}</Text></View>
                )}
              </TouchableOpacity>
              {profileForm.business_logo ? <TouchableOpacity onPress={() => setProfileForm((p: any) => ({ ...p, business_logo: '' }))} style={{ marginTop: 8 }}><Text style={{ fontSize: 13, color: C.danger }}>{isEn ? 'Remove' : 'Eliminar'}</Text></TouchableOpacity> : null}
            </View>

            <Text style={s.sectionLabel}>{isEn ? 'Business Info' : 'Info del Negocio'}</Text>
            <View style={s.formCard}>
              <TextInput style={s.input} placeholder={isEn ? 'Business Name *' : 'Nombre del Negocio *'} placeholderTextColor={C.muted} value={profileForm.business_name} onChangeText={(v: string) => setProfileForm((p: any) => ({ ...p, business_name: v }))} />
              <View style={s.divider} />
              <TextInput style={s.input} placeholder={isEn ? 'Phone' : 'Teléfono'} placeholderTextColor={C.muted} value={profileForm.business_phone} onChangeText={(v: string) => setProfileForm((p: any) => ({ ...p, business_phone: v }))} keyboardType="phone-pad" />
              <View style={s.divider} />
              <TextInput style={[s.input, { height: 60 }]} placeholder={isEn ? 'Address' : 'Dirección'} placeholderTextColor={C.muted} value={profileForm.business_address} onChangeText={(v: string) => setProfileForm((p: any) => ({ ...p, business_address: v }))} multiline />
            </View>

            <Text style={[s.sectionLabel, { marginTop: 20 }]}>{isEn ? 'Defaults' : 'Valores por Defecto'}</Text>
            <View style={s.formCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 48 }}>
                <Text style={{ flex: 1, fontSize: 15, color: C.text }}>{isEn ? 'Tax (%)' : 'Impuesto (%)'}</Text>
                <TextInput style={{ fontSize: 15, color: C.text, width: 60, textAlign: 'right' }} value={String(profileForm.default_tax_rate || '')} onChangeText={(v: string) => setProfileForm((p: any) => ({ ...p, default_tax_rate: parseFloat(v) || 0 }))} keyboardType="decimal-pad" />
              </View>
              <View style={s.divider} />
              <TextInput style={[s.input, { height: 80, textAlignVertical: 'top' }]} placeholder={isEn ? 'Default notes' : 'Notas por defecto'} placeholderTextColor={C.muted} value={profileForm.default_notes} onChangeText={(v: string) => setProfileForm((p: any) => ({ ...p, default_notes: v }))} multiline />
              {!profileForm.default_notes ? (
                <View style={{ paddingHorizontal: 14, paddingBottom: 10 }}>
                  <Text style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>{isEn ? 'Quick:' : 'Rápido:'}</Text>
                  {['Pago a 30 días. Gracias por su preferencia.', 'Pago al recibir la factura.', 'Pago a 15 días. Cargos por mora aplican.'].map((tpl, i) => (
                    <TouchableOpacity key={i} onPress={() => setProfileForm((p: any) => ({ ...p, default_notes: tpl }))} style={{ backgroundColor: C.blueSoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginBottom: 6 }}>
                      <Text style={{ fontSize: 12, color: C.blue }}>{tpl}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>

            {/* Payment Methods */}
            <Text style={[s.sectionLabel, { marginTop: 24 }]}>💰 {isEn ? 'Payment Methods' : 'Métodos de Pago'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, paddingHorizontal: 4 }}>
              <Ionicons name="qr-code" size={14} color={C.purple} style={{ marginTop: 2 }} />
              <Text style={{ flex: 1, fontSize: 12, color: C.sub, marginLeft: 6 }}>{isEn ? 'QR codes and payment info will be added to your invoices' : 'Los QR y datos de pago se agregarán a tus facturas'}</Text>
            </View>

            {PAYMENT_TYPES.map(pt => {
              const existing = (profileForm.payment_methods || []).find((pm: any) => pm.type === pt.id);
              const isCash = pt.id === 'cash';
              return (
                <View key={pt.id} style={[s.formCard, { marginBottom: 10 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: pt.color + '15', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name={pt.icon as any} size={16} color={pt.color} />
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, flex: 1, marginLeft: 10 }}>{pt.label}</Text>
                    {isCash ? (
                      <TouchableOpacity onPress={() => {
                        setProfileForm((p: any) => {
                          const methods = [...(p.payment_methods || [])];
                          const idx = methods.findIndex((pm: any) => pm.type === 'cash');
                          if (idx >= 0) methods.splice(idx, 1);
                          else methods.push({ type: 'cash', handle: 'cash' });
                          return { ...p, payment_methods: methods };
                        });
                      }}>
                        <View style={{ width: 50, height: 28, borderRadius: 14, backgroundColor: existing ? '#059669' : '#D1D5DB', justifyContent: 'center', paddingHorizontal: 3 }}>
                          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignSelf: existing ? 'flex-end' : 'flex-start' }} />
                        </View>
                      </TouchableOpacity>
                    ) : (
                      existing?.handle ? <TouchableOpacity onPress={() => setProfileForm((p: any) => ({ ...p, payment_methods: (p.payment_methods || []).filter((pm: any) => pm.type !== pt.id) }))}><Ionicons name="close-circle" size={20} color={C.danger} /></TouchableOpacity> : null
                    )}
                  </View>
                  {!isCash && (
                    <>
                      <View style={s.divider} />
                      <TextInput
                        style={s.input}
                        placeholder={pt.placeholder}
                        placeholderTextColor={C.muted}
                        value={existing?.handle || ''}
                        onChangeText={(v: string) => {
                          setProfileForm((p: any) => {
                            const methods = [...(p.payment_methods || [])];
                            const idx = methods.findIndex((pm: any) => pm.type === pt.id);
                            if (idx >= 0) { if (v.trim()) methods[idx] = { ...methods[idx], handle: v }; else methods.splice(idx, 1); }
                            else if (v.trim()) methods.push({ type: pt.id, handle: v });
                            return { ...p, payment_methods: methods };
                          });
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  headerGrad: {},
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  profileBanner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },
  profileLogo: { width: 36, height: 36, borderRadius: 10 },
  profileName: { fontSize: 14, fontWeight: '700', color: '#fff', marginLeft: 12 },
  profileSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginLeft: 12, marginTop: 1 },
  setupBanner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: 'rgba(251,191,36,0.1)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)' },
  setupText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#FBBF24', marginLeft: 10 },
  statPill: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 10, alignItems: 'center' },
  statLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' },
  statValue: { fontSize: 16, fontWeight: '800', marginTop: 4 },
  filterBar: { backgroundColor: C.card, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, flexGrow: 0, maxHeight: 56 },
  filterTab: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: C.bg, minWidth: 70, alignItems: 'center' },
  filterTabActive: { backgroundColor: C.brand },
  filterTabText: { fontSize: 14, fontWeight: '600', color: C.sub },
  filterTabTextActive: { color: '#fff' },
  invoiceCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 10, ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 2 } }) },
  invNumber: { fontSize: 13, fontWeight: '700', color: C.blue },
  invClient: { fontSize: 16, fontWeight: '700', color: C.text, marginTop: 2 },
  invTotal: { fontSize: 20, fontWeight: '800', color: C.text },
  invDate: { fontSize: 12, color: C.sub },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '700', marginLeft: 4 },
  actionsRow: { flexDirection: 'row', marginTop: 14, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 14 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, marginRight: 8, minHeight: 44 },
  actionBtnText: { fontSize: 13, fontWeight: '700', marginLeft: 6 },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginTop: 12 },
  emptySub: { fontSize: 14, color: C.sub, marginTop: 6 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.brand, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, marginTop: 20 },
  emptyBtnText: { fontSize: 15, fontWeight: '700', color: '#fff', marginLeft: 8 },
  fab: { position: 'absolute', right: 20, zIndex: 10 },
  fabInner: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 6 } }) },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#0A1628' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  saveBtn: { backgroundColor: C.brand, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10 },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 },
  formCard: { backgroundColor: C.card, borderRadius: 14, overflow: 'hidden', ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6 }, android: { elevation: 1 } }) },
  input: { height: 48, paddingHorizontal: 14, fontSize: 15, color: C.text },
  divider: { height: 1, backgroundColor: C.border, marginLeft: 14 },
  miniLabel: { fontSize: 10, fontWeight: '600', color: C.muted, textTransform: 'uppercase', paddingHorizontal: 14, paddingTop: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 6 },
  totalLabel: { fontSize: 14, color: C.sub },
  totalValue: { fontSize: 14, fontWeight: '700', color: C.text },
  clientPickerBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, backgroundColor: C.blueSoft, borderRadius: 8 },
  dateBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6 }, android: { elevation: 1 } }) },
  dateBtnText: { flex: 1, fontSize: 15, fontWeight: '500', color: C.text, marginLeft: 12 },
  dateConfirm: { alignSelf: 'flex-end', backgroundColor: C.blue, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 8 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 14, height: 44, borderWidth: 1, borderColor: C.border },
  searchInput: { flex: 1, fontSize: 15, color: C.text, marginLeft: 10 },
  clientCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 8, ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6 }, android: { elevation: 1 } }) },
  clientAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center' },
  clientAvatarText: { fontSize: 18, fontWeight: '700', color: C.blue },
  clientName: { fontSize: 15, fontWeight: '600', color: C.text },
  clientSub: { fontSize: 13, color: C.sub, marginTop: 1 },
  logoPicker: { width: 160, height: 120, borderRadius: 16, overflow: 'hidden', backgroundColor: '#F8F9FA' },
  logoImg: { width: 160, height: 120, borderRadius: 16 },
  logoPlaceholder: { width: 160, height: 120, borderRadius: 16, borderWidth: 2, borderColor: C.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
});
