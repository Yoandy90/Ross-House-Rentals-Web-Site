/**
 * My Receipts Screen - Client
 * Upload and view expense receipts throughout the year
 * Modern green design matching tax declarations
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Modal,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useThemeColors, Colors } from '../../constants/colors';
import CustomHeader from '../../components/CustomHeader';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';
import iapService, { IAP_PRODUCT_IDS, IAP_SUBSCRIPTION_UPDATED_EVENT } from '../../services/iapService';
import { DeviceEventEmitter } from 'react-native';

interface Receipt {
  id: string;
  category: string | null;
  merchant: string | null;
  amount: number | null;
  receipt_date: string | null;
  status: string;
  created_at: string;
}

interface Summary {
  total_receipts: number;
  total_amount: number;
  by_category: Record<string, number>;
  current_year: number;
}

const CATEGORY_ICONS: Record<string, { icon: string; color: string }> = {
  'Gastos Médicos': { icon: 'medkit', color: '#ef4444' },
  'Comida/Restaurantes': { icon: 'restaurant', color: '#f97316' },
  'Transporte': { icon: 'car', color: '#3b82f6' },
  'Oficina/Suministros': { icon: 'briefcase', color: '#8b5cf6' },
  'Utilidades': { icon: 'flash', color: '#eab308' },
  'Vivienda': { icon: 'home', color: '#10b981' },
  'Educación': { icon: 'school', color: '#06b6d4' },
  'Donaciones': { icon: 'heart', color: '#ec4899' },
  'Gastos de Negocio': { icon: 'business', color: '#6366f1' },
  'Sin clasificar': { icon: 'help-circle', color: '#6b7280' },
};

export default function MyReceipts() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const router = useRouter();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [authError, setAuthError] = useState(false);

  // Usage limits state
  const [usageLimits, setUsageLimits] = useState<any>(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [purchasingReceipts, setPurchasingReceipts] = useState(false);

  const loadUsageLimits = useCallback(async () => {
    try {
      const response = await api.get('/receipts/usage-limits');
      setUsageLimits(response.data);
    } catch (error) {
      console.error('Error loading usage limits:', error);
    }
  }, []);

  useEffect(() => {
    loadUsageLimits();
  }, [loadUsageLimits]);

  const handlePurchaseReceiptsPro = async () => {
    setPurchasingReceipts(true);
    try {
      if (Platform.OS !== 'ios') {
        Alert.alert(
          'Próximamente',
          'Las compras dentro de la app estarán disponibles en Android pronto. Por ahora, llama al (806) 934-2018.',
          [
            { text: 'Llamar', onPress: () => Linking.openURL('tel:+18069342018') },
            { text: 'OK', style: 'cancel' },
          ]
        );
        return;
      }

      await iapService.initialize();
      const result = await iapService.purchaseSubscription(IAP_PRODUCT_IDS.RECEIPTS_PRO_MONTHLY);
      
      if (result.success) {
        // Purchase initiated - the listener will handle completion
        console.log('Receipts Pro purchase initiated');
      } else {
        Alert.alert('Error', result.error || 'No se pudo completar la compra');
      }
    } catch (error: any) {
      console.error('Error purchasing Receipts Pro:', error);
      Alert.alert('Error', 'Hubo un problema al procesar la compra. Inténtalo de nuevo.');
    } finally {
      setPurchasingReceipts(false);
    }
  };

  const loadReceipts = useCallback(async () => {
    try {
      setAuthError(false);
      const response = await api.get('/receipts/my-receipts', {
        params: { year: selectedYear }
      });
      setReceipts(response.data.receipts || []);
      setSummary(response.data.summary || null);
    } catch (error: any) {
      console.error('Error loading receipts:', error);
      if (error.response?.status === 401) {
        setAuthError(true);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    loadReceipts();
  }, [loadReceipts]);

  // Listen for subscription updates (after IAP purchase completes)
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(IAP_SUBSCRIPTION_UPDATED_EVENT, () => {
      console.log('Receipts: Subscription updated, refreshing limits...');
      loadUsageLimits();
      loadReceipts();
      setShowSubscriptionModal(false);
    });
    return () => subscription.remove();
  }, [loadUsageLimits, loadReceipts]);

  const handleUploadReceipt = async () => {
    // Check usage limits first
    if (usageLimits && !usageLimits.can_upload) {
      Alert.alert(
        '⚠️ Límite Alcanzado',
        `Has usado tus ${usageLimits.limit} escaneos gratuitos este mes.\n\n📸 Suscríbete a Recibos Pro por solo $9.99/mes para escaneos ilimitados.\n\n¿O prefieres hablar con nosotros?`,
        [
          { text: '📸 Suscribirme', style: 'default', onPress: () => setShowSubscriptionModal(true) },
          { text: '📞 Llamar', onPress: () => { Linking.openURL('tel:+18069342018'); } },
          { text: 'OK', style: 'cancel' },
        ]
      );
      return;
    }

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('common.permissionRequired', 'Permiso requerido'), t('receipts.cameraAccessNeeded', 'Necesitamos acceso a la cámara para tomar fotos de recibos'));
        return;
      }

      Alert.alert(
        t('receipts.uploadReceipt', '📷 Subir Recibo'),
        t('receipts.howToAdd', '¿Cómo deseas agregar el recibo?'),
        [
          { text: t('receipts.takePhoto', 'Tomar Foto'), onPress: () => takePhoto() },
          { text: t('receipts.fromGallery', 'Desde Galería'), onPress: () => pickFromGallery() },
          { text: t('common.cancel', 'Cancelar'), style: 'cancel' },
        ]
      );
    } catch (error) {
      console.error('Error:', error);
      Alert.alert(t('common.error', 'Error'), t('receipts.cameraError', 'No se pudo acceder a la cámara'));
    }
  };

  const takePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0].base64!);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert(t('common.error', 'Error'), t('myReceipts.photoError', 'No se pudo tomar la foto'));
    }
  };

  const pickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0].base64!);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert(t('common.error', 'Error'), t('myReceipts.imageError', 'No se pudo seleccionar la imagen'));
    }
  };

  const uploadImage = async (base64Image: string) => {
    setUploading(true);
    try {
      const response = await api.post('/receipts/upload', {
        image: base64Image,
        notes: null,
      }, {
        timeout: 90000, // 90 seconds for upload + AI classification
      });
      
      const data = response.data;
      
      let message = 'Tu recibo ha sido enviado.';
      if (data.ai_classified && data.classification) {
        const cat = data.classification.category || 'Sin clasificar';
        const amt = data.classification.amount;
        const merchant = data.classification.merchant;
        
        message = `¡Recibo clasificado automáticamente!\n\n`;
        message += `📁 Categoría: ${cat}\n`;
        if (merchant) message += `🏪 Comercio: ${merchant}\n`;
        if (amt) message += `💰 Monto: $${amt.toFixed(2)}\n`;
      } else {
        message = 'Tu recibo ha sido enviado y será revisado.';
      }
      
      Alert.alert(
        data.ai_classified ? '✅ Recibo Clasificado' : '📤 Recibo Enviado',
        message,
        [{ text: 'OK', onPress: () => { loadReceipts(); loadUsageLimits(); } }]
      );
    } catch (error: any) {
      console.error('Error uploading:', error);
      
      // Handle authentication errors specifically
      if (error.response?.status === 401) {
        setAuthError(true);
        Alert.alert(
          '⚠️ Sesión Expirada',
          'Tu sesión ha expirado. Por favor, cierra sesión y vuelve a iniciar sesión para continuar.',
          [{ text: 'OK' }]
        );
      } else if (error.response?.status === 429) {
        // Receipt limit reached
        const detail = error.response?.data?.detail;
        const message = typeof detail === 'object' ? detail.message : (detail || 'Límite de recibos alcanzado');
        Alert.alert(
          '⚠️ Límite Alcanzado',
          `${message}\n\n📸 Suscríbete a Recibos Pro ($9.99/mes) para escaneos ilimitados.`,
          [
            { text: '📸 Suscribirme', style: 'default', onPress: () => setShowSubscriptionModal(true) },
            { text: '📞 Llamar', onPress: () => { Linking.openURL('tel:+18069342018'); } },
            { text: 'OK', style: 'cancel' },
          ]
        );
        loadUsageLimits(); // Refresh limits
      } else {
        Alert.alert(t('common.error', 'Error'), error.response?.data?.detail || t('myReceipts.uploadError', 'No se pudo subir el recibo. Intenta de nuevo.'));
      }
    } finally {
      setUploading(false);
    }
  };

  const getCategoryInfo = (category: string | null) => {
    return CATEGORY_ICONS[category || 'Sin clasificar'] || CATEGORY_ICONS['Sin clasificar'];
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '$--';
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '--';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    } catch {
      return dateString;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: t('common.pending', 'Pendiente'), color: '#f59e0b', bg: '#fef3c7' };
      case 'processing':
        return { label: t('common.processing', 'Procesando'), color: '#3b82f6', bg: '#dbeafe' };
      case 'classified':
        return { label: t('receipts.classified', 'Clasificado'), color: '#10b981', bg: '#d1fae5' };
      case 'reviewed':
        return { label: t('receipts.reviewed', 'Revisado'), color: '#6366f1', bg: '#e0e7ff' };
      default:
        return { label: status, color: '#6b7280', bg: '#f3f4f6' };
    }
  };

  const styles = createStyles(colors);

  const renderHeader = () => (
    <View style={styles.headerSection}>
      <LinearGradient
        colors={[Colors.success, '#059669']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerIconContainer}>
            <Ionicons name="receipt" size={40} color="#fff" />
          </View>
          <View style={styles.headerTextContainer}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>{t('receipts.totalExpenses', 'Total Gastos')} {selectedYear}</Text>
              <TouchableOpacity 
                style={styles.yearSelector}
                onPress={() => {
                  Alert.alert(t('receipts.selectYear', 'Seleccionar Año'), t('receipts.chooseYear', 'Elige el año'), [
                    { text: '2024', onPress: () => setSelectedYear(2024) },
                    { text: '2025', onPress: () => setSelectedYear(2025) },
                    { text: '2026', onPress: () => setSelectedYear(2026) },
                    { text: t('common.cancel', 'Cancelar'), style: 'cancel' },
                  ]);
                }}
              >
                <Text style={styles.yearText}>{selectedYear}</Text>
                <Ionicons name="chevron-down" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.headerAmount}>
              {formatCurrency(summary?.total_amount || 0)}
            </Text>
            <Text style={styles.headerSubtitle}>
              {summary?.total_receipts || 0} recibos este año
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <View style={[styles.statIconBg, { backgroundColor: Colors.success + '20' }]}>
            <Ionicons name="receipt" size={24} color={Colors.success} />
          </View>
          <Text style={styles.statValue}>{summary?.total_receipts || 0}</Text>
          <Text style={styles.statLabel}>{t('myReceipts.total', 'Total')}</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIconBg, { backgroundColor: '#F59E0B20' }]}>
            <Ionicons name="folder" size={24} color="#F59E0B" />
          </View>
          <Text style={styles.statValue}>{Object.keys(summary?.by_category || {}).length}</Text>
          <Text style={styles.statLabel}>{t('myReceipts.categories', 'Categorías')}</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIconBg, { backgroundColor: Colors.primary + '20' }]}>
            <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
          </View>
          <Text style={styles.statValue}>{receipts.filter(r => r.status === 'classified').length}</Text>
          <Text style={styles.statLabel}>{t('myReceipts.classified', 'Clasificados')}</Text>
        </View>
      </View>

      {/* Plan Status Banner */}
      {usageLimits && (
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: (usageLimits.has_receipts_pro || usageLimits.is_unlimited) ? '#EEF2FF' : '#FEF3C7',
            borderWidth: 1,
            borderColor: (usageLimits.has_receipts_pro || usageLimits.is_unlimited) ? '#C7D2FE' : '#FDE68A',
            borderRadius: 12,
            padding: 12,
            marginTop: 10,
            marginHorizontal: 0,
            gap: 10,
          }}
          onPress={() => router.push('/finance-subscription' as any)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={(usageLimits.has_receipts_pro || usageLimits.is_unlimited) ? 'diamond' : 'alert-circle'}
            size={20}
            color={(usageLimits.has_receipts_pro || usageLimits.is_unlimited) ? '#6366F1' : '#F59E0B'}
          />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: (usageLimits.has_receipts_pro || usageLimits.is_unlimited) ? '#4338CA' : '#92400E' }}>
              {(usageLimits.has_receipts_pro || usageLimits.is_unlimited) 
                ? '✨ Recibos Pro Activo' 
                : `📸 Plan Gratis · ${usageLimits.used}/${usageLimits.limit ?? '10'} recibos usados`}
            </Text>
            <Text style={{ fontSize: 11, color: (usageLimits.has_receipts_pro || usageLimits.is_unlimited) ? '#6366F1' : '#B45309', marginTop: 2 }}>
              {(usageLimits.has_receipts_pro || usageLimits.is_unlimited)
                ? 'Escaneos ilimitados con AI'
                : usageLimits.remaining > 0
                  ? `Te quedan ${usageLimits.remaining} escaneos gratis este mes`
                  : 'Sin escaneos disponibles — Suscríbete a Pro'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={(usageLimits.has_receipts_pro || usageLimits.is_unlimited) ? '#6366F1' : '#F59E0B'} />
        </TouchableOpacity>
      )}

      {/* Upload Button */}
      <TouchableOpacity
        style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
        onPress={handleUploadReceipt}
        disabled={uploading}
        activeOpacity={0.7}
      >
        {uploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="camera" size={22} color="#fff" />
            <Text style={styles.uploadButtonText}>Subir Recibo</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Categories Breakdown */}
      {summary && Object.keys(summary.by_category).length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
          {Object.entries(summary.by_category).map(([category, amount]) => {
            const info = getCategoryInfo(category);
            return (
              <View key={category} style={styles.categoryCard}>
                <View style={[styles.categoryIconSmall, { backgroundColor: info.color + '20' }]}>
                  <Ionicons name={info.icon as any} size={18} color={info.color} />
                </View>
                <Text style={styles.categoryName} numberOfLines={1}>
                  {category}
                </Text>
                <Text style={styles.categoryAmount}>
                  {formatCurrency(amount)}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );

  const renderReceipt = ({ item }: { item: Receipt }) => {
    const categoryInfo = getCategoryInfo(item.category);
    const statusBadge = getStatusBadge(item.status);
    
    return (
      <View style={styles.receiptCard}>
        <View style={styles.receiptHeader}>
          <View style={styles.receiptIconContainer}>
            <LinearGradient
              colors={[categoryInfo.color + 'CC', categoryInfo.color]}
              style={styles.receiptIconGradient}
            >
              <Ionicons name={categoryInfo.icon as any} size={22} color="#fff" />
            </LinearGradient>
          </View>
          <View style={styles.receiptInfo}>
            <Text style={styles.receiptMerchant} numberOfLines={1}>
              {item.merchant || 'Sin identificar'}
            </Text>
            <View style={styles.receiptCategoryRow}>
              <Ionicons name="folder-outline" size={12} color={Colors.success} />
              <Text style={styles.receiptCategory}>{item.category || 'Sin clasificar'}</Text>
            </View>
          </View>
          <Text style={[styles.receiptAmount, { color: item.amount ? Colors.success : colors.textSecondary }]}>
            {formatCurrency(item.amount)}
          </Text>
        </View>
        
        <View style={styles.receiptFooter}>
          <View style={styles.receiptMeta}>
            <View style={[styles.statusBadge, { backgroundColor: statusBadge.bg }]}>
              <Ionicons name={statusBadge.color === '#10b981' ? 'checkmark-circle' : 'time'} size={12} color={statusBadge.color} />
              <Text style={[styles.statusText, { color: statusBadge.color }]}>
                {statusBadge.label}
              </Text>
            </View>
            <View style={styles.dateContainer}>
              <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
              <Text style={styles.receiptDate}>{formatDate(item.created_at)}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <LinearGradient
          colors={['#E5E7EB', '#D1D5DB']}
          style={styles.emptyIconGradient}
        >
          <Ionicons name="receipt-outline" size={60} color="#9CA3AF" />
        </LinearGradient>
      </View>
      <Text style={styles.emptyTitle}>{t('myReceipts.noReceipts', 'Sin recibos')}</Text>
      <Text style={styles.emptyText}>
        Aún no tienes recibos de gastos este año.
      </Text>
      <Text style={styles.emptySubtext}>
        Toma fotos de tus recibos para tenerlos organizados.
      </Text>
      <View style={styles.emptyTip}>
        <Ionicons name="information-circle" size={20} color={Colors.success} />
        <Text style={styles.emptyTipText}>
          Los recibos se clasifican automáticamente con AI
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <CustomHeader 
        title={t('myReceipts.title')} 
        showBack 
        gradientColors={[Colors.success, '#059669']} 
      />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <View style={styles.loadingIconBg}>
            <ActivityIndicator size="large" color={Colors.success} />
          </View>
          <Text style={styles.loadingText}>{t('myReceipts.loading', 'Cargando recibos...')}</Text>
        </View>
      ) : (
        <FlatList
          data={receipts}
          keyExtractor={(item) => item.id}
          renderItem={renderReceipt}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={receipts.length === 0 ? styles.emptyList : styles.list}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadReceipts();
              }}
              colors={[Colors.success]}
              tintColor={Colors.success}
            />
          }
        />
      )}

      {/* Recibos Pro Subscription Modal */}
      <Modal
        visible={showSubscriptionModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSubscriptionModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ 
            backgroundColor: '#fff', 
            borderTopLeftRadius: 28, 
            borderTopRightRadius: 28,
            paddingBottom: 40,
          }}>
            {/* Handle bar */}
            <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
              <View style={{ width: 40, height: 4, backgroundColor: '#D1D5DB', borderRadius: 2 }} />
            </View>

            {/* Header */}
            <LinearGradient
              colors={['#059669', '#047857']}
              style={{ marginHorizontal: 20, borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 20 }}
            >
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                <Ionicons name="camera" size={32} color="#fff" />
              </View>
              <Text style={{ fontSize: 24, fontWeight: '900', color: '#fff', textAlign: 'center' }}>
                Recibos Pro
              </Text>
              <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: 4 }}>
                Escaneo ilimitado de recibos con AI
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 16 }}>
                <Text style={{ fontSize: 36, fontWeight: '900', color: '#fff' }}>$9.99</Text>
                <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginLeft: 4 }}>/mes</Text>
              </View>
            </LinearGradient>

            {/* Features */}
            <View style={{ paddingHorizontal: 24, marginBottom: 20 }}>
              {[
                { icon: 'infinite', text: 'Escaneos ilimitados de recibos' },
                { icon: 'sparkles', text: 'Clasificación automática con AI' },
                { icon: 'folder-open', text: 'Categorización según IRS Schedule C' },
                { icon: 'bar-chart', text: 'Historial de gastos organizado' },
                { icon: 'document-text', text: 'Reporte anual de gastos deducibles' },
                { icon: 'notifications', text: 'Alertas de gastos inusuales' },
              ].map((feature, idx) => (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name={feature.icon as any} size={18} color="#059669" />
                  </View>
                  <Text style={{ fontSize: 14, color: '#374151', fontWeight: '500', flex: 1 }}>{feature.text}</Text>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                </View>
              ))}
            </View>

            {/* Subscribe Button */}
            <View style={{ paddingHorizontal: 24, gap: 10 }}>
              <TouchableOpacity
                onPress={handlePurchaseReceiptsPro}
                disabled={purchasingReceipts}
                style={{
                  backgroundColor: '#059669',
                  paddingVertical: 16,
                  borderRadius: 16,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: purchasingReceipts ? 0.7 : 1,
                }}
              >
                {purchasingReceipts ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="star" size={18} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>
                      Suscribirme — $9.99/mes
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setShowSubscriptionModal(false);
                  Linking.openURL('tel:+18069342018');
                }}
                style={{
                  paddingVertical: 14,
                  borderRadius: 16,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 6,
                  borderWidth: 1.5,
                  borderColor: '#E5E7EB',
                }}
              >
                <Ionicons name="call" size={16} color="#6B7280" />
                <Text style={{ color: '#6B7280', fontSize: 14, fontWeight: '600' }}>
                  Llamar al (806) 934-2018
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowSubscriptionModal(false)}
                style={{ paddingVertical: 10, alignItems: 'center' }}
              >
                <Text style={{ color: '#9CA3AF', fontSize: 13 }}>Cancelar</Text>
              </TouchableOpacity>
            </View>

            {/* Legal text */}
            <Text style={{ textAlign: 'center', fontSize: 10, color: '#9CA3AF', paddingHorizontal: 24, marginTop: 8, lineHeight: 14 }}>
              La suscripción se renueva automáticamente cada mes. Puedes cancelar en cualquier momento desde la configuración de tu cuenta de {Platform.OS === 'ios' ? 'App Store' : 'Google Play'}.
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.success + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  list: {
    paddingBottom: 24,
  },
  emptyList: {
    flexGrow: 1,
  },
  
  // Header Section
  headerSection: {
    marginBottom: 16,
  },
  headerGradient: {
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  headerIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
  },
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  yearText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  headerAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },

  // Stats Container
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: -24,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  statIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },

  // Upload Button
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.success,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
    gap: 8,
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Categories
  categoriesScroll: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  categoryCard: {
    width: 100,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginRight: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryIconSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryName: {
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 4,
    color: colors.textSecondary,
  },
  categoryAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },

  // Receipt Card
  receiptCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  receiptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  receiptIconContainer: {
    marginRight: 12,
  },
  receiptIconGradient: {
    width: 46,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptInfo: {
    flex: 1,
  },
  receiptMerchant: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  receiptCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  receiptCategory: {
    fontSize: 13,
    color: Colors.success,
    fontWeight: '500',
  },
  receiptAmount: {
    fontSize: 17,
    fontWeight: '700',
  },
  receiptFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  receiptMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  receiptDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
    paddingTop: 40,
  },
  emptyIconContainer: {
    marginBottom: 24,
  },
  emptyIconGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyTip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success + '15',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  emptyTipText: {
    fontSize: 13,
    color: Colors.success,
    fontWeight: '500',
    flex: 1,
  },
});
