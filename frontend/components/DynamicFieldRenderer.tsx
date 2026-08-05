/**
 * DynamicFieldRenderer - Componente para renderizar campos dinámicos
 * Soporta todos los tipos de campos definidos en el schema del backend
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../constants/colors';
import { useTranslation } from 'react-i18next';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';

// Types based on backend schema
export interface FieldOption {
  value: string;
  label: string;
  translations?: { es?: string; en?: string };
  icon?: string;
  disabled?: boolean;
}

export interface FieldValidation {
  regex?: string;
  pattern_message?: string;
  min?: number;
  max?: number;
  min_length?: number;
  max_length?: number;
}

export interface FieldMeta {
  help_text?: string;
  icon?: string;
  placeholder?: string;
  width?: string;
  mask?: string;
  currency_code?: string;
  default_value?: any;
  translations?: any;
}

export interface DependsOn {
  field_id: string;
  operator: string;
  value: any;
}

export interface DynamicField {
  id: string;
  label: string;
  type: string;
  required: boolean;
  read_only: boolean;
  visible: boolean;
  validation?: FieldValidation;
  options?: FieldOption[];
  depends_on?: DependsOn[];
  repeatable?: boolean;
  fields?: DynamicField[];
  meta?: FieldMeta;
  order?: number;
  group?: string;
}

export interface FieldGroup {
  id: string;
  label: string;
  icon?: string;
  order: number;
  collapsible: boolean;
  default_collapsed?: boolean;
  translations?: { es?: string; en?: string };
}

interface Props {
  fields: DynamicField[];
  values: Record<string, any>;
  onChange: (fieldId: string, value: any) => void;
  errors?: Record<string, string>;
  groups?: FieldGroup[];
  disabled?: boolean;
  language?: 'es' | 'en';
}

// Helper to check if field should be visible based on depends_on
const shouldShowField = (field: DynamicField, values: Record<string, any>): boolean => {
  if (!field.depends_on || field.depends_on.length === 0) return field.visible !== false;
  
  return field.depends_on.every(dep => {
    const fieldValue = values[dep.field_id];
    switch (dep.operator) {
      case '==':
        return fieldValue === dep.value;
      case '!=':
        return fieldValue !== dep.value;
      case 'in':
        return Array.isArray(dep.value) && dep.value.includes(fieldValue);
      case 'not_in':
        return Array.isArray(dep.value) && !dep.value.includes(fieldValue);
      case '>':
        return fieldValue > dep.value;
      case '<':
        return fieldValue < dep.value;
      case '>=':
        return fieldValue >= dep.value;
      case '<=':
        return fieldValue <= dep.value;
      case 'is_empty':
        return !fieldValue || fieldValue === '' || (Array.isArray(fieldValue) && fieldValue.length === 0);
      case 'is_not_empty':
        return fieldValue && fieldValue !== '' && (!Array.isArray(fieldValue) || fieldValue.length > 0);
      case 'contains':
        return typeof fieldValue === 'string' && fieldValue.includes(dep.value);
      default:
        return true;
    }
  });
};

// Get translated label
const getTranslatedLabel = (field: DynamicField, language: string): string => {
  const translations = field.meta?.translations?.label;
  if (translations && translations[language]) {
    return translations[language];
  }
  return field.label;
};

// Format phone number as user types
const formatPhoneNumber = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
  return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
};

// Format SSN as user types
const formatSSN = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 5) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5, 9)}`;
};

// Format EIN as user types
const formatEIN = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 2) return cleaned;
  return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 9)}`;
};

// Format currency
const formatCurrency = (value: string): string => {
  const cleaned = value.replace(/[^\d.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) return parts[0] + '.' + parts.slice(1).join('');
  return cleaned;
};

export const DynamicFieldRenderer: React.FC<Props> = ({
  fields,
  values,
  onChange,
  errors = {},
  groups = [],
  disabled = false,
  language = 'es',
}) => {
  const colors = useThemeColors();
  const { t, i18n } = useTranslation();
  const currentLang = language || i18n.language?.split('-')[0] || 'es';
  
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    groups.forEach(g => {
      if (g.default_collapsed) initial.add(g.id);
    });
    return initial;
  });
  
  const [showDatePicker, setShowDatePicker] = useState<string | null>(null);
  const [showTimePicker, setShowTimePicker] = useState<string | null>(null);

  const styles = useMemo(() => createStyles(colors), [colors]);

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const renderField = useCallback((field: DynamicField) => {
    if (!shouldShowField(field, values)) return null;

    const label = getTranslatedLabel(field, currentLang);
    const value = values[field.id];
    const error = errors[field.id];
    const placeholder = field.meta?.placeholder || '';
    const helpText = field.meta?.help_text || '';
    const icon = field.meta?.icon;
    const isRequired = field.required;
    const isReadOnly = field.read_only || disabled;

    // Common wrapper
    const FieldWrapper = ({ children }: { children: React.ReactNode }) => (
      <View style={[styles.fieldContainer, field.meta?.width === 'half' && styles.halfWidth]}>
        {field.type !== 'checkbox' && field.type !== 'header' && field.type !== 'divider' && (
          <View style={styles.labelRow}>
            {icon && (
              <Ionicons name={icon as any} size={18} color={colors.textGray} style={styles.labelIcon} />
            )}
            <Text style={styles.label}>
              {label}
              {isRequired && <Text style={styles.required}> *</Text>}
            </Text>
          </View>
        )}
        {children}
        {helpText && <Text style={styles.helpText}>{helpText}</Text>}
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    );

    // Render based on type
    switch (field.type) {
      case 'header':
        return (
          <View key={field.id} style={styles.headerField}>
            <Text style={styles.headerText}>{label}</Text>
          </View>
        );

      case 'divider':
        return <View key={field.id} style={styles.divider} />;

      case 'info':
        return (
          <View key={field.id} style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color={colors.primary} />
            <Text style={styles.infoText}>{label}</Text>
          </View>
        );

      case 'text':
      case 'textarea':
        return (
          <FieldWrapper key={field.id}>
            <TextInput
              style={[
                styles.input,
                field.type === 'textarea' && styles.textArea,
                isReadOnly && styles.readOnly,
                error && styles.inputError,
              ]}
              value={value || ''}
              onChangeText={(text) => onChange(field.id, text)}
              placeholder={placeholder}
              placeholderTextColor={colors.textGray}
              editable={!isReadOnly}
              multiline={field.type === 'textarea'}
              numberOfLines={field.type === 'textarea' ? 4 : 1}
              maxLength={field.validation?.max_length}
            />
          </FieldWrapper>
        );

      case 'email':
        return (
          <FieldWrapper key={field.id}>
            <TextInput
              style={[styles.input, isReadOnly && styles.readOnly, error && styles.inputError]}
              value={value || ''}
              onChangeText={(text) => onChange(field.id, text.toLowerCase())}
              placeholder={placeholder || 'email@example.com'}
              placeholderTextColor={colors.textGray}
              editable={!isReadOnly}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </FieldWrapper>
        );

      case 'phone':
        return (
          <FieldWrapper key={field.id}>
            <TextInput
              style={[styles.input, isReadOnly && styles.readOnly, error && styles.inputError]}
              value={value || ''}
              onChangeText={(text) => onChange(field.id, formatPhoneNumber(text))}
              placeholder={placeholder || '(555) 123-4567'}
              placeholderTextColor={colors.textGray}
              editable={!isReadOnly}
              keyboardType="phone-pad"
              maxLength={14}
            />
          </FieldWrapper>
        );

      case 'number':
        return (
          <FieldWrapper key={field.id}>
            <TextInput
              style={[styles.input, isReadOnly && styles.readOnly, error && styles.inputError]}
              value={value?.toString() || ''}
              onChangeText={(text) => {
                const num = parseFloat(text.replace(/[^0-9.-]/g, ''));
                onChange(field.id, isNaN(num) ? '' : num);
              }}
              placeholder={placeholder || '0'}
              placeholderTextColor={colors.textGray}
              editable={!isReadOnly}
              keyboardType="numeric"
            />
          </FieldWrapper>
        );

      case 'currency':
        return (
          <FieldWrapper key={field.id}>
            <View style={[styles.currencyContainer, error && styles.inputError]}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={[styles.currencyInput, isReadOnly && styles.readOnly]}
                value={value?.toString() || ''}
                onChangeText={(text) => {
                  const formatted = formatCurrency(text);
                  const num = parseFloat(formatted);
                  onChange(field.id, isNaN(num) ? '' : num);
                }}
                placeholder="0.00"
                placeholderTextColor={colors.textGray}
                editable={!isReadOnly}
                keyboardType="decimal-pad"
              />
            </View>
          </FieldWrapper>
        );

      case 'ssn':
        return (
          <FieldWrapper key={field.id}>
            <TextInput
              style={[styles.input, isReadOnly && styles.readOnly, error && styles.inputError]}
              value={value || ''}
              onChangeText={(text) => onChange(field.id, formatSSN(text))}
              placeholder={placeholder || 'XXX-XX-XXXX'}
              placeholderTextColor={colors.textGray}
              editable={!isReadOnly}
              keyboardType="number-pad"
              maxLength={11}
              secureTextEntry
            />
          </FieldWrapper>
        );

      case 'ein':
        return (
          <FieldWrapper key={field.id}>
            <TextInput
              style={[styles.input, isReadOnly && styles.readOnly, error && styles.inputError]}
              value={value || ''}
              onChangeText={(text) => onChange(field.id, formatEIN(text))}
              placeholder={placeholder || 'XX-XXXXXXX'}
              placeholderTextColor={colors.textGray}
              editable={!isReadOnly}
              keyboardType="number-pad"
              maxLength={10}
            />
          </FieldWrapper>
        );

      case 'routing_number':
        return (
          <FieldWrapper key={field.id}>
            <TextInput
              style={[styles.input, isReadOnly && styles.readOnly, error && styles.inputError]}
              value={value || ''}
              onChangeText={(text) => onChange(field.id, text.replace(/\D/g, '').slice(0, 9))}
              placeholder={placeholder || '123456789'}
              placeholderTextColor={colors.textGray}
              editable={!isReadOnly}
              keyboardType="number-pad"
              maxLength={9}
            />
          </FieldWrapper>
        );

      case 'account_number':
        return (
          <FieldWrapper key={field.id}>
            <TextInput
              style={[styles.input, isReadOnly && styles.readOnly, error && styles.inputError]}
              value={value || ''}
              onChangeText={(text) => onChange(field.id, text.replace(/\D/g, ''))}
              placeholder={placeholder || 'Account Number'}
              placeholderTextColor={colors.textGray}
              editable={!isReadOnly}
              keyboardType="number-pad"
              maxLength={17}
            />
          </FieldWrapper>
        );

      case 'select':
        return (
          <FieldWrapper key={field.id}>
            <View style={[styles.pickerContainer, error && styles.inputError]}>
              <Picker
                selectedValue={value}
                onValueChange={(itemValue) => onChange(field.id, itemValue)}
                enabled={!isReadOnly}
                style={styles.picker}
              >
                <Picker.Item label={currentLang === 'es' ? 'Seleccionar...' : 'Select...'} value="" />
                {field.options?.map((opt) => (
                  <Picker.Item
                    key={opt.value}
                    label={opt.translations?.[currentLang] || opt.label}
                    value={opt.value}
                  />
                ))}
              </Picker>
            </View>
          </FieldWrapper>
        );

      case 'multiselect':
      case 'checkbox_group':
        return (
          <FieldWrapper key={field.id}>
            <View style={styles.checkboxGroup}>
              {field.options?.map((opt) => {
                const isSelected = Array.isArray(value) && value.includes(opt.value);
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.checkboxOption,
                      isSelected && styles.checkboxOptionSelected,
                    ]}
                    onPress={() => {
                      if (isReadOnly) return;
                      const currentValue = Array.isArray(value) ? value : [];
                      if (isSelected) {
                        onChange(field.id, currentValue.filter((v: string) => v !== opt.value));
                      } else {
                        onChange(field.id, [...currentValue, opt.value]);
                      }
                    }}
                    disabled={isReadOnly}
                  >
                    <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                      {isSelected && <Ionicons name="checkmark" size={14} color="#FFF" />}
                    </View>
                    <Text style={styles.checkboxLabel}>
                      {opt.translations?.[currentLang] || opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </FieldWrapper>
        );

      case 'checkbox':
        return (
          <TouchableOpacity
            key={field.id}
            style={styles.checkboxRow}
            onPress={() => !isReadOnly && onChange(field.id, !value)}
            disabled={isReadOnly}
          >
            <View style={[styles.checkbox, value && styles.checkboxChecked]}>
              {value && <Ionicons name="checkmark" size={14} color="#FFF" />}
            </View>
            <Text style={styles.checkboxLabel}>
              {label}
              {isRequired && <Text style={styles.required}> *</Text>}
            </Text>
          </TouchableOpacity>
        );

      case 'date':
        return (
          <FieldWrapper key={field.id}>
            <TouchableOpacity
              style={[styles.dateInput, error && styles.inputError]}
              onPress={() => !isReadOnly && setShowDatePicker(field.id)}
              disabled={isReadOnly}
            >
              <Ionicons name="calendar-outline" size={20} color={colors.textGray} />
              <Text style={value ? styles.dateText : styles.datePlaceholder}>
                {value ? new Date(value).toLocaleDateString(currentLang === 'es' ? 'es-MX' : 'en-US') : (placeholder || (currentLang === 'es' ? 'Seleccionar fecha' : 'Select date'))}
              </Text>
            </TouchableOpacity>
            {showDatePicker === field.id && (
              <DateTimePicker
                value={value ? new Date(value) : new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  setShowDatePicker(null);
                  if (selectedDate) {
                    onChange(field.id, selectedDate.toISOString());
                  }
                }}
              />
            )}
          </FieldWrapper>
        );

      case 'time':
        return (
          <FieldWrapper key={field.id}>
            <TouchableOpacity
              style={[styles.dateInput, error && styles.inputError]}
              onPress={() => !isReadOnly && setShowTimePicker(field.id)}
              disabled={isReadOnly}
            >
              <Ionicons name="time-outline" size={20} color={colors.textGray} />
              <Text style={value ? styles.dateText : styles.datePlaceholder}>
                {value || (placeholder || (currentLang === 'es' ? 'Seleccionar hora' : 'Select time'))}
              </Text>
            </TouchableOpacity>
            {showTimePicker === field.id && (
              <DateTimePicker
                value={new Date()}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  setShowTimePicker(null);
                  if (selectedDate) {
                    onChange(field.id, selectedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
                  }
                }}
              />
            )}
          </FieldWrapper>
        );

      case 'items':
        // Repeatable items (like dependents, deductions)
        const items = Array.isArray(value) ? value : [];
        return (
          <View key={field.id} style={styles.itemsContainer}>
            <View style={styles.labelRow}>
              {icon && (
                <Ionicons name={icon as any} size={18} color={colors.textGray} style={styles.labelIcon} />
              )}
              <Text style={styles.label}>
                {label}
                {isRequired && <Text style={styles.required}> *</Text>}
              </Text>
            </View>
            {helpText && <Text style={styles.helpText}>{helpText}</Text>}
            
            {items.map((item, index) => (
              <View key={index} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>#{index + 1}</Text>
                  {!isReadOnly && (
                    <TouchableOpacity
                      onPress={() => {
                        const newItems = items.filter((_, i) => i !== index);
                        onChange(field.id, newItems);
                      }}
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.error} />
                    </TouchableOpacity>
                  )}
                </View>
                {field.fields?.map((subField) => (
                  <DynamicFieldRenderer
                    key={`${field.id}-${index}-${subField.id}`}
                    fields={[{ ...subField, id: `${field.id}[${index}].${subField.id}` }]}
                    values={{ [`${field.id}[${index}].${subField.id}`]: item[subField.id] }}
                    onChange={(_, val) => {
                      const newItems = [...items];
                      newItems[index] = { ...newItems[index], [subField.id]: val };
                      onChange(field.id, newItems);
                    }}
                    errors={errors}
                    disabled={disabled}
                    language={currentLang as 'es' | 'en'}
                  />
                ))}
              </View>
            ))}
            
            {!isReadOnly && (!field.validation?.max_items || items.length < field.validation.max_items) && (
              <TouchableOpacity
                style={styles.addItemButton}
                onPress={() => {
                  const newItem: Record<string, any> = {};
                  field.fields?.forEach((f) => {
                    newItem[f.id] = f.meta?.default_value || '';
                  });
                  onChange(field.id, [...items, newItem]);
                }}
              >
                <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                <Text style={styles.addItemText}>
                  {currentLang === 'es' ? 'Agregar' : 'Add'} {label}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        );

      case 'signature':
        return (
          <FieldWrapper key={field.id}>
            <TouchableOpacity
              style={[styles.signatureBox, error && styles.inputError]}
              onPress={() => {
                // TODO: Open signature modal
                console.log('Open signature for', field.id);
              }}
              disabled={isReadOnly}
            >
              {value ? (
                <Text style={styles.signatureText}>{currentLang === 'es' ? 'Firmado ✓' : 'Signed ✓'}</Text>
              ) : (
                <>
                  <Ionicons name="pencil" size={32} color={colors.textGray} />
                  <Text style={styles.signaturePlaceholder}>
                    {currentLang === 'es' ? 'Toca para firmar' : 'Tap to sign'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </FieldWrapper>
        );

      case 'file':
      case 'image':
        return (
          <FieldWrapper key={field.id}>
            <TouchableOpacity
              style={[styles.fileUpload, error && styles.inputError]}
              onPress={() => {
                // TODO: Open file picker
                console.log('Open file picker for', field.id);
              }}
              disabled={isReadOnly}
            >
              <Ionicons
                name={field.type === 'image' ? 'image-outline' : 'document-attach-outline'}
                size={32}
                color={colors.textGray}
              />
              <Text style={styles.fileUploadText}>
                {value
                  ? (typeof value === 'string' ? value : (currentLang === 'es' ? 'Archivo seleccionado' : 'File selected'))
                  : (currentLang === 'es' ? 'Toca para subir' : 'Tap to upload')}
              </Text>
              {field.meta?.allowed_formats && (
                <Text style={styles.fileFormats}>
                  {field.meta.allowed_formats.join(', ').toUpperCase()}
                </Text>
              )}
            </TouchableOpacity>
          </FieldWrapper>
        );

      case 'computed':
        return (
          <FieldWrapper key={field.id}>
            <View style={styles.computedField}>
              <Text style={styles.computedValue}>
                {field.meta?.currency_code === 'USD' ? `$${(value || 0).toFixed(2)}` : (value || '-')}
              </Text>
            </View>
          </FieldWrapper>
        );

      default:
        // Fallback to text input
        return (
          <FieldWrapper key={field.id}>
            <TextInput
              style={[styles.input, isReadOnly && styles.readOnly, error && styles.inputError]}
              value={value?.toString() || ''}
              onChangeText={(text) => onChange(field.id, text)}
              placeholder={placeholder}
              placeholderTextColor={colors.textGray}
              editable={!isReadOnly}
            />
          </FieldWrapper>
        );
    }
  }, [values, errors, disabled, currentLang, colors, showDatePicker, showTimePicker]);

  // Group fields
  const groupedFields = useMemo(() => {
    if (groups.length === 0) {
      return [{ id: 'default', label: '', fields: fields }];
    }

    const grouped: Record<string, DynamicField[]> = {};
    const ungrouped: DynamicField[] = [];

    fields.forEach((field) => {
      if (field.group && groups.some((g) => g.id === field.group)) {
        if (!grouped[field.group]) grouped[field.group] = [];
        grouped[field.group].push(field);
      } else {
        ungrouped.push(field);
      }
    });

    const result = groups
      .sort((a, b) => a.order - b.order)
      .map((group) => ({
        ...group,
        fields: (grouped[group.id] || []).sort((a, b) => (a.order || 0) - (b.order || 0)),
      }))
      .filter((g) => g.fields.length > 0);

    if (ungrouped.length > 0) {
      result.push({
        id: 'other',
        label: currentLang === 'es' ? 'Otros' : 'Other',
        icon: 'ellipsis-horizontal',
        order: 999,
        collapsible: true,
        fields: ungrouped.sort((a, b) => (a.order || 0) - (b.order || 0)),
      });
    }

    return result;
  }, [fields, groups, currentLang]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {groupedFields.map((group) => {
          const isCollapsed = collapsedGroups.has(group.id);
          const groupLabel = group.translations?.[currentLang] || group.label;

          return (
            <View key={group.id} style={styles.groupContainer}>
              {groupLabel && (
                <TouchableOpacity
                  style={styles.groupHeader}
                  onPress={() => group.collapsible && toggleGroup(group.id)}
                  disabled={!group.collapsible}
                >
                  <View style={styles.groupHeaderLeft}>
                    {group.icon && (
                      <Ionicons name={group.icon as any} size={20} color={colors.primary} />
                    )}
                    <Text style={styles.groupTitle}>{groupLabel}</Text>
                  </View>
                  {group.collapsible && (
                    <Ionicons
                      name={isCollapsed ? 'chevron-down' : 'chevron-up'}
                      size={20}
                      color={colors.textGray}
                    />
                  )}
                </TouchableOpacity>
              )}

              {!isCollapsed && (
                <View style={styles.fieldsWrapper}>
                  {group.fields.map((field) => renderField(field))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 100,
    },
    groupContainer: {
      marginBottom: 16,
      backgroundColor: '#FFF',
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    groupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    groupHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    groupTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    fieldsWrapper: {
      padding: 16,
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    fieldContainer: {
      width: '100%',
      marginBottom: 16,
    },
    halfWidth: {
      width: '48%',
      marginRight: '4%',
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    labelIcon: {
      marginRight: 6,
    },
    label: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
    },
    required: {
      color: colors.error,
    },
    helpText: {
      fontSize: 12,
      color: colors.textGray,
      marginTop: 4,
    },
    errorText: {
      fontSize: 12,
      color: colors.error,
      marginTop: 4,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: colors.text,
      backgroundColor: '#FFF',
    },
    textArea: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    readOnly: {
      backgroundColor: colors.background,
      color: colors.textGray,
    },
    inputError: {
      borderColor: colors.error,
    },
    currencyContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: '#FFF',
    },
    currencySymbol: {
      paddingLeft: 12,
      fontSize: 16,
      color: colors.textGray,
    },
    currencyInput: {
      flex: 1,
      padding: 12,
      fontSize: 16,
      color: colors.text,
    },
    pickerContainer: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: '#FFF',
      overflow: 'hidden',
    },
    picker: {
      height: 50,
    },
    checkboxGroup: {
      gap: 8,
    },
    checkboxOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: '#FFF',
    },
    checkboxOptionSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      padding: 12,
      backgroundColor: '#FFF',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: colors.border,
      marginRight: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkboxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    checkboxLabel: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
    },
    dateInput: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      backgroundColor: '#FFF',
      gap: 10,
    },
    dateText: {
      fontSize: 16,
      color: colors.text,
    },
    datePlaceholder: {
      fontSize: 16,
      color: colors.textGray,
    },
    itemsContainer: {
      marginBottom: 16,
    },
    itemCard: {
      backgroundColor: '#FFF',
      borderRadius: 8,
      padding: 16,
      marginTop: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    itemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    itemTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textGray,
    },
    addItemButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: colors.primary,
      borderRadius: 8,
      marginTop: 12,
      gap: 8,
    },
    addItemText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    signatureBox: {
      height: 120,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: '#FFF',
      justifyContent: 'center',
      alignItems: 'center',
    },
    signatureText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.success,
    },
    signaturePlaceholder: {
      fontSize: 14,
      color: colors.textGray,
      marginTop: 8,
    },
    fileUpload: {
      padding: 24,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: '#FFF',
      alignItems: 'center',
    },
    fileUploadText: {
      fontSize: 14,
      color: colors.textGray,
      marginTop: 8,
    },
    fileFormats: {
      fontSize: 11,
      color: colors.textGray,
      marginTop: 4,
    },
    computedField: {
      padding: 16,
      backgroundColor: colors.primary + '10',
      borderRadius: 8,
      alignItems: 'center',
    },
    computedValue: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.primary,
    },
    headerField: {
      paddingVertical: 8,
      width: '100%',
    },
    headerText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 12,
      width: '100%',
    },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      backgroundColor: colors.primary + '10',
      borderRadius: 8,
      marginBottom: 16,
      gap: 10,
      width: '100%',
    },
    infoText: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
    },
  });

export default DynamicFieldRenderer;
