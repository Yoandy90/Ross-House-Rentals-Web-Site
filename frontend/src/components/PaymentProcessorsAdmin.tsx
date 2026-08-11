import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, Spacing, FontSizes, BorderRadius } from '../constants/theme';
import { apiCall } from '../utils/api';

type ProcName = 'stripe' | 'square' | 'clover';
type Env = 'sandbox' | 'production';

const META: Record<ProcName, { label: string; color: string; desc: string }> = {
  stripe: { label: 'Stripe', color: '#8B5CF6', desc: 'Tarjetas, ACH y Payment Links' },
  square: { label: 'Square', color: '#10B981', desc: 'Checkout hospedado de Square' },
  clover: { label: 'Clover', color: '#F59E0B', desc: 'Hosted Checkout de Clover' },
};

const FIELDS: Record<ProcName, { key: string; label: string; secret?: boolean }[]> = {
  stripe: [
    { key: 'publishable_key', label: 'Publishable Key' },
    { key: 'secret_key', label: 'Secret Key', secret: true },
    { key: 'webhook_secret', label: 'Webhook Secret', secret: true },
  ],
  square: [
    { key: 'application_id', label: 'Application ID' },
    { key: 'access_token', label: 'Access Token', secret: true },
    { key: 'location_id', label: 'Location ID' },
    { key: 'webhook_signature_key', label: 'Webhook Signature Key', secret: true },
  ],
  clover: [
    { key: 'merchant_id', label: 'Merchant ID' },
    { key: 'private_key', label: 'Private Key / API Token', secret: true },
    { key: 'webhook_signing_secret', label: 'Webhook Signing Secret', secret: true },
  ],
};

export default function PaymentProcessorsAdmin() {
  const Colors = useColors();
  const styles = React.useMemo(() => create_styles(Colors), [Colors]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<ProcName | null>(null);
  // forms[proc][env][field]
  const [forms, setForms] = useState<any>({});
  // pestaña de credenciales que se edita por procesador
  const [editEnv, setEditEnv] = useState<Record<ProcName, Env>>({
    stripe: 'production', square: 'sandbox', clover: 'sandbox',
  });
  const [busy, setBusy] = useState('');

  const applyData = (d: any) => {
    setData(d);
    const f: any = {};
    (Object.keys(FIELDS) as ProcName[]).forEach(p => {
      f[p] = { sandbox: {}, production: {} };
      (['sandbox', 'production'] as Env[]).forEach(env => {
        FIELDS[p].forEach(field => {
          if (!field.secret) f[p][env][field.key] = d.processors?.[p]?.credentials?.[env]?.[field.key] || '';
        });
      });
    });
    setForms(f);
  };

  const load = useCallback(async () => {
    try {
      const d = await apiCall('/admin/payment-processors');
      applyData(d);
      setEditEnv({
        stripe: d.processors?.stripe?.environment || 'production',
        square: d.processors?.square?.environment || 'sandbox',
        clover: d.processors?.clover?.environment || 'sandbox',
      });
    } catch (e) {
      console.log('Error loading processors:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setField = (p: ProcName, env: Env, key: string, val: string) =>
    setForms((prev: any) => ({
      ...prev, [p]: { ...prev[p], [env]: { ...prev[p]?.[env], [key]: val } },
    }));

  const save = async (p: ProcName) => {
    const env = editEnv[p];
    setBusy(`save-${p}`);
    try {
      const body: Record<string, string> = { environment: env };
      Object.entries(forms[p]?.[env] || {}).forEach(([k, v]) => { if (v) body[k] = v as string; });
      const d = await apiCall(`/admin/payment-processors/${p}`, { method: 'PUT', body });
      applyData(d);
      setForms((prev: any) => {
        const n = { ...prev, [p]: { ...prev[p], [env]: { ...prev[p][env] } } };
        FIELDS[p].forEach(f => { if (f.secret) n[p][env][f.key] = ''; });
        return n;
      });
      Alert.alert('✓ Guardado', d.message || `Credenciales de ${META[p].label} guardadas`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo guardar');
    }
    setBusy('');
  };

  const test = async (p: ProcName) => {
    setBusy(`test-${p}`);
    try {
      const d = await apiCall(`/admin/payment-processors/${p}/test`, { method: 'POST' });
      if (d.success) Alert.alert('✓ Conexión exitosa', d.detail || '');
      else Alert.alert('Falló la conexión', d.error || '');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Error de red');
    }
    setBusy('');
  };

  const switchEnv = async (p: ProcName, env: Env) => {
    setBusy(`env-${p}`);
    try {
      const d = await apiCall(`/admin/payment-processors/${p}/environment`, {
        method: 'POST', body: { environment: env },
      });
      applyData(d);
      Alert.alert('✓ Entorno cambiado', d.message || '');
    } catch (e: any) {
      Alert.alert('No se pudo cambiar', e?.message || 'Guarda primero las credenciales de ese entorno');
    }
    setBusy('');
  };

  const toggle3ds = async (p: 'stripe' | 'square', enabled: boolean) => {
    setBusy(`3ds-${p}`);
    try {
      const d = await apiCall('/admin/payment-processors-3ds', {
        method: 'PUT', body: { processor: p, enabled },
      });
      applyData(d);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo actualizar 3DS');
    }
    setBusy('');
  };

  const activate = (p: ProcName) => {
    Alert.alert(
      `Activar ${META[p].label}`,
      `Todos los cobros nuevos (app y web) se procesarán con ${META[p].label}. ¿Continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Activar',
          onPress: async () => {
            setBusy(`act-${p}`);
            try {
              const d = await apiCall(`/admin/payment-processors/${p}/activate`, { method: 'POST' });
              applyData(d);
              Alert.alert('✓ Activado', d.message || `${META[p].label} es ahora el procesador activo`);
            } catch (e: any) {
              Alert.alert('No se pudo activar', e?.message || 'Verifica las credenciales');
            }
            setBusy('');
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.group}>
        <ActivityIndicator size="small" color={Colors.brandRed} style={{ padding: 20 }} />
      </View>
    );
  }

  const active = data?.active_processor || 'stripe';
  const threeDs = data?.three_ds || { stripe: true, square: true };

  return (
    <View style={styles.group}>
      {/* ═══ 3D Secure ═══ */}
      <View style={styles.procCard}>
        <View style={styles.procHeader}>
          <View style={[styles.procIcon, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
            <Ionicons name="shield-checkmark" size={18} color={Colors.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.procName}>3D Secure (obligatorio)</Text>
            <Text style={styles.procDesc}>La responsabilidad por fraude pasa al banco emisor</Text>
          </View>
        </View>
        <View style={styles.tdsBody}>
          {(['stripe', 'square'] as const).map(p => (
            <View key={p} style={styles.tdsRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.tdsName}>{META[p].label}</Text>
                <Text style={styles.procDesc}>
                  {threeDs[p] ? '3DS obligatorio en todos los cobros' : '3DS desactivado (no recomendado)'}
                </Text>
              </View>
              <Switch
                value={!!threeDs[p]}
                onValueChange={v => toggle3ds(p, v)}
                disabled={busy === `3ds-${p}`}
                trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(16,185,129,0.5)' }}
                thumbColor={threeDs[p] ? Colors.success : '#9CA3AF'}
              />
            </View>
          ))}
        </View>
      </View>

      {/* ═══ Procesadores ═══ */}
      {(Object.keys(META) as ProcName[]).map(p => {
        const meta = META[p];
        const proc = data?.processors?.[p] || {};
        const activeEnv: Env = proc.environment || 'sandbox';
        const env = editEnv[p];
        const envCreds = proc.credentials?.[env] || {};
        const isActive = active === p;
        const isOpen = expanded === p;
        return (
          <View key={p} style={[styles.procCard, isActive && styles.procCardActive]}>
            <TouchableOpacity
              style={styles.procHeader}
              onPress={() => setExpanded(isOpen ? null : p)}
              activeOpacity={0.7}
            >
              <View style={[styles.procIcon, { backgroundColor: `${meta.color}18` }]}>
                <Ionicons name="card" size={18} color={meta.color} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.procTitleRow}>
                  <Text style={styles.procName}>{meta.label}</Text>
                  {isActive && (
                    <View style={styles.activeBadge}>
                      <Ionicons name="checkmark-circle" size={11} color={Colors.success} />
                      <Text style={styles.activeBadgeText}>ACTIVO</Text>
                    </View>
                  )}
                  <View style={[styles.envBadge, activeEnv === 'production' ? styles.envBadgeProd : styles.envBadgeSbx]}>
                    <Text style={[styles.envBadgeText, { color: activeEnv === 'production' ? '#60A5FA' : '#FBBF24' }]}>
                      {activeEnv === 'production' ? 'PRODUCCIÓN' : 'SANDBOX'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.procDesc}>{meta.desc}</Text>
              </View>
              <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
            </TouchableOpacity>

            {isOpen && (
              <View style={styles.procBody}>
                {/* Pestañas de entorno para editar credenciales */}
                <View style={styles.envTabs}>
                  {(['sandbox', 'production'] as Env[]).map(e => (
                    <TouchableOpacity
                      key={e}
                      style={[styles.envTab, env === e && styles.envTabOn]}
                      onPress={() => setEditEnv(prev => ({ ...prev, [p]: e }))}
                    >
                      <Text style={[styles.envTabText, env === e && styles.envTabTextOn]}>
                        {e === 'production' ? 'Producción' : 'Sandbox'}
                        {proc.credentials?.[e]?.configured ? ' ✓' : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {FIELDS[p].map(field => (
                  <View key={field.key} style={styles.fieldWrap}>
                    <Text style={styles.fieldLabel}>
                      {field.label}
                      {field.secret && envCreds[`has_${field.key}`] ? `  ✓ ${envCreds[`${field.key}_masked`]}` : ''}
                    </Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={forms[p]?.[env]?.[field.key] || ''}
                      onChangeText={v => setField(p, env, field.key, v)}
                      placeholder={field.secret && envCreds[`has_${field.key}`] ? 'Dejar vacío para no cambiar' : field.label}
                      placeholderTextColor={Colors.textDim}
                      secureTextEntry={!!field.secret}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                ))}

                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { borderColor: `${meta.color}40`, backgroundColor: `${meta.color}12` }]}
                    onPress={() => save(p)}
                    disabled={busy === `save-${p}`}
                  >
                    {busy === `save-${p}`
                      ? <ActivityIndicator size="small" color={meta.color} />
                      : <Text style={[styles.actionBtnText, { color: meta.color }]}>Guardar</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => test(p)}
                    disabled={busy === `test-${p}`}
                  >
                    {busy === `test-${p}`
                      ? <ActivityIndicator size="small" color={Colors.textSecondary} />
                      : <Text style={styles.actionBtnText}>Probar</Text>}
                  </TouchableOpacity>
                  {!isActive && (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.activateBtn, !proc.configured && { opacity: 0.4 }]}
                      onPress={() => activate(p)}
                      disabled={busy === `act-${p}` || !proc.configured}
                    >
                      {busy === `act-${p}`
                        ? <ActivityIndicator size="small" color={Colors.success} />
                        : <Text style={[styles.actionBtnText, { color: Colors.success }]}>Activar</Text>}
                    </TouchableOpacity>
                  )}
                </View>

                {/* Cambiar entorno activo del procesador */}
                <TouchableOpacity
                  style={styles.envSwitchBtn}
                  onPress={() => switchEnv(p, activeEnv === 'production' ? 'sandbox' : 'production')}
                  disabled={busy === `env-${p}`}
                >
                  {busy === `env-${p}`
                    ? <ActivityIndicator size="small" color={Colors.textSecondary} />
                    : (
                      <Text style={styles.actionBtnText}>
                        {activeEnv === 'production' ? '🧪 Cambiar a Sandbox' : '🚀 Cambiar a Producción'}
                      </Text>
                    )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const create_styles = (Colors: any) => StyleSheet.create({
  group: { gap: 10, marginBottom: Spacing.lg },
  procCard: {
    backgroundColor: Colors.glass,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    overflow: 'hidden',
  },
  procCardActive: { borderColor: 'rgba(16,185,129,0.4)' },
  procHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: Spacing.base,
  },
  procIcon: {
    width: 38, height: 38, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  procTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  procName: { fontSize: FontSizes.base, fontWeight: '700', color: Colors.textPrimary },
  procDesc: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 1 },
  activeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(16,185,129,0.12)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)',
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: BorderRadius.full,
  },
  activeBadgeText: { fontSize: 9, fontWeight: '800', color: Colors.success, letterSpacing: 0.5 },
  envBadge: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: BorderRadius.full, borderWidth: 1,
  },
  envBadgeProd: { backgroundColor: 'rgba(59,130,246,0.12)', borderColor: 'rgba(59,130,246,0.3)' },
  envBadgeSbx: { backgroundColor: 'rgba(245,158,11,0.10)', borderColor: 'rgba(245,158,11,0.28)' },
  envBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  tdsBody: {
    paddingHorizontal: Spacing.base, paddingBottom: Spacing.base, gap: 8,
    borderTopWidth: 1, borderTopColor: Colors.glassLight, paddingTop: Spacing.md,
  },
  tdsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.glass,
    borderWidth: 1, borderColor: Colors.glassBorder,
    borderRadius: BorderRadius.md, paddingHorizontal: 12, paddingVertical: 8,
  },
  tdsName: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.textPrimary },
  procBody: {
    paddingHorizontal: Spacing.base, paddingBottom: Spacing.base,
    borderTopWidth: 1, borderTopColor: Colors.glassLight, paddingTop: Spacing.md,
    gap: 10,
  },
  envTabs: { flexDirection: 'row', gap: 6 },
  envTab: {
    flex: 1, paddingVertical: 8, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.glassBorderLight,
    backgroundColor: Colors.glass, alignItems: 'center',
  },
  envTabOn: { borderColor: 'rgba(59,130,246,0.4)', backgroundColor: 'rgba(59,130,246,0.12)' },
  envTabText: { fontSize: FontSizes.xs, fontWeight: '700', color: Colors.textMuted },
  envTabTextOn: { color: '#60A5FA' },
  fieldWrap: {},
  fieldLabel: {
    fontSize: FontSizes.xs, fontWeight: '700', color: Colors.textSecondary,
    marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4,
  },
  fieldInput: {
    backgroundColor: Colors.glass,
    borderWidth: 1, borderColor: Colors.glassBorderLight,
    borderRadius: BorderRadius.md, paddingHorizontal: 12, paddingVertical: 10,
    color: Colors.textPrimary, fontSize: FontSizes.sm,
  },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: {
    flex: 1, paddingVertical: 10, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.glassBorderActive,
    backgroundColor: Colors.glass,
    alignItems: 'center', justifyContent: 'center', minHeight: 40,
  },
  activateBtn: {
    borderColor: 'rgba(16,185,129,0.35)', backgroundColor: 'rgba(16,185,129,0.10)',
  },
  actionBtnText: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.textSecondary },
  envSwitchBtn: {
    paddingVertical: 10, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.glassBorderLight,
    backgroundColor: Colors.glass,
    alignItems: 'center', justifyContent: 'center', minHeight: 40,
  },
});
