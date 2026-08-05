import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import AdminHeader from '../../components/admin/AdminHeader';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

export default function AffiliateLinkManagement() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingLink, setEditingLink] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  
  // Form state
  const [serviceName, setServiceName] = useState('');
  const [serviceType, setServiceType] = useState('credit_card');
  const [affiliateUrl, setAffiliateUrl] = useState('');
  const [descriptionEs, setDescriptionEs] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [benefitsEs, setBenefitsEs] = useState('');
  const [benefitsEn, setBenefitsEn] = useState('');
  const [buttonTextEs, setButtonTextEs] = useState('Aplicar ahora');
  const [buttonTextEn, setButtonTextEn] = useState('Apply now');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    loadLinks();
  }, []);

  const loadLinks = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/affiliate-links');
      setLinks(response.data.links || []);
    } catch (error) {
      console.error('Error loading affiliate links:', error);
      Alert.alert('Error', 'No se pudieron cargar los enlaces de afiliados');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validate
    if (!serviceName || !affiliateUrl || !descriptionEs) {
      Alert.alert('Error', 'Por favor completa los campos requeridos');
      return;
    }

    try {
      const benefitsArrayEs = benefitsEs
        .split('\n')
        .filter(b => b.trim())
        .map(b => b.trim());
      
      const benefitsArrayEn = benefitsEn
        .split('\n')
        .filter(b => b.trim())
        .map(b => b.trim());

      const payload = {
        service_name: serviceName,
        service_type: serviceType,
        affiliate_url: affiliateUrl,
        description_es: descriptionEs,
        description_en: descriptionEn || descriptionEs,
        benefits_es: benefitsArrayEs,
        benefits_en: benefitsArrayEn.length > 0 ? benefitsArrayEn : benefitsArrayEs,
        button_text_es: buttonTextEs,
        button_text_en: buttonTextEn,
        is_active: isActive,
      };

      if (editingLink) {
        // Update existing
        await api.put(`/admin/affiliate-links/${editingLink.id}`, payload);
        Alert.alert('Éxito', 'Enlace actualizado correctamente');
      } else {
        // Create new
        await api.post('/admin/affiliate-links', payload);
        Alert.alert('Éxito', 'Enlace creado correctamente');
      }

      resetForm();
      loadLinks();
    } catch (error: any) {
      console.error('Error saving affiliate link:', error);
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo guardar el enlace');
    }
  };

  const handleEdit = (link: any) => {
    setEditingLink(link);
    setServiceName(link.service_name);
    setServiceType(link.service_type);
    setAffiliateUrl(link.affiliate_url);
    setDescriptionEs(link.description_es);
    setDescriptionEn(link.description_en);
    setBenefitsEs((link.benefits_es || []).join('\n'));
    setBenefitsEn((link.benefits_en || []).join('\n'));
    setButtonTextEs(link.button_text_es || 'Aplicar ahora');
    setButtonTextEn(link.button_text_en || 'Apply now');
    setIsActive(link.is_active);
    setModalVisible(true);
  };

  const handleDelete = async (linkId: string) => {
    const confirmDelete = Platform.OS === 'web' 
      ? window.confirm('¿Estás seguro de eliminar este enlace?')
      : await new Promise(resolve => {
          Alert.alert(
            'Confirmar',
            '¿Estás seguro de eliminar este enlace?',
            [
              { text: 'Cancelar', onPress: () => resolve(false), style: 'cancel' },
              { text: 'Eliminar', onPress: () => resolve(true), style: 'destructive' }
            ]
          );
        });

    if (!confirmDelete) return;

    try {
      await api.delete(`/admin/affiliate-links/${linkId}`);
      Alert.alert('Éxito', 'Enlace eliminado correctamente');
      loadLinks();
    } catch (error) {
      console.error('Error deleting link:', error);
      Alert.alert('Error', 'No se pudo eliminar el enlace');
    }
  };

  const resetForm = () => {
    setEditingLink(null);
    setServiceName('');
    setServiceType('credit_card');
    setAffiliateUrl('');
    setDescriptionEs('');
    setDescriptionEn('');
    setBenefitsEs('');
    setBenefitsEn('');
    setButtonTextEs('Aplicar ahora');
    setButtonTextEn('Apply now');
    setIsActive(true);
    setModalVisible(false);
  };

  const createYendoDefault = async () => {
    const yendoData = {
      service_name: 'Yendo',
      service_type: 'credit_card',
      affiliate_url: 'https://apply.yendo.com/',
      description_es: 'Yendo es la tarjeta de crédito respaldada por tu vehículo. Funciona como una Mastercard® normal, pero aprovecha el valor de tu auto para obtener límites más altos a tasas asequibles.',
      description_en: 'Yendo is the credit card powered by your car. It works like a regular Mastercard®, but taps into your vehicle equity to get higher limits at affordable rates.',
      benefits_es: [
        'Hasta $10,000 en crédito',
        'Pre-aprobación sin impacto en tu crédito',
        '1.5% cashback ilimitado',
        'Construye tu historial crediticio',
        'Todos los scores de crédito son bienvenidos'
      ],
      benefits_en: [
        'Up to $10,000 in credit',
        'No credit impact for pre-approval',
        'Unlimited 1.5% cashback',
        'Build your credit',
        'All credit scores welcome'
      ],
      button_text_es: 'Aplicar Ahora',
      button_text_en: 'Apply Now',
      is_active: true
    };

    try {
      await api.post('/admin/affiliate-links', yendoData);
      Alert.alert('Éxito', 'Enlace de Yendo creado correctamente');
      loadLinks();
    } catch (error) {
      console.error('Error creating Yendo link:', error);
      Alert.alert('Error', 'No se pudo crear el enlace de Yendo');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <AdminHeader 
          title="Enlaces de Afiliados" 
          subtitle="Gestión de enlaces"
          showBack 
          rightAction={{
            icon: 'add',
            onPress: () => setModalVisible(true)
          }}
        />
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando enlaces...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AdminHeader 
        title="Enlaces de Afiliados" 
        subtitle="Gestión de enlaces"
        showBack 
        rightAction={{
          icon: 'add',
          onPress: () => setModalVisible(true)
        }}
      />
      <ScrollView style={styles.scrollContent}>
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            Gestiona los enlaces de afiliados que se mostrarán a los clientes
          </Text>
        </View>

        {/* Quick action: Create Yendo link if none exists */}
        {links.length === 0 && (
          <TouchableOpacity
            onPress={createYendoDefault}
            style={styles.quickActionButton}
          >
            <Ionicons name="flash" size={20} color={colors.primary} />
            <Text style={styles.quickActionText}>Crear enlace de Yendo automáticamente</Text>
          </TouchableOpacity>
        )}

      {/* Links List */}
      {links.length === 0 && !modalVisible ? (
        <View style={styles.emptyState}>
          <Ionicons name="link-outline" size={64} color={colors.textGray} />
          <Text style={styles.emptyText}>No hay enlaces configurados</Text>
          <Text style={styles.emptySubtext}>
            Crea tu primer enlace de afiliado para mostrarlo a los clientes
          </Text>
        </View>
      ) : (
        <View style={styles.linksList}>
          {links.map((link) => (
            <View key={link.id} style={styles.linkCard}>
              <View style={styles.linkHeader}>
                <View style={styles.linkTitleRow}>
                  <Ionicons name="card" size={24} color={colors.primary} />
                  <View style={styles.linkInfo}>
                    <Text style={styles.linkName}>{link.service_name}</Text>
                    <Text style={styles.linkType}>{link.service_type}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: link.is_active ? colors.success + '20' : colors.error + '20' }]}>
                    <Text style={[styles.statusText, { color: link.is_active ? colors.success : colors.error }]}>
                      {link.is_active ? 'Activo' : 'Inactivo'}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={styles.linkDescription} numberOfLines={2}>
                {link.description_es}
              </Text>

              <Text style={styles.linkUrl} numberOfLines={1}>
                🔗 {link.affiliate_url}
              </Text>

              {link.benefits_es && link.benefits_es.length > 0 && (
                <Text style={styles.benefitsCount}>
                  ✨ {link.benefits_es.length} beneficios
                </Text>
              )}

              <View style={styles.linkActions}>
                <TouchableOpacity
                  onPress={() => handleEdit(link)}
                  style={styles.editButton}
                >
                  <Ionicons name="pencil" size={20} color={colors.primary} />
                  <Text style={styles.editButtonText}>Editar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleDelete(link.id)}
                  style={styles.deleteButton}
                >
                  <Ionicons name="trash" size={20} color={colors.error} />
                  <Text style={styles.deleteButtonText}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Form Modal */}
      {modalVisible && (
        <View style={styles.formContainer}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>
              {editingLink ? 'Editar Enlace' : 'Nuevo Enlace'}
            </Text>
            <TouchableOpacity onPress={resetForm}>
              <Ionicons name="close" size={28} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formScroll}>
            <Text style={styles.label}>Nombre del Servicio *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Yendo"
              value={serviceName}
              onChangeText={setServiceName}
            />

            <Text style={styles.label}>Tipo de Servicio</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: credit_card"
              value={serviceType}
              onChangeText={setServiceType}
            />

            <Text style={styles.label}>URL de Afiliado *</Text>
            <TextInput
              style={styles.input}
              placeholder="https://..."
              value={affiliateUrl}
              onChangeText={setAffiliateUrl}
              autoCapitalize="none"
              keyboardType="url"
            />

            <Text style={styles.label}>Descripción (Español) *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('admin.spanishDescPlaceholder', 'Descripción del servicio en español')}
              value={descriptionEs}
              onChangeText={setDescriptionEs}
              multiline
              numberOfLines={4}
            />

            <Text style={styles.label}>Descripción (Inglés)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('admin.englishDescPlaceholder', 'Descripción del servicio en inglés')}
              value={descriptionEn}
              onChangeText={setDescriptionEn}
              multiline
              numberOfLines={4}
            />

            <Text style={styles.label}>Beneficios (Español) - uno por línea</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('admin.benefitsPlaceholder', "Hasta $10,000 en crédito\n1.5% cashback ilimitado\n...")}
              value={benefitsEs}
              onChangeText={setBenefitsEs}
              multiline
              numberOfLines={5}
            />

            <Text style={styles.label}>Beneficios (Inglés) - uno por línea</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Up to $10,000 in credit&#10;Unlimited 1.5% cashback&#10;..."
              value={benefitsEn}
              onChangeText={setBenefitsEn}
              multiline
              numberOfLines={5}
            />

            <Text style={styles.label}>Texto del Botón (Español)</Text>
            <TextInput
              style={styles.input}
              placeholder="Aplicar ahora"
              value={buttonTextEs}
              onChangeText={setButtonTextEs}
            />

            <Text style={styles.label}>Texto del Botón (Inglés)</Text>
            <TextInput
              style={styles.input}
              placeholder="Apply now"
              value={buttonTextEn}
              onChangeText={setButtonTextEn}
            />

            <View style={styles.switchContainer}>
              <Text style={styles.label}>¿Activo?</Text>
              <Switch
                value={isActive}
                onValueChange={setIsActive}
                trackColor={{ false: '#ccc', true: colors.primary + '80' }}
                thumbColor={isActive ? colors.primary : '#f4f3f4'}
              />
            </View>

            <View style={styles.formActions}>
              <TouchableOpacity
                onPress={resetForm}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSave}
                style={styles.saveButton}
              >
                <Text style={styles.saveButtonText}>Guardar</Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      )}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textGray,
  },
  scrollContent: {
    flex: 1,
    padding: 16,
  },
  infoCard: {
    backgroundColor: '#EBF5FF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    padding: 12,
    backgroundColor: colors.primary + '10',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  quickActionText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 15,
    color: colors.textGray,
    textAlign: 'center',
    marginTop: 8,
  },
  linksList: {
    padding: 16,
  },
  linkCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  linkHeader: {
    marginBottom: 12,
  },
  linkTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  linkInfo: {
    flex: 1,
  },
  linkName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  linkType: {
    fontSize: 13,
    color: colors.textGray,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  linkDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  linkUrl: {
    fontSize: 13,
    color: colors.primary,
    marginBottom: 8,
  },
  benefitsCount: {
    fontSize: 13,
    color: colors.success,
    marginBottom: 16,
  },
  linkActions: {
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 16,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: colors.primary + '10',
    borderRadius: 12,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: colors.error + '10',
    borderRadius: 12,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.error,
  },
  formContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    marginTop: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  formScroll: {
    maxHeight: 600,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: '#F9FAFB',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});