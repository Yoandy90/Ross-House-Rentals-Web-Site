import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { apiCall } from '../src/utils/api';
import { useAuth } from '../src/contexts/AuthContext';
import { SignaturePad, SignaturePadRef } from '../src/components/ui/SignaturePad';
import { Spacing, FontSizes, BorderRadius, useColors } from '../src/constants/theme';

export default function LeaseSigningScreen() {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ lease_id: string }>();
  const sigRef = useRef<SignaturePadRef>(null);

  const [lease, setLease] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const downloadLeasePdf = async () => {
    if (!lease?.id && !params.lease_id) {
      Alert.alert('Error', 'No se encontró el contrato');
      return;
    }
    setDownloadingPdf(true);
    try {
      const data = await apiCall(`/lease/${params.lease_id}/pdf`);
      if (!data?.success || !data?.pdf_base64) {
        throw new Error(data?.detail || 'No se recibió el PDF del servidor');
      }
      const filename = data.filename || `Contrato_${params.lease_id}.pdf`;
      const pdfUri = FileSystem.cacheDirectory + filename;
      await FileSystem.writeAsStringAsync(pdfUri, data.pdf_base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pdfUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Contrato de Arrendamiento',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Éxito', 'PDF guardado en la carpeta de descargas');
      }
    } catch (err: any) {
      console.error('Error downloading lease PDF:', err);
      Alert.alert('Error', err?.message || 'No se pudo descargar el PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  useEffect(() => {
    fetchLease();
  }, [params.lease_id]);

  const fetchLease = async () => {
    try {
      const data = await apiCall(`/lease/${params.lease_id}`);
      if (data.success) {
        setLease(data.lease);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo cargar el contrato');
    } finally {
      setLoading(false);
    }
  };

  const handleSignature = (sig: string) => {
    setSignature(sig);
  };

  const submitSignature = async () => {
    if (!signature) {
      Alert.alert('Firma requerida', 'Por favor firma en el recuadro antes de continuar');
      return;
    }
    if (!agreed) {
      Alert.alert('Aceptación requerida', 'Debes aceptar los términos del contrato');
      return;
    }

    setSigning(true);
    try {
      const role = user?.role || 'tenant';
      const result = await apiCall(`/lease/${params.lease_id}/sign`, {
        method: 'POST',
        body: {
          signature,
          role,
          name: user?.name || '',
          email: user?.email || '',
        },
      });

      if (result.success) {
        Alert.alert(
          '✅ Contrato Firmado',
          result.new_status === 'active'
            ? 'El contrato está ahora activo. ¡Bienvenido a tu nuevo hogar!'
            : 'Tu firma ha sido registrada. El contrato está pendiente de firma adicional.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo guardar la firma');
    } finally {
      setSigning(false);
    }
  };

  const getStatusInfo = (status: string) => {
    const map: Record<string, { label: string; color: string; icon: string }> = {
      pending_tenant: { label: 'Pendiente tu firma', color: C.warmGold, icon: 'time' },
      pending_landlord: { label: 'Pendiente firma propietario', color: C.warmGold, icon: 'time' },
      active: { label: 'Contrato Activo', color: C.success, icon: 'checkmark-circle' },
      expired: { label: 'Expirado', color: C.error, icon: 'alert-circle' },
      terminated: { label: 'Terminado', color: C.textMuted, icon: 'close-circle' },
    };
    return map[status] || { label: status, color: C.textMuted, icon: 'help-circle' };
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('es-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return d;
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={C.brandRed} />
        <Text style={styles.loadingText}>Cargando contrato...</Text>
      </View>
    );
  }

  if (!lease) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <Ionicons name="document-text-outline" size={48} color={C.textMuted} />
        <Text style={styles.loadingText}>Contrato no encontrado</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusInfo = getStatusInfo(lease.status);
  const userRole = user?.role || 'tenant';
  const canSign = (
    (userRole === 'tenant' && ['pending_tenant', 'pending_signatures'].includes(lease.status)) ||
    (userRole === 'landlord' && ['pending_landlord', 'pending_signatures'].includes(lease.status))
  );
  const alreadySigned = (
    (userRole === 'tenant' && lease.tenant_signature) ||
    (userRole === 'landlord' && lease.landlord_signature)
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 120 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={C.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Contrato de Arrendamiento</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Status Banner */}
        <View style={[styles.statusBanner, { backgroundColor: statusInfo.color + '15' }]}>
          <Ionicons name={statusInfo.icon as any} size={20} color={statusInfo.color} />
          <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
        </View>

        {/* Property Info */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="home" size={20} color={C.brandRed} />
            <Text style={styles.cardTitle}>Propiedad</Text>
          </View>
          <Text style={styles.addressText}>{lease.property_address || 'Sin dirección'}</Text>
        </View>

        {/* Lease Details */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="document-text" size={20} color={C.brandRed} />
            <Text style={styles.cardTitle}>Detalles del Contrato</Text>
          </View>

          <View style={styles.detailGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Inquilino</Text>
              <Text style={styles.detailValue}>{lease.tenant_name}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Tipo</Text>
              <Text style={styles.detailValue}>
                {lease.lease_type === 'residential' ? 'Residencial' : 'Comercial'}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Inicio</Text>
              <Text style={styles.detailValue}>{formatDate(lease.start_date)}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Fin</Text>
              <Text style={styles.detailValue}>{formatDate(lease.end_date)}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Renta Mensual</Text>
              <Text style={[styles.detailValue, styles.priceValue]}>
                ${lease.rent_amount?.toLocaleString() || '0'}/mes
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Depósito</Text>
              <Text style={styles.detailValue}>
                ${lease.deposit_amount?.toLocaleString() || '0'}
              </Text>
            </View>
          </View>
        </View>

        {/* Terms & Conditions */}
        {lease.terms && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="reader" size={20} color={C.brandRed} />
              <Text style={styles.cardTitle}>Términos y Condiciones</Text>
            </View>
            <Text style={styles.termsText}>{lease.terms}</Text>

            {lease.clauses && lease.clauses.length > 0 && (
              <View style={styles.clausesList}>
                {lease.clauses.map((clause: string, idx: number) => (
                  <View key={idx} style={styles.clauseItem}>
                    <Text style={styles.clauseNumber}>{idx + 1}.</Text>
                    <Text style={styles.clauseText}>{clause}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Signature Status */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="finger-print" size={20} color={C.brandRed} />
            <Text style={styles.cardTitle}>Firmas</Text>
          </View>

          {/* Admin signature */}
          <View style={styles.signatureRow}>
            <View style={styles.signatureInfo}>
              <Text style={styles.signerLabel}>Ross House Rentals LLC</Text>
              <Text style={styles.signerRole}>Administrador</Text>
            </View>
            {lease.admin_signature ? (
              <View style={styles.signedChip}>
                <Ionicons name="checkmark" size={14} color={C.success} />
                <Text style={styles.signedChipText}>Firmado</Text>
              </View>
            ) : (
              <View style={styles.pendingChip}>
                <Ionicons name="time" size={14} color={C.warmGold} />
                <Text style={styles.pendingChipText}>Pendiente</Text>
              </View>
            )}
          </View>

          {/* Tenant signature */}
          <View style={styles.signatureRow}>
            <View style={styles.signatureInfo}>
              <Text style={styles.signerLabel}>{lease.tenant_name}</Text>
              <Text style={styles.signerRole}>Inquilino</Text>
            </View>
            {lease.tenant_signature ? (
              <View style={styles.signedChip}>
                <Ionicons name="checkmark" size={14} color={C.success} />
                <Text style={styles.signedChipText}>Firmado</Text>
              </View>
            ) : (
              <View style={styles.pendingChip}>
                <Ionicons name="time" size={14} color={C.warmGold} />
                <Text style={styles.pendingChipText}>Pendiente</Text>
              </View>
            )}
          </View>

          {/* Landlord signature (if marketplace property) */}
          {lease.landlord_id && (
            <View style={styles.signatureRow}>
              <View style={styles.signatureInfo}>
                <Text style={styles.signerLabel}>Propietario</Text>
                <Text style={styles.signerRole}>Arrendador</Text>
              </View>
              {lease.landlord_signature ? (
                <View style={styles.signedChip}>
                  <Ionicons name="checkmark" size={14} color={C.success} />
                  <Text style={styles.signedChipText}>Firmado</Text>
                </View>
              ) : (
                <View style={styles.pendingChip}>
                  <Ionicons name="time" size={14} color={C.warmGold} />
                  <Text style={styles.pendingChipText}>Pendiente</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Signature Pad (if user can sign) */}
        {canSign && !alreadySigned && (
          <View style={styles.card}>
            {/* Draft PDF download — review before signing */}
            <TouchableOpacity
              style={styles.draftDownloadBtn}
              onPress={downloadLeasePdf}
              disabled={downloadingPdf}
              activeOpacity={0.7}
            >
              {downloadingPdf ? (
                <ActivityIndicator color={C.brandRed} size="small" />
              ) : (
                <>
                  <Ionicons name="document-text-outline" size={18} color={C.brandRed} />
                  <Text style={styles.draftDownloadBtnText}>Descargar PDF (borrador) para revisar</Text>
                </>
              )}
            </TouchableOpacity>

            <SignaturePad
              ref={sigRef}
              title="Tu Firma"
              description="Dibuja tu firma con el dedo en el recuadro. Esta firma tiene validez legal."
              onSave={handleSignature}
              onClear={() => setSignature(null)}
              height={180}
              savedSignature={null}
            />

            {/* Agreement checkbox */}
            <TouchableOpacity
              style={styles.agreementRow}
              onPress={() => setAgreed(!agreed)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
                {agreed && <Ionicons name="checkmark" size={14} color={C.white} />}
              </View>
              <Text style={styles.agreementText}>
                He leído y acepto los términos y condiciones de este contrato de arrendamiento.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitBtn,
                (!signature || !agreed) && styles.submitBtnDisabled,
              ]}
              onPress={submitSignature}
              disabled={signing || !signature || !agreed}
              activeOpacity={0.7}
            >
              {signing ? (
                <ActivityIndicator color={C.white} size="small" />
              ) : (
                <>
                  <Ionicons name="create" size={20} color={C.white} />
                  <Text style={styles.submitText}>Firmar Contrato</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Already signed message */}
        {alreadySigned && (
          <View style={styles.alreadySignedCard}>
            <Ionicons name="checkmark-circle" size={40} color={C.success} />
            <Text style={styles.alreadySignedTitle}>Ya has firmado este contrato</Text>
            <Text style={styles.alreadySignedDesc}>
              Tu firma digital fue registrada exitosamente.
            </Text>
            <TouchableOpacity
              style={styles.downloadBtn}
              onPress={downloadLeasePdf}
              disabled={downloadingPdf}
              activeOpacity={0.7}
            >
              {downloadingPdf ? (
                <ActivityIndicator color={C.white} size="small" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={20} color={C.white} />
                  <Text style={styles.downloadBtnText}>Descargar PDF del contrato</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.background },
  container: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.background,
    gap: 12,
  },
  loadingText: { fontSize: FontSizes.sm, color: C.textMuted },
  backLink: { marginTop: 16 },
  backLinkText: { fontSize: FontSizes.sm, color: C.brandRed, fontWeight: '600' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: 12,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: C.textPrimary },

  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: Spacing.base,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: BorderRadius.card,
  },
  statusText: { fontSize: FontSizes.sm, fontWeight: '600' },

  card: {
    backgroundColor: C.surface,
    marginHorizontal: Spacing.base,
    marginBottom: 12,
    padding: Spacing.base,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  cardTitle: { fontSize: FontSizes.md, fontWeight: '700', color: C.textPrimary },
  addressText: { fontSize: FontSizes.sm, color: C.textSecondary, lineHeight: 20 },

  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailItem: {
    width: '47%',
    backgroundColor: C.surfaceLight,
    padding: 12,
    borderRadius: BorderRadius.md,
  },
  detailLabel: { fontSize: 10, color: C.textMuted, fontWeight: '500', textTransform: 'uppercase', marginBottom: 4 },
  detailValue: { fontSize: FontSizes.sm, color: C.textPrimary, fontWeight: '600' },
  priceValue: { color: C.brandRed, fontSize: FontSizes.md },

  termsText: {
    fontSize: FontSizes.sm,
    color: C.textSecondary,
    lineHeight: 22,
    marginBottom: 12,
  },
  clausesList: { gap: 8 },
  clauseItem: { flexDirection: 'row', gap: 8 },
  clauseNumber: { fontSize: FontSizes.sm, fontWeight: '700', color: C.brandRed, minWidth: 20 },
  clauseText: { fontSize: FontSizes.sm, color: C.textSecondary, flex: 1, lineHeight: 20 },

  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  signatureInfo: { flex: 1 },
  signerLabel: { fontSize: FontSizes.sm, fontWeight: '600', color: C.textPrimary },
  signerRole: { fontSize: FontSizes.xs, color: C.textMuted, marginTop: 2 },
  signedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34,197,94,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  signedChipText: { fontSize: FontSizes.xs, color: C.success, fontWeight: '600' },
  pendingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245,158,11,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  pendingChipText: { fontSize: FontSizes.xs, color: C.warmGold, fontWeight: '600' },

  agreementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 16,
    marginBottom: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: C.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: C.brandRed,
    borderColor: C.brandRed,
  },
  agreementText: {
    flex: 1,
    fontSize: FontSizes.xs,
    color: C.textSecondary,
    lineHeight: 18,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.brandRed,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { fontSize: FontSizes.md, color: C.white, fontWeight: '700' },

  alreadySignedCard: {
    backgroundColor: 'rgba(34,197,94,0.06)',
    marginHorizontal: Spacing.base,
    marginBottom: 16,
    padding: 24,
    borderRadius: BorderRadius.card,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
  },
  alreadySignedTitle: { fontSize: FontSizes.md, fontWeight: '700', color: C.success },
  alreadySignedDesc: { fontSize: FontSizes.sm, color: C.textSecondary, textAlign: 'center' },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.brandRed,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: BorderRadius.md,
    marginTop: 12,
    width: '100%',
  },
  downloadBtnText: {
    color: C.white,
    fontSize: FontSizes.sm,
    fontWeight: '700',
  },
  draftDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(220,38,38,0.06)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.md,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.2)',
  },
  draftDownloadBtnText: {
    color: C.brandRed,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
});
