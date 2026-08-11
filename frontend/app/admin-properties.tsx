import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal,
  RefreshControl, ActivityIndicator, ScrollView, Alert, Platform, KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiCall } from '../src/utils/api';
import { useColors, Spacing, FontSizes, BorderRadius } from '../src/constants/theme';
import { formatCurrency } from '../src/utils/formatters';

interface Property {
  _id: string;
  property_number?: string;
  name: string;
  address: string;
  city?: string;
  zip_code?: string;
  bedrooms?: number;
  bathrooms?: number;
  square_feet?: number;
  rent_amount?: number;
  deposit_amount?: number;
  status: string;
  notes?: string;
  section8_accepted?: boolean;
  tenant_info?: { name?: string } | null;
}

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  available: { label: 'Disponible', color: '#10B981', icon: 'checkmark-circle-outline' },
  rented: { label: 'Rentada', color: '#3B82F6', icon: 'people-outline' },
  maintenance: { label: 'Mantenimiento', color: '#F59E0B', icon: 'construct-outline' },
};
const STATUS_ORDER = ['available', 'rented', 'maintenance'];

const EMPTY_FORM = {
  name: '', address: '', city: 'Dumas', zip_code: '', bedrooms: '3', bathrooms: '2',
  square_feet: '', rent_amount: '', deposit_amount: '', notes: '', status: 'available',
};

const confirmDialog = (title: string, msg: string, onOk: () => void) => {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n${msg}`)) onOk();
  } else {
    Alert.alert(title, msg, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', style: 'destructive', onPress: onOk },
    ]);
  }
};

const notify = (title: string, msg: string) => {
  if (Platform.OS === 'web') window.alert(`${title}\n${msg}`);
  else Alert.alert(title, msg);
};

export default function AdminPropertiesScreen({ embedded }: { embedded?: boolean }) {
  const Colors = useColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [props, setProps] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Form modal
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchProps = useCallback(async () => {
    try {
      const d: any = await apiCall('/admin/properties');
      setProps(d?.properties || []);
    } catch (e) { console.log('props error', e); }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchProps(); }, [fetchProps]);

  const changeStatus = async (p: Property, status: string) => {
    if (p.status === status) return;
    setBusyId(p._id);
    try {
      const d: any = await apiCall(`/admin/properties/${p._id}`, { method: 'PUT', body: { status } });
      if (d?.success !== false) {
        setProps(prev => prev.map(x => (x._id === p._id ? { ...x, status } : x)));
      } else notify('Error', d?.detail || 'No se pudo cambiar el estado');
    } catch (e: any) { notify('Error', e?.message || 'No se pudo cambiar el estado'); }
    setBusyId(null);
  };

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (p: Property) => {
    setEditing(p);
    setForm({
      name: p.name || '', address: p.address || '', city: p.city || '',
      zip_code: p.zip_code || '', bedrooms: String(p.bedrooms ?? ''),
      bathrooms: String(p.bathrooms ?? ''), square_feet: String(p.square_feet || ''),
      rent_amount: String(p.rent_amount || ''), deposit_amount: String(p.deposit_amount || ''),
      notes: p.notes || '', status: p.status || 'available',
    });
    setShowForm(true);
  };

  const saveForm = async () => {
    if (!form.name.trim() || !form.address.trim() || !(parseFloat(form.rent_amount) > 0)) {
      notify('Faltan datos', 'Nombre, dirección y renta son requeridos');
      return;
    }
    setSaving(true);
    const body = {
      name: form.name.trim(), address: form.address.trim(), city: form.city.trim(),
      zip_code: form.zip_code.trim(),
      bedrooms: parseInt(form.bedrooms) || 0, bathrooms: parseFloat(form.bathrooms) || 0,
      square_feet: parseInt(form.square_feet) || 0,
      rent_amount: parseFloat(form.rent_amount) || 0,
      deposit_amount: parseFloat(form.deposit_amount) || 0,
      notes: form.notes, status: form.status,
    };
    try {
      const d: any = editing
        ? await apiCall(`/admin/properties/${editing._id}`, { method: 'PUT', body })
        : await apiCall('/admin/properties', { method: 'POST', body });
      if (d?.success !== false) {
        setShowForm(false);
        setLoading(true);
        fetchProps();
        notify(editing ? '✅ Propiedad actualizada' : '✅ Propiedad creada',
          editing ? form.name : (d?.message || form.name));
      } else notify('Error', d?.detail || 'No se pudo guardar');
    } catch (e: any) { notify('Error', e?.message || 'No se pudo guardar'); }
    setSaving(false);
  };

  const deleteProp = (p: Property) => {
    confirmDialog('Eliminar propiedad', `¿Eliminar "${p.name}" permanentemente?`, async () => {
      setBusyId(p._id);
      try {
        const d: any = await apiCall(`/admin/properties/${p._id}`, { method: 'DELETE' });
        if (d?.success !== false) setProps(prev => prev.filter(x => x._id !== p._id));
        else notify('Error', d?.detail || 'No se pudo eliminar');
      } catch (e: any) { notify('Error', e?.message || 'No se pudo eliminar'); }
      setBusyId(null);
    });
  };

  const filtered = props.filter(p => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (!search) return true;
    return `${p.name} ${p.address} ${p.city}`.toLowerCase().includes(search.toLowerCase());
  });

  const field = (label: string, k: keyof typeof EMPTY_FORM, opts?: { numeric?: boolean; flex?: number; placeholder?: string; multiline?: boolean }) => (
    <View style={{ flex: opts?.flex ?? 1 }}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        style={[styles.formInput, opts?.multiline && { height: 70, textAlignVertical: 'top' }]}
        value={form[k]}
        onChangeText={v => setForm(f => ({ ...f, [k]: v }))}
        keyboardType={opts?.numeric ? 'numeric' : 'default'}
        placeholder={opts?.placeholder}
        placeholderTextColor={Colors.textMuted}
        multiline={opts?.multiline}
      />
    </View>
  );

  const renderProp = ({ item }: { item: Property }) => {
    const meta = STATUS_META[item.status] || STATUS_META.available;
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
              {item.section8_accepted && <Text style={styles.s8Badge}>S8</Text>}
            </View>
            <Text style={styles.cardAddr} numberOfLines={1}>
              <Ionicons name="location-outline" size={11} color={Colors.textMuted} /> {item.address}{item.city ? `, ${item.city}` : ''}
            </Text>
            <View style={styles.specRow}>
              <Text style={styles.spec}>🛏 {item.bedrooms || 0}</Text>
              <Text style={styles.spec}>🛁 {item.bathrooms || 0}</Text>
              {item.square_feet ? <Text style={styles.spec}>📐 {item.square_feet} ft²</Text> : null}
              <Text style={styles.rent}>{formatCurrency(item.rent_amount || 0)}/mes</Text>
            </View>
          </View>
          <View style={styles.cardActions}>
            <TouchableOpacity onPress={() => openEdit(item)} style={styles.iconBtn}>
              <Ionicons name="create-outline" size={17} color="#22D3EE" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteProp(item)} style={styles.iconBtn}>
              <Ionicons name="trash-outline" size={16} color="#F87171" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Gestión de estado */}
        <View style={styles.statusRow}>
          {STATUS_ORDER.map(s => {
            const m = STATUS_META[s];
            const active = item.status === s;
            return (
              <TouchableOpacity
                key={s}
                disabled={busyId === item._id || active}
                onPress={() => changeStatus(item, s)}
                style={[styles.statusChip, active && { backgroundColor: `${m.color}22`, borderColor: `${m.color}66` }]}
              >
                <Ionicons name={m.icon} size={12} color={active ? m.color : Colors.textMuted} />
                <Text style={[styles.statusChipText, active && { color: m.color, fontWeight: '800' }]}>{m.label}</Text>
              </TouchableOpacity>
            );
          })}
          {busyId === item._id && <ActivityIndicator size="small" color={Colors.textMuted} />}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        {!embedded && (
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Propiedades</Text>
          <Text style={styles.headerSubtitle}>{props.length} en gestión</Text>
        </View>
        <TouchableOpacity onPress={openCreate} style={styles.addBtn}>
          <Ionicons name="add" size={20} color="#0A0F1E" />
          <Text style={styles.addText}>Nueva</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar propiedad…"
          placeholderTextColor={Colors.textMuted}
        />
      </View>

      {/* Status filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 8 }} contentContainerStyle={styles.chipsRow}>
        <TouchableOpacity onPress={() => setStatusFilter('')} style={[styles.filterChip, statusFilter === '' && styles.filterChipActive]}>
          <Text style={[styles.filterText, statusFilter === '' && styles.filterTextActive]}>Todas ({props.length})</Text>
        </TouchableOpacity>
        {STATUS_ORDER.map(s => {
          const m = STATUS_META[s];
          const count = props.filter(p => p.status === s).length;
          const active = statusFilter === s;
          return (
            <TouchableOpacity key={s} onPress={() => setStatusFilter(active ? '' : s)}
              style={[styles.filterChip, active && { backgroundColor: `${m.color}22`, borderColor: `${m.color}66` }]}>
              <Text style={[styles.filterText, active && { color: m.color, fontWeight: '800' }]}>{m.label} ({count})</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#22D3EE" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={p => p._id}
          renderItem={renderProp}
          contentContainerStyle={{ paddingHorizontal: Spacing.base, paddingBottom: embedded ? 120 : 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProps(); }} tintColor="#22D3EE" />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="home-outline" size={44} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No hay propiedades</Text>
            </View>
          }
        />
      )}

      {/* ── Modal Crear/Editar ── */}
      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? '✏️ Editar propiedad' : '➕ Nueva propiedad'}</Text>
              <TouchableOpacity onPress={() => setShowForm(false)} style={styles.iconBtn}>
                <Ionicons name="close" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.formGap}>{field('Nombre *', 'name', { placeholder: 'Ej: 812 NE 2nd' })}</View>
              <View style={styles.formGap}>{field('Dirección *', 'address', { placeholder: '812 NE 2nd St' })}</View>
              <View style={[styles.formRow, styles.formGap]}>
                {field('Ciudad', 'city')}
                {field('ZIP', 'zip_code', { numeric: true })}
              </View>
              <View style={[styles.formRow, styles.formGap]}>
                {field('Recámaras', 'bedrooms', { numeric: true })}
                {field('Baños', 'bathrooms', { numeric: true })}
                {field('ft²', 'square_feet', { numeric: true })}
              </View>
              <View style={[styles.formRow, styles.formGap]}>
                {field('Renta $/mes *', 'rent_amount', { numeric: true })}
                {field('Depósito $', 'deposit_amount', { numeric: true })}
              </View>
              <View style={styles.formGap}>
                <Text style={styles.formLabel}>Estado</Text>
                <View style={styles.statusRow}>
                  {STATUS_ORDER.map(s => {
                    const m = STATUS_META[s];
                    const active = form.status === s;
                    return (
                      <TouchableOpacity key={s} onPress={() => setForm(f => ({ ...f, status: s }))}
                        style={[styles.statusChip, active && { backgroundColor: `${m.color}22`, borderColor: `${m.color}66` }]}>
                        <Text style={[styles.statusChipText, active && { color: m.color, fontWeight: '800' }]}>{m.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View style={styles.formGap}>{field('Notas', 'notes', { multiline: true })}</View>
              <TouchableOpacity onPress={saveForm} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.6 }]}>
                {saving ? <ActivityIndicator size="small" color="#0A0F1E" /> : <Ionicons name="save-outline" size={17} color="#0A0F1E" />}
                <Text style={styles.saveText}>{editing ? 'Guardar cambios' : 'Crear propiedad'}</Text>
              </TouchableOpacity>
              <Text style={styles.formHint}>Fotos, Section 8 y dueño se gestionan desde el panel web</Text>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.base, paddingVertical: Spacing.md },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.glassLight,
    borderWidth: 1, borderColor: Colors.glassBorderLight, justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: FontSizes['2xl'], fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  headerSubtitle: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 1 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#22D3EE',
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12,
  },
  addText: { fontSize: 13, fontWeight: '800', color: '#0A0F1E' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: Spacing.base, marginBottom: 8,
    paddingHorizontal: 12, borderRadius: 12, backgroundColor: Colors.glass,
    borderWidth: 1, borderColor: Colors.glassBorderLight,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: FontSizes.sm, color: Colors.textPrimary },
  chipsRow: { gap: 8, paddingHorizontal: Spacing.base },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: BorderRadius.full,
    backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorderLight,
  },
  filterChipActive: { backgroundColor: 'rgba(34,211,238,0.15)', borderColor: 'rgba(34,211,238,0.45)' },
  filterText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  filterTextActive: { color: '#22D3EE', fontWeight: '800' },

  card: {
    backgroundColor: Colors.glass, borderRadius: BorderRadius.card,
    borderWidth: 1, borderColor: Colors.glassBorder, padding: 14, marginBottom: 10,
  },
  cardTop: { flexDirection: 'row', gap: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardName: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.textPrimary, flexShrink: 1 },
  s8Badge: {
    fontSize: 9, fontWeight: '800', color: '#34D399', backgroundColor: 'rgba(16,185,129,0.15)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, overflow: 'hidden',
  },
  cardAddr: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 2 },
  specRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' },
  spec: { fontSize: 11, color: Colors.textSecondary },
  rent: { fontSize: FontSizes.sm, fontWeight: '800', color: '#22D3EE' },
  cardActions: { flexDirection: 'row', gap: 4 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.glassLight,
    justifyContent: 'center', alignItems: 'center',
  },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.glassBorderLight,
    backgroundColor: Colors.glass, minHeight: 32,
  },
  statusChipText: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },

  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontSize: FontSizes.sm, color: Colors.textMuted },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: {
    maxHeight: '88%', backgroundColor: '#0D1220', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 18, borderWidth: 1, borderColor: Colors.glassBorderLight,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { fontSize: FontSizes.lg, fontWeight: '800', color: Colors.textPrimary },
  formRow: { flexDirection: 'row', gap: 10 },
  formGap: { marginBottom: 12 },
  formLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', marginBottom: 5, letterSpacing: 0.5 },
  formInput: {
    backgroundColor: Colors.glassLight, borderWidth: 1, borderColor: Colors.glassBorderLight,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: FontSizes.sm, color: Colors.textPrimary,
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#22D3EE', borderRadius: 14, paddingVertical: 14, marginTop: 4,
  },
  saveText: { fontSize: FontSizes.md, fontWeight: '800', color: '#0A0F1E' },
  formHint: { fontSize: 10, color: Colors.textMuted, textAlign: 'center', marginTop: 10, fontStyle: 'italic' },
});
