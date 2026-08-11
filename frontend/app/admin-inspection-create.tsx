import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { apiCall } from '../src/utils/api';
import { useColors } from '../src/constants/theme';

interface Property {
  _id: string;
  name: string;
  address: string;
  tenant_id?: string;
  tenant_name?: string;
  tenant_email?: string;
}

export default function AdminInspectionCreateScreen() {
  const C = useColors();
  const styles = React.useMemo(() => create_styles(C), [C]);
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [inspectionType, setInspectionType] = useState('move_in');
  const [scheduledDate, setScheduledDate] = useState('');
  const [notes, setNotes] = useState('');
  const [showPropertyPicker, setShowPropertyPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const INSPECTION_TYPES = [
    { key: 'move_in', label: t('inspections.move_in'), icon: 'log-in-outline', color: '#10b981', desc: t('inspections.move_in_desc') },
    { key: 'move_out', label: t('inspections.move_out'), icon: 'log-out-outline', color: '#ef4444', desc: t('inspections.move_out_desc') },
    { key: 'routine', label: t('inspections.routine'), icon: 'refresh-outline', color: '#8b5cf6', desc: t('inspections.routine_desc') },
  ];

  const fetchProperties = useCallback(async () => {
    try {
      console.log('[Inspections] Fetching properties using apiCall');
      const data = await apiCall('/admin/properties');
      console.log('[Inspections] Properties received:', data.properties?.length || 0);
      // Normalize properties - use address as name if name is empty
      const normalizedProperties = (data.properties || []).map((p: any) => ({
        ...p,
        name: p.name || p.address || 'Propiedad sin nombre',
      }));
      setProperties(normalizedProperties);
    } catch (e) {
      console.error('[Inspections] Fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  const filteredProperties = properties.filter(p => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      p.name?.toLowerCase().includes(query) ||
      p.address?.toLowerCase().includes(query) ||
      p.tenant_name?.toLowerCase().includes(query)
    );
  });

  const createInspection = async () => {
    if (!selectedProperty) {
      Alert.alert('Error', t('inspections.error_no_property'));
      return;
    }

    setSaving(true);
    try {
      const result = await apiCall('/admin/inspections', {
        method: 'POST',
        body: {
          property_id: selectedProperty._id,
          property_name: selectedProperty.name,
          property_address: selectedProperty.address,
          tenant_id: selectedProperty.tenant_id || '',
          tenant_name: selectedProperty.tenant_name || '',
          tenant_email: selectedProperty.tenant_email || '',
          inspection_type: inspectionType,
          scheduled_date: scheduledDate,
          inspector_name: user?.name || 'Admin',
          notes: notes,
        },
      });
      
      if (result.inspection) {
        Alert.alert('✅', t('inspections.created_success'), [
          { text: t('inspections.view_detail'), onPress: () => router.replace(`/admin-inspection-detail?id=${result.inspection._id}`) },
          { text: t('inspections.back_to_list'), onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('Error', result.detail || t('inspections.error_create'));
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#C8102E" />
          <Text style={styles.loadingText}>Cargando propiedades...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={C.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{t('inspections.new_inspection')}</Text>
          <Text style={styles.headerSubtitle}>{t('inspections.create_subtitle')}</Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Property Selection */}
        <Text style={styles.sectionTitle}>🏠 {t('inspections.property')}</Text>
        <TouchableOpacity 
          style={styles.propertySelector}
          onPress={() => setShowPropertyPicker(true)}
        >
          {selectedProperty ? (
            <View style={styles.selectedProperty}>
              <Ionicons name="home" size={20} color="#C8102E" />
              <View style={styles.selectedPropertyInfo}>
                <Text style={styles.selectedPropertyName}>{selectedProperty.name}</Text>
                <Text style={styles.selectedPropertyAddress}>{selectedProperty.address}</Text>
                {selectedProperty.tenant_name && (
                  <Text style={styles.selectedPropertyTenant}>
                    {t('inspections.tenant')}: {selectedProperty.tenant_name}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={C.textMuted} />
            </View>
          ) : (
            <View style={styles.placeholderProperty}>
              <Ionicons name="add-circle-outline" size={24} color={C.textMuted} />
              <Text style={styles.placeholderText}>{t('inspections.select_property')}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Inspection Type */}
        <Text style={styles.sectionTitle}>📋 {t('inspections.type')}</Text>
        <View style={styles.typeGrid}>
          {INSPECTION_TYPES.map(type => (
            <TouchableOpacity
              key={type.key}
              style={[
                styles.typeCard,
                inspectionType === type.key && { borderColor: type.color, backgroundColor: type.color + '15' },
              ]}
              onPress={() => setInspectionType(type.key)}
            >
              <View style={[styles.typeIcon, { backgroundColor: type.color + '20' }]}>
                <Ionicons name={type.icon as any} size={24} color={type.color} />
              </View>
              <Text style={[styles.typeLabel, inspectionType === type.key && { color: type.color }]}>
                {type.label}
              </Text>
              <Text style={styles.typeDesc}>{type.desc}</Text>
              {inspectionType === type.key && (
                <View style={[styles.typeCheck, { backgroundColor: type.color }]}>
                  <Ionicons name="checkmark" size={14} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Scheduled Date */}
        <Text style={styles.sectionTitle}>📅 {t('inspections.scheduled_date')}</Text>
        <View style={styles.inputContainer}>
          <Ionicons name="calendar-outline" size={20} color={C.textMuted} />
          <TextInput
            style={styles.input}
            placeholder={t('inspections.date_placeholder')}
            placeholderTextColor={C.textMuted}
            value={scheduledDate}
            onChangeText={setScheduledDate}
          />
        </View>

        {/* Notes */}
        <Text style={styles.sectionTitle}>📝 {t('inspections.initial_notes')}</Text>
        <TextInput
          style={styles.notesInput}
          placeholder={t('inspections.notes_placeholder')}
          placeholderTextColor={C.textMuted}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={4}
        />

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color="#3b82f6" />
          <Text style={styles.infoText}>
            {t('inspections.create_info')}
          </Text>
        </View>

        {/* Create Button */}
        <TouchableOpacity 
          style={[styles.createButton, (!selectedProperty || saving) && styles.createButtonDisabled]}
          onPress={createInspection}
          disabled={!selectedProperty || saving}
        >
          <LinearGradient 
            colors={selectedProperty ? ['#C8102E', '#9B1B30'] : ['#333', '#222']} 
            style={StyleSheet.absoluteFill} 
          />
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="clipboard-outline" size={22} color="#fff" />
              <Text style={styles.createButtonText}>{t('inspections.create_button')}</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Property Picker Modal */}
      {showPropertyPicker && (
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>{t('inspections.select_property')}</Text>
              <TouchableOpacity onPress={() => setShowPropertyPicker(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.pickerSearch}>
              <Ionicons name="search-outline" size={18} color={C.textMuted} />
              <TextInput
                style={styles.pickerSearchInput}
                placeholder={t('inspections.search_property')}
                placeholderTextColor={C.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <ScrollView style={styles.pickerList}>
              {filteredProperties.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>{t('inspections.no_properties')}</Text>
                </View>
              ) : (
                filteredProperties.map(property => (
                  <TouchableOpacity
                    key={property._id}
                    style={[
                      styles.propertyItem,
                      selectedProperty?._id === property._id && styles.propertyItemSelected,
                    ]}
                    onPress={() => {
                      setSelectedProperty(property);
                      setShowPropertyPicker(false);
                    }}
                  >
                    <View style={styles.propertyItemIcon}>
                      <Ionicons name="home" size={18} color="#C8102E" />
                    </View>
                    <View style={styles.propertyItemInfo}>
                      <Text style={styles.propertyItemName}>{property.name}</Text>
                      <Text style={styles.propertyItemAddress}>{property.address}</Text>
                      {property.tenant_name && (
                        <Text style={styles.propertyItemTenant}>
                          <Ionicons name="person-outline" size={12} /> {property.tenant_name}
                        </Text>
                      )}
                    </View>
                    {selectedProperty?._id === property._id && (
                      <Ionicons name="checkmark-circle" size={22} color="#10b981" />
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const create_styles = (C: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: C.textMuted,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.glassLight,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.glassLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: C.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: C.textMuted,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.textPrimary,
    marginBottom: 12,
    marginTop: 8,
  },
  propertySelector: {
    backgroundColor: C.glass,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.glassBorder,
    marginBottom: 20,
  },
  selectedProperty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectedPropertyInfo: {
    flex: 1,
  },
  selectedPropertyName: {
    fontSize: 16,
    fontWeight: '600',
    color: C.textPrimary,
  },
  selectedPropertyAddress: {
    fontSize: 13,
    color: C.textMuted,
    marginTop: 2,
  },
  selectedPropertyTenant: {
    fontSize: 12,
    color: '#10b981',
    marginTop: 4,
  },
  placeholderProperty: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  placeholderText: {
    fontSize: 15,
    color: C.textMuted,
  },
  typeGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  typeCard: {
    flex: 1,
    backgroundColor: C.glass,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  typeIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: C.textPrimary,
  },
  typeDesc: {
    fontSize: 10,
    color: C.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  typeCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.glass,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
    borderWidth: 1,
    borderColor: C.glassBorder,
    marginBottom: 20,
  },
  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: C.textPrimary,
  },
  notesInput: {
    backgroundColor: C.glass,
    borderRadius: 12,
    padding: 14,
    color: C.textPrimary,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: C.glassBorder,
    marginBottom: 20,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(59,130,246,0.1)',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 24,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: C.textSecondary,
    lineHeight: 18,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
    gap: 10,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: C.textPrimary,
  },
  // Picker Modal Styles
  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 40,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: C.glassLight,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.textPrimary,
  },
  pickerSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.glassLight,
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  pickerSearchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: C.textPrimary,
  },
  pickerList: {
    paddingHorizontal: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: C.textMuted,
  },
  propertyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.glass,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  propertyItemSelected: {
    backgroundColor: 'rgba(200,16,46,0.1)',
    borderWidth: 1,
    borderColor: '#C8102E',
  },
  propertyItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(200,16,46,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  propertyItemInfo: {
    flex: 1,
  },
  propertyItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: C.textPrimary,
  },
  propertyItemAddress: {
    fontSize: 12,
    color: C.textMuted,
    marginTop: 2,
  },
  propertyItemTenant: {
    fontSize: 11,
    color: '#10b981',
    marginTop: 4,
  },
});
