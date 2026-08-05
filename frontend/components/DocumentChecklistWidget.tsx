import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeColors } from '../constants/colors';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

interface DocumentChecklist {
  required: string[];
  uploaded: string[];
  missing: string[];
  completion_percentage: number;
}

export default function DocumentChecklistWidget() {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const router = useRouter();
  
  const [checklist, setChecklist] = useState<DocumentChecklist | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChecklist();
  }, []);

  const loadChecklist = async () => {
    try {
      setLoading(true);
      const response = await api.get('/documents/checklist');
      setChecklist(response.data);
    } catch (error) {
      console.error('Error loading checklist:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  // Show completed state for 5 seconds before hiding
  const isComplete = checklist && checklist.completion_percentage === 100;
  
  if (!checklist) {
    return null;
  }

  if (checklist.missing.length === 0 && !isComplete) {
    return null;
  }

  return (
    <View style={[
      styles.container,
      isComplete && styles.containerComplete
    ]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons 
            name={isComplete ? "checkmark-circle" : "document-text"} 
            size={24} 
            color={isComplete ? colors.success : colors.warning} 
          />
          <Text style={styles.title}>
            {isComplete 
              ? t('documents.allDocumentsComplete', '¡Documentos Completos!') 
              : t('documents.missingDocuments', 'Documentos Faltantes')
            }
          </Text>
        </View>
        <View style={[
          styles.progressBadge,
          isComplete && styles.progressBadgeComplete
        ]}>
          <Text style={[
            styles.progressText,
            isComplete && styles.progressTextComplete
          ]}>
            {checklist.uploaded.length}/{checklist.required.length}
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View 
          style={[
            styles.progressBarFill, 
            { 
              width: `${checklist.completion_percentage}%`,
              backgroundColor: checklist.completion_percentage === 100 
                ? colors.success 
                : colors.warning
            }
          ]} 
        />
      </View>
      <Text style={styles.progressLabel}>
        {checklist.completion_percentage}% {t('common.complete', 'Completo')}
      </Text>

      {/* Missing Documents List */}
      <View style={styles.missingList}>
        {checklist.missing.slice(0, 3).map((doc, index) => (
          <View key={index} style={styles.missingItem}>
            <Ionicons name="alert-circle" size={18} color={colors.error} />
            <Text style={styles.missingText}>{doc}</Text>
          </View>
        ))}
        {checklist.missing.length > 3 && (
          <Text style={styles.moreText}>
            +{checklist.missing.length - 3} {t('common.more', 'más')}
          </Text>
        )}
      </View>

      {/* Completion Message or Upload Button */}
      {isComplete ? (
        <View style={styles.completionMessage}>
          <Ionicons name="trophy" size={32} color={colors.success} />
          <Text style={styles.completionTitle}>
            {t('documents.congratulations', '¡Felicidades!')}
          </Text>
          <Text style={styles.completionText}>
            {t('documents.allDocumentsUploaded', 'Has completado todos los documentos requeridos. ¡Ganaste 50 créditos!')}
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => router.push('/(tabs)/documents')}
          activeOpacity={0.7}
        >
          <Ionicons name="cloud-upload" size={20} color="#FFF" />
          <Text style={styles.uploadButtonText}>
            {t('documents.uploadNow', 'Subir Ahora')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.warning + '30',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  containerComplete: {
    borderColor: colors.success + '50',
    backgroundColor: colors.success + '10',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  progressBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  missingList: {
    gap: 10,
    marginBottom: 16,
  },
  missingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.background,
    padding: 8,
    borderRadius: 8,
  },
  missingText: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
    fontWeight: '500',
  },
  moreText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginLeft: 26,
  },
  uploadButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  uploadButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  progressBadgeComplete: {
    backgroundColor: colors.success + '30',
  },
  progressTextComplete: {
    color: colors.success,
  },
  completionMessage: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  completionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.success,
    textAlign: 'center',
  },
  completionText: {
    fontSize: 14,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 20,
  },
});
