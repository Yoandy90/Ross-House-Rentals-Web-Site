import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors, Colors } from '../../constants/colors';
import api from '../../services/api';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import CustomHeader from '../../components/CustomHeader';
import { useTranslation } from 'react-i18next';

const { width } = Dimensions.get('window');

interface TaxDeclaration {
  id: string;
  title: string;
  description?: string;
  tax_year: number;
  created_at: string;
  status?: string;
}

export default function TaxDeclarations() {
  const colors = useThemeColors();
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'es' ? es : enUS;
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [declarations, setDeclarations] = useState<TaxDeclaration[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    loadDeclarations();
  }, []);

  const loadDeclarations = async () => {
    try {
      const response = await api.get('/tax-declarations/my');
      if (response.data.success) {
        setDeclarations(response.data.declarations || []);
      }
    } catch (error) {
      console.error('Error loading tax declarations:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDeclarations();
  }, []);

  const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const byteCharacters = atob(base64);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: mimeType });
  };

  const downloadPDF = async (declarationId: string, title: string) => {
    setDownloading(declarationId);
    
    try {
      const response = await api.get(`/tax-declarations/${declarationId}/download`);
      
      const { pdf_data, filename } = response.data;
      
      if (!pdf_data) {
        throw new Error('No PDF data received');
      }
      
      if (Platform.OS === 'web') {
        const blob = base64ToBlob(pdf_data, 'application/pdf');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename || `${title}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        Alert.alert(t('taxDeclarations.success', 'Éxito'), t('taxDeclarations.downloadSuccess', 'Declaración descargada correctamente'));
      } else {
        // Mobile download
        const fileUri = FileSystem.documentDirectory + (filename || `${title}.pdf`);
        await FileSystem.writeAsStringAsync(fileUri, pdf_data, {
          encoding: 'base64',
        });
        
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Guardar Declaración de Impuestos'
          });
        } else {
          Alert.alert('Éxito', `Documento guardado en: ${fileUri}`);
        }
      }
    } catch (error) {
      console.error('Error downloading declaration:', error);
      Alert.alert(t('common.error', 'Error'), t('taxDeclarations.downloadError', 'No se pudo descargar la declaración'));
    } finally {
      setDownloading(null);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "d 'de' MMMM, yyyy", { locale: es });
    } catch {
      return dateString;
    }
  };

  const getStatusInfo = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'completado':
        return { label: t('common.completed', 'Completado'), color: Colors.success, icon: 'checkmark-circle' };
      case 'pending':
      case 'pendiente':
        return { label: t('common.pending', 'Pendiente'), color: '#F59E0B', icon: 'time' };
      case 'processing':
      case 'procesando':
        return { label: t('common.processing', 'Procesando'), color: Colors.primary, icon: 'hourglass' };
      default:
        return { label: t('common.available', 'Disponible'), color: Colors.success, icon: 'checkmark-circle' };
    }
  };

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
            <Ionicons name="document-text" size={40} color="#fff" />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Mis Declaraciones</Text>
            <Text style={styles.headerSubtitle}>
              {declarations.length === 0 
                ? 'Sin declaraciones disponibles' 
                : `${declarations.length} declaración${declarations.length > 1 ? 'es' : ''} disponible${declarations.length > 1 ? 's' : ''}`}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Stats Card */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <View style={[styles.statIconBg, { backgroundColor: Colors.success + '20' }]}>
            <Ionicons name="documents" size={24} color={Colors.success} />
          </View>
          <Text style={styles.statValue}>{declarations.length}</Text>
          <Text style={styles.statLabel}>{t('taxDeclarations.total', 'Total')}</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIconBg, { backgroundColor: '#F59E0B20' }]}>
            <Ionicons name="calendar" size={24} color="#F59E0B" />
          </View>
          <Text style={styles.statValue}>
            {declarations.length > 0 ? declarations[0]?.tax_year : new Date().getFullYear()}
          </Text>
          <Text style={styles.statLabel}>{t('taxDeclarations.lastYear', 'Último año')}</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIconBg, { backgroundColor: Colors.primary + '20' }]}>
            <Ionicons name="download" size={24} color={Colors.primary} />
          </View>
          <Text style={styles.statValue}>PDF</Text>
          <Text style={styles.statLabel}>{t('taxDeclarations.format', 'Formato')}</Text>
        </View>
      </View>
    </View>
  );

  const renderDeclaration = ({ item, index }: { item: TaxDeclaration; index: number }) => {
    const statusInfo = getStatusInfo(item.status);
    const isDownloading = downloading === item.id;
    
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => downloadPDF(item.id, item.title)}
        disabled={isDownloading}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardIconContainer}>
            <LinearGradient
              colors={[Colors.success + 'CC', Colors.success]}
              style={styles.cardIconGradient}
            >
              <Ionicons name="document-text" size={24} color="#fff" />
            </LinearGradient>
          </View>
          <View style={styles.cardTitleContainer}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <View style={styles.yearBadge}>
              <Ionicons name="calendar-outline" size={12} color={Colors.success} />
              <Text style={styles.yearText}>Año fiscal {item.tax_year}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
            <Ionicons name={statusInfo.icon as any} size={14} color={statusInfo.color} />
            <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
          </View>
        </View>

        {item.description && (
          <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
        )}

        <View style={styles.cardFooter}>
          <View style={styles.dateContainer}>
            <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
          </View>
          
          <TouchableOpacity
            style={[styles.downloadButton, isDownloading && styles.downloadButtonDisabled]}
            onPress={() => downloadPDF(item.id, item.title)}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="download-outline" size={18} color="#fff" />
                <Text style={styles.downloadButtonText}>{t('taxDeclarations.download', 'Descargar')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <LinearGradient
          colors={['#E5E7EB', '#D1D5DB']}
          style={styles.emptyIconGradient}
        >
          <Ionicons name="document-outline" size={60} color="#9CA3AF" />
        </LinearGradient>
      </View>
      <Text style={styles.emptyTitle}>{t('taxDeclarations.noDeclarations', 'Sin declaraciones')}</Text>
      <Text style={styles.emptyText}>
        {t('taxDeclarations.noDeclarationsDesc', 'Aún no tienes declaraciones de impuestos disponibles.')}
      </Text>
      <Text style={styles.emptySubtext}>
        {t('taxDeclarations.willAppearHere', 'Cuando tu preparador suba una, aparecerá aquí automáticamente.')}
      </Text>
      <View style={styles.emptyTip}>
        <Ionicons name="information-circle" size={20} color={Colors.success} />
        <Text style={styles.emptyTipText}>
          {t('taxDeclarations.availableOnceProcessed', 'Las declaraciones estarán disponibles una vez procesadas')}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <CustomHeader title={t('taxDeclarations.title')} showBack />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <View style={styles.loadingIconBg}>
            <ActivityIndicator size="large" color={Colors.success} />
          </View>
          <Text style={styles.loadingText}>{t('taxDeclarations.loading', 'Cargando declaraciones...')}</Text>
        </View>
      ) : (
        <FlatList
          data={declarations}
          keyExtractor={(item) => item.id}
          renderItem={renderDeclaration}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={declarations.length === 0 ? styles.emptyList : styles.list}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.success]}
              tintColor={Colors.success}
            />
          }
        />
      )}
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
    alignItems: 'center',
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
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
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
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  statIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },

  // Card Styles
  card: {
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardIconContainer: {
    marginRight: 12,
  },
  cardIconGradient: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitleContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  yearBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  yearText: {
    fontSize: 13,
    color: Colors.success,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  downloadButtonDisabled: {
    opacity: 0.7,
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
    paddingTop: 60,
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
