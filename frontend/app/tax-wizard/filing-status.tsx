/**
 * Mi Reembolso - Filing Status Screen
 * Step 2: Select filing status and spouse info if applicable
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

interface FilingStatusOption {
  id: string;
  name: string;
  name_es: string;
  description: string;
}

export default function FilingStatusScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filingStatuses, setFilingStatuses] = useState<FilingStatusOption[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  // Spouse info (for married filing jointly)
  const [spouseFirstName, setSpouseFirstName] = useState('');
  const [spouseLastName, setSpouseLastName] = useState('');
  const [spouseSsn, setSpouseSsn] = useState('');
  const [spouseDob, setSpouseDob] = useState('');

  const needsSpouseInfo = selectedStatus === 'married_filing_jointly';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load filing statuses
      const statusResponse = await api.get('/tax-wizard/filing-statuses');
      if (statusResponse.data.success) {
        setFilingStatuses(statusResponse.data.filing_statuses);
      }

      // Load existing session data
      if (sessionId) {
        const sessionResponse = await api.get(`/tax-wizard/session/${sessionId}`);
        if (sessionResponse.data.success) {
          const session = sessionResponse.data.session;
          if (session.filing_status) {
            setSelectedStatus(session.filing_status);
          }
          if (session.spouse_info) {
            setSpouseFirstName(session.spouse_info.first_name || '');
            setSpouseLastName(session.spouse_info.last_name || '');
            setSpouseSsn(session.spouse_info.ssn || '');
            setSpouseDob(session.spouse_info.date_of_birth || '');
          }
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatSSN = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 5) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 5)}-${numbers.slice(5, 9)}`;
  };

  const formatDate = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 4) return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
  };

  const handleSave = async () => {
    if (!selectedStatus) {
      Alert.alert(t('common.error'), t('wizard.filingStatus.selectStatus'));
      return;
    }

    if (needsSpouseInfo && (!spouseFirstName || !spouseLastName || !spouseSsn)) {
      Alert.alert(t('common.error'), t('wizard.filingStatus.completeSpouse'));
      return;
    }

    setSaving(true);
    try {
      let spouseInfo = null;
      if (needsSpouseInfo) {
        let formattedDob = '';
        if (spouseDob) {
          const parts = spouseDob.split('/');
          if (parts.length === 3) {
            formattedDob = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
          }
        }
        spouseInfo = {
          first_name: spouseFirstName,
          last_name: spouseLastName,
          ssn: spouseSsn.replace(/\D/g, ''),
          date_of_birth: formattedDob,
        };
      }

      const response = await api.post(`/tax-wizard/session/${sessionId}/filing-status`, {
        status: selectedStatus,
        spouse: spouseInfo,
      });

      if (response.data.success) {
        // Sync filing status back to profile
        try {
          await api.put('/client-profile', {
            marital_status: selectedStatus,
          });
        } catch (syncErr) {
        }
        
        router.push({
          pathname: '/tax-wizard/income',
          params: { sessionId }
        });
      }
    } catch (error) {
      console.error('Error saving:', error);
      Alert.alert(t('common.error'), t('wizard.couldNotSave'));
    } finally {
      setSaving(false);
    }
  };

  const getStatusIcon = (id: string): keyof typeof Ionicons.glyphMap => {
    const icons: { [key: string]: keyof typeof Ionicons.glyphMap } = {
      'single': 'person',
      'married_filing_jointly': 'people',
      'married_filing_separately': 'person-remove',
      'head_of_household': 'home',
      'qualifying_widow': 'heart',
    };
    return icons[id] || 'person';
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#065F46" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#065F46" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <LinearGradient colors={['#065F46', '#10B981']} style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity 
              onPress={() => router.push({
                pathname: '/tax-wizard/personal-info',
                params: { sessionId }
              })} 
              style={styles.backBtn}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Estado Civil</Text>
              <Text style={styles.headerStep}>Paso 2 de 6</Text>
            </View>
          </View>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '33.2%' }]} />
            </View>
          </View>
        </LinearGradient>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>¿Cuál es tu estado civil para efectos fiscales?</Text>
          <Text style={styles.sectionSubtitle}>
            Tu estado civil al 31 de diciembre del año fiscal
          </Text>

          {filingStatuses.map((status) => (
            <TouchableOpacity
              key={status.id}
              style={[
                styles.statusCard,
                selectedStatus === status.id && styles.statusCardSelected,
              ]}
              onPress={() => setSelectedStatus(status.id)}
            >
              <View style={[
                styles.statusIcon,
                selectedStatus === status.id && styles.statusIconSelected,
              ]}>
                <Ionicons
                  name={getStatusIcon(status.id)}
                  size={24}
                  color={selectedStatus === status.id ? '#fff' : '#6B7280'}
                />
              </View>
              <View style={styles.statusInfo}>
                <Text style={[
                  styles.statusName,
                  selectedStatus === status.id && styles.statusNameSelected,
                ]}>
                  {status.name_es}
                </Text>
                <Text style={styles.statusDescription}>{status.description}</Text>
              </View>
              {selectedStatus === status.id && (
                <View style={styles.checkMark}>
                  <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                </View>
              )}
            </TouchableOpacity>
          ))}

          {/* Spouse Info */}
          {needsSpouseInfo && (
            <View style={styles.spouseSection}>
              <Text style={styles.spouseTitle}>Información del Cónyuge</Text>

              <View style={styles.row}>
                <View style={styles.inputHalf}>
                  <Text style={styles.label}>Nombre *</Text>
                  <TextInput
                    style={styles.input}
                    value={spouseFirstName}
                    onChangeText={setSpouseFirstName}
                    placeholder={t('wizard.firstNamePlaceholder', 'María')}
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
                <View style={styles.inputHalf}>
                  <Text style={styles.label}>Apellido *</Text>
                  <TextInput
                    style={styles.input}
                    value={spouseLastName}
                    onChangeText={setSpouseLastName}
                    placeholder={t('wizard.secondLastNamePlaceholder', 'López')}
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.inputHalf}>
                  <Text style={styles.label}>SSN *</Text>
                  <TextInput
                    style={styles.input}
                    value={spouseSsn}
                    onChangeText={(v) => setSpouseSsn(formatSSN(v))}
                    placeholder="XXX-XX-XXXX"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    maxLength={11}
                    secureTextEntry
                  />
                </View>
                <View style={styles.inputHalf}>
                  <Text style={styles.label}>Fecha de Nacimiento</Text>
                  <TextInput
                    style={styles.input}
                    value={spouseDob}
                    onChangeText={(v) => setSpouseDob(formatDate(v))}
                    placeholder="MM/DD/YYYY"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                </View>
              </View>
            </View>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Bottom CTA */}
        <View style={styles.bottomCTA}>
          <TouchableOpacity
            style={[
              styles.nextButton,
              !selectedStatus && styles.nextButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={!selectedStatus || saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.nextButtonText}>{t('wizard.continue')}</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#065F46',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  headerStep: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  progressContainer: {
    marginTop: 16,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 3,
  },
  content: {
    backgroundColor: '#F9FAFB',
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  statusCardSelected: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  statusIconSelected: {
    backgroundColor: '#10B981',
  },
  statusInfo: {
    flex: 1,
  },
  statusName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  statusNameSelected: {
    color: '#065F46',
  },
  statusDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
  checkMark: {
    marginLeft: 8,
  },
  spouseSection: {
    marginTop: 24,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  spouseTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  inputHalf: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  bottomCTA: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 20,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  nextButton: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  nextButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    marginRight: 8,
  },
});
