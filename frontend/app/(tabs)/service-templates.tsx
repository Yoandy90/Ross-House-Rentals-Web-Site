/**
 * Service Templates Selection Screen
 * Shows all available service templates for the client to choose
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeColors } from '../../constants/colors';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import CustomHeader from '../../components/CustomHeader';

interface ServiceTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  fields: string[];
  translations?: {
    name?: { es?: string; en?: string };
    description?: { es?: string; en?: string };
  };
}

// Category icons and colors
const CATEGORY_CONFIG: Record<string, { icon: string; color: string; label: { es: string; en: string } }> = {
  tax: {
    icon: 'document-text',
    color: '#10B981',
    labelKey: 'serviceTemplates.catTaxes',
  },
  itin: {
    icon: 'card',
    color: '#8B5CF6',
    labelKey: 'serviceTemplates.catITIN',
  },
  accounting: {
    icon: 'calculator',
    color: '#3B82F6',
    labelKey: 'serviceTemplates.catAccounting',
  },
  payroll: {
    icon: 'people',
    color: '#F59E0B',
    labelKey: 'serviceTemplates.catPayroll',
  },
  other: {
    icon: 'ellipsis-horizontal-circle',
    color: '#6B7280',
    labelKey: 'serviceTemplates.catOther',
  },
};

export default function ServiceTemplatesScreen() {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const language = (i18n.language?.split('-')[0] || 'es') as 'es' | 'en';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [templates, setTemplates] = useState<ServiceTemplate[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      // Dynamic fields templates endpoint (public read access)
      const res = await api.get('/admin/dynamic-fields/templates');
      setTemplates(res.data.templates || []);
    } catch (error) {
      console.error('Error loading templates:', error);
      Alert.alert(
        t('common.error', 'Error'),
        t('serviceTemplates.loadError', 'No se pudieron cargar los servicios. Intenta de nuevo.')
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadTemplates();
  };

  const handleSelectTemplate = (template: ServiceTemplate) => {
    router.push({
      pathname: '/(tabs)/dynamic-service-form',
      params: { templateId: template.id },
    });
  };

  // Group templates by category
  const groupedTemplates = templates.reduce((acc, template) => {
    const cat = template.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(template);
    return acc;
  }, {} as Record<string, ServiceTemplate[]>);

  // Get unique categories
  const categories = Object.keys(groupedTemplates);

  // Filter templates by selected category
  const displayedTemplates = selectedCategory
    ? groupedTemplates[selectedCategory] || []
    : templates;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <CustomHeader
          title={t('serviceTemplates.title', 'Servicios')}
          showBack
          onBackPress={() => router.back()}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>
            {t('serviceTemplates.loading', 'Cargando servicios...')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <CustomHeader
        title={t('serviceTemplates.requestService', 'Solicitar Servicio')}
        showBack
        onBackPress={() => router.back()}
      />

      {/* Hero Section */}
      <View style={styles.heroSection}>
        <View style={styles.heroIcon}>
          <Ionicons name="briefcase" size={40} color="#FFF" />
        </View>
        <Text style={styles.heroTitle}>
          {t('serviceTemplates.whatService', '¿Qué servicio necesitas?')}
        </Text>
        <Text style={styles.heroSubtitle}>
          {t('serviceTemplates.selectService', 'Selecciona un servicio para comenzar tu solicitud')}
        </Text>
      </View>

      {/* Category Filters */}
      {categories.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryContent}
        >
          <TouchableOpacity
            style={[
              styles.categoryChip,
              !selectedCategory && styles.categoryChipActive,
            ]}
            onPress={() => setSelectedCategory(null)}
          >
            <Ionicons
              name="apps"
              size={16}
              color={!selectedCategory ? '#FFF' : colors.textGray}
            />
            <Text
              style={[
                styles.categoryChipText,
                !selectedCategory && styles.categoryChipTextActive,
              ]}
            >
              {t('serviceTemplates.all', 'Todos')}
            </Text>
          </TouchableOpacity>

          {categories.map((cat) => {
            const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.other;
            const isActive = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryChip,
                  isActive && { backgroundColor: config.color },
                ]}
                onPress={() => setSelectedCategory(isActive ? null : cat)}
              >
                <Ionicons
                  name={config.icon as any}
                  size={16}
                  color={isActive ? '#FFF' : config.color}
                />
                <Text
                  style={[
                    styles.categoryChipText,
                    isActive && styles.categoryChipTextActive,
                  ]}
                >
                  {config.label[language]}
                </Text>
                <View
                  style={[
                    styles.categoryBadge,
                    isActive && { backgroundColor: 'rgba(255,255,255,0.3)' },
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryBadgeText,
                      isActive && { color: '#FFF' },
                    ]}
                  >
                    {groupedTemplates[cat]?.length || 0}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Templates List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {displayedTemplates.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={64} color={colors.textGray} />
            <Text style={styles.emptyTitle}>
              {t('serviceTemplates.noServices', 'No hay servicios disponibles')}
            </Text>
            <Text style={styles.emptyText}>
              {language === 'es'
                ? 'Pronto agregaremos más servicios.'
                : 'We will add more services soon.'}
            </Text>
          </View>
        ) : (
          displayedTemplates.map((template) => {
            const name = template.translations?.name?.[language] || template.name;
            const description =
              template.translations?.description?.[language] || template.description;

            return (
              <TouchableOpacity
                key={template.id}
                style={styles.templateCard}
                onPress={() => handleSelectTemplate(template)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.templateIcon,
                    { backgroundColor: template.color + '20' },
                  ]}
                >
                  <Ionicons
                    name={(template.icon || 'document-text') as any}
                    size={28}
                    color={template.color}
                  />
                </View>

                <View style={styles.templateContent}>
                  <Text style={styles.templateName}>{name}</Text>
                  <Text style={styles.templateDescription} numberOfLines={2}>
                    {description}
                  </Text>
                  <View style={styles.templateMeta}>
                    <View style={styles.templateFields}>
                      <Ionicons name="list" size={14} color={colors.textGray} />
                      <Text style={styles.templateFieldsText}>
                        {template.fields?.length || 0}{' '}
                        {t('serviceTemplates.fields', 'campos')}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.categoryTag,
                        {
                          backgroundColor:
                            (CATEGORY_CONFIG[template.category] || CATEGORY_CONFIG.other)
                              .color + '20',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryTagText,
                          {
                            color:
                              (CATEGORY_CONFIG[template.category] || CATEGORY_CONFIG.other)
                                .color,
                          },
                        ]}
                      >
                        {(CATEGORY_CONFIG[template.category] || CATEGORY_CONFIG.other).label[
                          language
                        ]}
                      </Text>
                    </View>
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={24} color={colors.textGray} />
              </TouchableOpacity>
            );
          })
        )}

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color={colors.primary} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>
              {t('serviceTemplates.needHelp', '¿Necesitas ayuda?')}
            </Text>
            <Text style={styles.infoText}>
              {language === 'es'
                ? 'Si no encuentras el servicio que necesitas, contáctanos directamente para asistencia personalizada.'
                : 'If you cannot find the service you need, contact us directly for personalized assistance.'}
            </Text>
            <TouchableOpacity
              style={styles.contactButton}
              onPress={() => router.push('/(tabs)/support')}
            >
              <Ionicons name="chatbubble-ellipses" size={16} color={colors.primary} />
              <Text style={styles.contactButtonText}>
                {t('serviceTemplates.contactSupport', 'Contactar Soporte')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: colors.textGray,
    },
    heroSection: {
      backgroundColor: colors.primary,
      padding: 24,
      alignItems: 'center',
    },
    heroIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    heroTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: '#FFF',
      textAlign: 'center',
    },
    heroSubtitle: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.8)',
      textAlign: 'center',
      marginTop: 8,
    },
    categoryScroll: {
      maxHeight: 56,
      backgroundColor: '#FFF',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    categoryContent: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
      flexDirection: 'row',
    },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 6,
    },
    categoryChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    categoryChipText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.text,
    },
    categoryChipTextActive: {
      color: '#FFF',
    },
    categoryBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 10,
      backgroundColor: colors.border,
    },
    categoryBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textGray,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 100,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginTop: 16,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textGray,
      textAlign: 'center',
      marginTop: 8,
    },
    templateCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFF',
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
      gap: 12,
    },
    templateIcon: {
      width: 56,
      height: 56,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    templateContent: {
      flex: 1,
    },
    templateName: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 4,
    },
    templateDescription: {
      fontSize: 13,
      color: colors.textGray,
      lineHeight: 18,
    },
    templateMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      gap: 12,
    },
    templateFields: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    templateFieldsText: {
      fontSize: 12,
      color: colors.textGray,
    },
    categoryTag: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    categoryTagText: {
      fontSize: 11,
      fontWeight: '600',
    },
    infoCard: {
      flexDirection: 'row',
      backgroundColor: colors.primary + '10',
      padding: 16,
      borderRadius: 12,
      marginTop: 8,
      gap: 12,
    },
    infoContent: {
      flex: 1,
    },
    infoTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    infoText: {
      fontSize: 13,
      color: colors.textGray,
      lineHeight: 18,
    },
    contactButton: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
      gap: 6,
    },
    contactButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
  });
