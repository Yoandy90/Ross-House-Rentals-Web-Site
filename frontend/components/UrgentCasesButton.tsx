import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../constants/colors';
import { useRouter } from 'expo-router';
import api from '../services/api';

interface UrgentCase {
  id: string;
  client_name: string;
  client_email: string;
  status: string;
  deadline: string;
  days_until_deadline: number;
  missing_items: string[];
}

interface UrgentCasesButtonProps {
  onPress?: () => void;
}

export default function UrgentCasesButton({ onPress }: UrgentCasesButtonProps) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  
  const [urgentCount, setUrgentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [urgentCases, setUrgentCases] = useState<UrgentCase[]>([]);

  useEffect(() => {
    loadUrgentCount();
    // Refresh every 5 minutes
    const interval = setInterval(loadUrgentCount, 300000);
    return () => clearInterval(interval);
  }, []);

  const loadUrgentCount = async () => {
    try {
      const response = await api.get('/admin/urgent-cases/count');
      setUrgentCount(response.data.count || 0);
    } catch (error) {
      console.error('Error loading urgent cases:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUrgentCases = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/urgent-cases');
      setUrgentCases(response.data.cases || []);
    } catch (error) {
      console.error('Error loading urgent cases details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      loadUrgentCases();
      setModalVisible(true);
    }
  };

  const getUrgencyColor = (days: number) => {
    if (days <= 2) return colors.error;
    if (days <= 5) return '#FF9800';
    return colors.warning;
  };

  const renderUrgentCase = ({ item }: { item: UrgentCase }) => (
    <TouchableOpacity
      style={styles.caseCard}
      onPress={() => {
        setModalVisible(false);
        // Navigate to client detail (implement navigation logic)
        router.push(`/(admin)/clients`);
      }}
      activeOpacity={0.7}
    >
      <View style={styles.caseHeader}>
        <View style={styles.caseInfo}>
          <Text style={styles.caseName}>{item.client_name}</Text>
          <Text style={styles.caseEmail}>{item.client_email}</Text>
        </View>
        <View style={[styles.urgencyBadge, { backgroundColor: getUrgencyColor(item.days_until_deadline) + '20' }]}>
          <Ionicons name="time" size={16} color={getUrgencyColor(item.days_until_deadline)} />
          <Text style={[styles.urgencyText, { color: getUrgencyColor(item.days_until_deadline) }]}>
            {item.days_until_deadline}d
          </Text>
        </View>
      </View>

      <View style={styles.caseStatus}>
        <Text style={styles.statusLabel}>Status:</Text>
        <Text style={styles.statusValue}>{item.status}</Text>
      </View>

      {item.missing_items.length > 0 && (
        <View style={styles.missingItems}>
          <Text style={styles.missingLabel}>Faltante:</Text>
          <Text style={styles.missingText} numberOfLines={2}>
            {item.missing_items.join(', ')}
          </Text>
        </View>
      )}

      <View style={styles.caseFooter}>
        <Ionicons name="calendar" size={14} color={colors.textSecondary} />
        <Text style={styles.deadlineText}>
          Deadline: {new Date(item.deadline).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading && urgentCount === 0) {
    return (
      <TouchableOpacity style={styles.button} disabled>
        <ActivityIndicator size="small" color="#FFF" />
      </TouchableOpacity>
    );
  }

  if (urgentCount === 0) {
    return null; // Don't show button if no urgent cases
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.button, { opacity: loading ? 0.7 : 1 }]}
        onPress={handlePress}
        activeOpacity={0.8}
        disabled={loading}
      >
        <View style={styles.iconContainer}>
          <Ionicons name="alert-circle" size={24} color="#FFF" />
          {urgentCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {urgentCount > 99 ? '99+' : urgentCount}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.buttonTitle}>Casos Urgentes</Text>
          <Text style={styles.buttonSubtitle}>Requieren atención</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#FFF" />
      </TouchableOpacity>

      {/* Modal with urgent cases list */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Casos Urgentes ({urgentCases.length})
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : urgentCases.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle" size={64} color={colors.success} />
                <Text style={styles.emptyText}>¡No hay casos urgentes!</Text>
              </View>
            ) : (
              <FlatList
                data={urgentCases}
                renderItem={renderUrgentCase}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  button: {
    backgroundColor: colors.error,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  iconContainer: {
    position: 'relative',
    marginRight: 12,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FFF',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.error,
    fontSize: 11,
    fontWeight: '700',
  },
  textContainer: {
    flex: 1,
  },
  buttonTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  buttonSubtitle: {
    color: '#FFF',
    fontSize: 13,
    opacity: 0.9,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingTop: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: colors.textSecondary,
    marginTop: 16,
  },
  caseCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  caseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  caseInfo: {
    flex: 1,
  },
  caseName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  caseEmail: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  urgencyText: {
    fontSize: 13,
    fontWeight: '700',
  },
  caseStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginRight: 6,
  },
  statusValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  missingItems: {
    backgroundColor: colors.warning + '10',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  missingLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.warning,
    marginBottom: 4,
  },
  missingText: {
    fontSize: 13,
    color: colors.text,
  },
  caseFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deadlineText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
