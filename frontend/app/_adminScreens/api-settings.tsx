import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';
import AdminHeader from '../../components/admin/AdminHeader';

interface Config {
  [key: string]: any;
}

interface ServiceConfig {
  name: string;
  icon: string;
  color: string;
  fields: {
    key: string;
    label: string;
    type: 'text' | 'password';
    placeholder: string;
  }[];
}

export default function APISettingsScreen() {
  const router = useRouter();
  const [configs, setConfigs] = useState<Config>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedService, setExpandedService] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Config>({});
  const [showSensitive, setShowSensitive] = useState<{[key: string]: boolean}>({});

  const services: ServiceConfig[] = [
    {
      name: 'Twilio (SMS)',
      icon: 'chatbubbles',
      color: '#F22F46',
      fields: [
        { key: 'twilio_account_sid', label: 'Account SID', type: 'text', placeholder: 'AC...' },
        { key: 'twilio_auth_token', label: 'Auth Token', type: 'password', placeholder: '****' },
        { key: 'twilio_phone_number', label: 'Phone Number', type: 'text', placeholder: '+1...' },
      ],
    },
    {
      name: 'SendGrid (Email)',
      icon: 'mail',
      color: '#1A82E2',
      fields: [
        { key: 'sendgrid_api_key', label: 'API Key', type: 'password', placeholder: 'SG...' },
        { key: 'sendgrid_from_email', label: 'From Email', type: 'text', placeholder: 'noreply@...' },
      ],
    },
    {
      name: 'OpenAI / Emergent',
      icon: 'bulb',
      color: '#10A37F',
      fields: [
        { key: 'emergent_llm_key', label: 'Emergent LLM Key', type: 'password', placeholder: 'sk-emergent-...' },
        { key: 'openai_api_key', label: 'OpenAI API Key', type: 'password', placeholder: 'sk-...' },
      ],
    },
    {
      name: 'Stripe (Payments)',
      icon: 'card',
      color: '#635BFF',
      fields: [
        { key: 'stripe_secret_key', label: 'Secret Key', type: 'password', placeholder: 'sk_...' },
        { key: 'stripe_publishable_key', label: 'Publishable Key', type: 'text', placeholder: 'pk_...' },
      ],
    },
    {
      name: 'Rise CRM',
      icon: 'business',
      color: '#FF6B6B',
      fields: [
        { key: 'rise_crm_url', label: 'CRM URL', type: 'text', placeholder: 'https://...' },
        { key: 'rise_crm_api_token', label: 'API Token', type: 'password', placeholder: '****' },
      ],
    },
  ];

  useEffect(() => {
    loadConfigurations();
  }, []);

  const loadConfigurations = async () => {
    try {
      const response = await api.get('/admin/config');

      if (response.data.success) {
        setConfigs(response.data.configs || {});
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Error loading configurations');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveField = async (key: string) => {
    if (!editedValues[key]) return;

    setSaving(true);
    try {
      await api.post('/admin/config', { key, value: editedValues[key] });

      // Actualizar config local
      setConfigs({ ...configs, [key]: editedValues[key] });
      setEditedValues({ ...editedValues, [key]: undefined });

      Alert.alert('Success', 'Configuration saved successfully');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Error saving configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTestService = async (serviceName: string) => {
    try {
      const serviceKey = serviceName.toLowerCase().split(' ')[0]; // 'twilio' | 'sendgrid'

      const response = await api.post('/admin/config/test', { service: serviceKey });

      if (response.data.success) {
        Alert.alert('Test Successful', response.data.message);
      } else {
        Alert.alert('Test Failed', response.data.message);
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Error testing service');
    }
  };

  const handleInitializeFromEnv = async () => {
    Alert.alert(
      'Initialize from .env?',
      'This will copy configurations from environment variables to the database. Existing values will not be overwritten.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Initialize',
          onPress: async () => {
            try {
              await api.post('/admin/config/initialize', {});

              Alert.alert('Success', 'Configurations initialized');
              loadConfigurations();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Error initializing');
            }
          },
        },
      ]
    );
  };

  const renderServiceCard = (service: ServiceConfig) => {
    const isExpanded = expandedService === service.name;
    const hasAllFields = service.fields.every(f => configs[f.key]);

    return (
      <View key={service.name} style={styles.serviceCard}>
        <TouchableOpacity
          style={styles.serviceHeader}
          onPress={() => setExpandedService(isExpanded ? null : service.name)}
        >
          <View style={styles.serviceHeaderLeft}>
            <View style={[styles.serviceIcon, { backgroundColor: service.color }]}>
              <Ionicons name={service.icon as any} size={24} color="#FFF" />
            </View>
            <View>
              <Text style={styles.serviceName}>{service.name}</Text>
              <Text style={styles.serviceStatus}>
                {hasAllFields ? '✅ Configured' : '⚠️ Not configured'}
              </Text>
            </View>
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={24}
            color="#666"
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.serviceBody}>
            {service.fields.map(field => {
              const currentValue = editedValues[field.key] !== undefined 
                ? editedValues[field.key] 
                : configs[field.key] || '';
              const isPassword = field.type === 'password';
              const shouldShow = showSensitive[field.key];

              return (
                <View key={field.key} style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <View style={styles.fieldInputRow}>
                    <TextInput
                      style={styles.fieldInput}
                      value={currentValue}
                      onChangeText={(text) =>
                        setEditedValues({ ...editedValues, [field.key]: text })
                      }
                      placeholder={field.placeholder}
                      secureTextEntry={isPassword && !shouldShow}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {isPassword && (
                      <TouchableOpacity
                        style={styles.eyeButton}
                        onPress={() =>
                          setShowSensitive({ ...showSensitive, [field.key]: !shouldShow })
                        }
                      >
                        <Ionicons
                          name={shouldShow ? 'eye-off' : 'eye'}
                          size={20}
                          color="#666"
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                  {editedValues[field.key] !== undefined && (
                    <TouchableOpacity
                      style={styles.saveButton}
                      onPress={() => handleSaveField(field.key)}
                      disabled={saving}
                    >
                      <Text style={styles.saveButtonText}>
                        {saving ? 'Saving...' : 'Save'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}

            {(service.name.includes('Twilio') || service.name.includes('SendGrid')) && (
              <TouchableOpacity
                style={styles.testButton}
                onPress={() => handleTestService(service.name)}
              >
                <Ionicons name="flask" size={20} color="#FFF" />
                <Text style={styles.testButtonText}>Test Configuration</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8B1513" />
        <Text style={styles.loadingText}>Loading configurations...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AdminHeader title="Configuración API" />
      
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.subtitle}>
            Manage all API integrations and credentials
          </Text>
        </View>

      <View style={styles.actionsCard}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleInitializeFromEnv}
        >
          <Ionicons name="download" size={20} color="#8B1513" />
          <Text style={styles.actionButtonText}>Initialize from .env</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={loadConfigurations}
        >
          <Ionicons name="refresh" size={20} color="#8B1513" />
          <Text style={styles.actionButtonText}>Reload</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={24} color="#3498db" />
        <Text style={styles.infoText}>
          Configurations saved here will persist in the database and take priority over .env variables.
          The system will remain active even after server restarts.
        </Text>
      </View>

      {services.map(service => renderServiceCard(service))}

      <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  headerBar: {
    backgroundColor: '#8B1513',
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
  },
  headerBarTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginRight: 40, // Para compensar el botón de regreso
  },
  headerBarSpacer: {
    width: 40,
  },
  scrollContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#8B1513',
    padding: 24,
    paddingTop: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#FFF',
    opacity: 0.9,
  },
  actionsCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#8B1513',
    gap: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B1513',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    gap: 12,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1976D2',
    lineHeight: 20,
  },
  serviceCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  serviceHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  serviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  serviceStatus: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  serviceBody: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  fieldInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldInput: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
  },
  eyeButton: {
    marginLeft: 8,
    padding: 8,
  },
  saveButton: {
    backgroundColor: '#8B1513',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  testButton: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 8,
  },
  testButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
