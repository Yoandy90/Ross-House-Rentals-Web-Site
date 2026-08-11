import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../constants/theme';
import { BlurView } from 'expo-blur';

interface Filters {
  min_price: string; max_price: string; beds: string; baths: string; property_type: string;
}

interface Props {
  visible: boolean;
  filters: Filters;
  onApply: (f: Filters) => void;
  onClose: () => void;
}

const PRICE_RANGES = [
  { label: 'Hasta $100K', min: '', max: '100000' },
  { label: '$100K–$200K', min: '100000', max: '200000' },
  { label: '$200K–$350K', min: '200000', max: '350000' },
  { label: '$350K–$500K', min: '350000', max: '500000' },
  { label: '$500K+', min: '500000', max: '' },
];

const BED_OPTIONS = ['', '1', '2', '3', '4', '5'];
const BATH_OPTIONS = ['', '1', '2', '3', '4'];
const TYPES = [
  { value: '', label: 'Todos' },
  { value: 'single_family', label: 'Unifamiliar' },
  { value: 'multi_family', label: 'Multi-familiar' },
  { value: 'condo', label: 'Condominio' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'land', label: 'Terreno' },
  { value: 'mobile', label: 'Casa Móvil' },
  { value: 'farm', label: 'Rancho/Finca' },
];

export default function FilterSheet({ visible, filters, onApply, onClose }: Props) {
  const Colors = useColors();
  const styles = React.useMemo(() => create_styles(Colors), [Colors]);
  const [local, setLocal] = useState<Filters>(filters);

  // Sync local state when modal opens or filters change
  useEffect(() => {
    if (visible) {
      setLocal(filters);
    }
  }, [visible, filters]);

  const Chip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
    <TouchableOpacity onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <BlurView intensity={40} style={styles.blur}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.title}>Filtros</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              {/* Price Range */}
              <Text style={styles.label}>Rango de Precio</Text>
              <View style={styles.chipRow}>
                {PRICE_RANGES.map(p => (
                  <Chip key={p.label} label={p.label}
                    active={local.min_price === p.min && local.max_price === p.max}
                    onPress={() => setLocal({ ...local, min_price: p.min, max_price: p.max })} />
                ))}
              </View>

              {/* Beds */}
              <Text style={styles.label}>Habitaciones</Text>
              <View style={styles.chipRow}>
                {BED_OPTIONS.map(b => (
                  <Chip key={b || 'all'} label={b ? `${b}+` : 'Todas'}
                    active={local.beds === b}
                    onPress={() => setLocal({ ...local, beds: b })} />
                ))}
              </View>

              {/* Baths */}
              <Text style={styles.label}>Baños</Text>
              <View style={styles.chipRow}>
                {BATH_OPTIONS.map(b => (
                  <Chip key={b || 'all'} label={b ? `${b}+` : 'Todos'}
                    active={local.baths === b}
                    onPress={() => setLocal({ ...local, baths: b })} />
                ))}
              </View>

              {/* Type */}
              <Text style={styles.label}>Tipo de Propiedad</Text>
              <View style={styles.chipRow}>
                {TYPES.map(t => (
                  <Chip key={t.value || 'all'} label={t.label}
                    active={local.property_type === t.value}
                    onPress={() => setLocal({ ...local, property_type: t.value })} />
                ))}
              </View>
            </ScrollView>

            <View style={styles.actions}>
              <TouchableOpacity style={styles.clearBtn}
                onPress={() => setLocal({ min_price: '', max_price: '', beds: '', baths: '', property_type: '' })}>
                <Text style={styles.clearText}>Limpiar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn}
                onPress={() => { onApply(local); onClose(); }}>
                <Text style={styles.applyText}>Aplicar Filtros</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
}

const create_styles = (Colors: any) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  blur: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: 'rgba(20,20,22,0.97)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: '80%',
    borderTopWidth: 1,
    borderColor: Colors.glassBorderLight,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: { color: Colors.textPrimary, fontSize: 20, fontWeight: '800' },
  label: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 20,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: Colors.glassLight,
    borderWidth: 1,
    borderColor: Colors.glassBorderLight,
  },
  chipActive: {
    backgroundColor: 'rgba(237,27,51,0.15)',
    borderColor: Colors.brandRed,
  },
  chipText: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: Colors.brandRed },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  clearBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: Colors.glassLight,
    alignItems: 'center',
  },
  clearText: { color: Colors.textMuted, fontWeight: '700', fontSize: 14 },
  applyBtn: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: Colors.brandRed,
    alignItems: 'center',
  },
  applyText: { color: Colors.textPrimary, fontWeight: '800', fontSize: 14 },
});
