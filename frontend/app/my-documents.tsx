import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../constants/colors';
import api from '../services/api';
import { useTranslation } from 'react-i18next';

interface Document {
  id: string;
  document_type: string;
  status: string;
  uploaded_at: string;
  notes?: string;
  admin_notes?: string;
}

const DOCUMENT_LABELS: Record<string, string> = {
  photo_2x2: 'Foto Personal 2x2',
  id_front: 'ID Frontal',
  id_back: 'ID Reverso',
  passport: 'Pasaporte',
  ssn_card: 'Social Security Card',
  w2: 'Formulario W2',
  '1099': 'Formulario 1099',
  receipt: 'Recibo',
  other: 'Otro',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'Pendiente', color: '#FF9800', icon: 'time-outline' },
  approved: { label: 'Aprobado', color: '#4CAF50', icon: 'checkmark-circle' },
  rejected: { label: 'Rechazado', color: '#F44336', icon: 'close-circle' },
  needs_revision: { label: 'Necesita Revisión', color: '#2196F3', icon: 'alert-circle' },
};

export default function MyDocuments() {
  const router = useRouter();
  const colors = useThemeColors();
  const { t } = useTranslation();
  const styles = createStyles(colors);

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const response = await api.get('/document-capture/my-documents');
      setDocuments(response.data.documents || []);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDocuments();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderDocument = ({ item }: { item: Document }) => {
    const statusInfo = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    const docLabel = DOCUMENT_LABELS[item.document_type] || item.document_type;

    return (
      <TouchableOpacity style={styles.documentCard} activeOpacity={0.7}>
        <View style={styles.documentHeader}>
          <View style={styles.documentTitleContainer}>
            <Ionicons name="document-text" size={24} color={colors.primary} />
            <View style={styles.documentInfo}>
              <Text style={styles.documentTitle}>{docLabel}</Text>
              <Text style={styles.documentDate}>{formatDate(item.uploaded_at)}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
            <Ionicons
              name={statusInfo.icon as any}
              size={16}
              color={statusInfo.color}
            />
            <Text style={[styles.statusText, { color: statusInfo.color }]}>
              {statusInfo.label}
            </Text>
          </View>
        </View>
        {item.admin_notes && (
          <View style={styles.notesContainer}>
            <Ionicons name="chatbox-ellipses-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.notesText}>{item.admin_notes}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mis Documentos</Text>
        <View style={{ width: 40 }} />
      </View>

      {documents.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="folder-open-outline" size={64} color={colors.textSecondary} />
          <Text style={styles.emptyText}>No has enviado documentos aún</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push('/tools' as any)}
          >
            <Text style={styles.addButtonText}>Tomar Foto</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={documents}
          renderItem={renderDocument}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    listContent: {
      padding: 16,
      gap: 12,
    },
    documentCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    documentHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    documentTitleContainer: {
      flexDirection: 'row',
      gap: 12,
      flex: 1,
    },
    documentInfo: {
      flex: 1,
    },
    documentTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    documentDate: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '600',
    },
    notesContainer: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
      padding: 12,
      backgroundColor: colors.background,
      borderRadius: 8,
    },
    notesText: {
      flex: 1,
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    emptyText: {
      fontSize: 16,
      color: colors.textSecondary,
      marginTop: 16,
      marginBottom: 24,
      textAlign: 'center',
    },
    addButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: 8,
    },
    addButtonText: {
      color: colors.textWhite,
      fontSize: 16,
      fontWeight: '600',
    },
  });
