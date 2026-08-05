/**
 * Address Validation Input Component
 * Validates address using USPS as user types
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import uspsService, { Address, ValidatedAddress } from '../services/usps';
import { useTranslation } from 'react-i18next';

interface AddressValidationInputProps {
  onAddressValidated: (address: ValidatedAddress) => void;
  initialAddress?: Address;
  editable?: boolean;
}

const AddressValidationInput: React.FC<AddressValidationInputProps> = ({
  onAddressValidated,
  initialAddress,
  editable = true,
}) => {
  const { t } = useTranslation();
  const [address, setAddress] = useState<Address>({
    address2: initialAddress?.address2 || '',
    city: initialAddress?.city || '',
    state: initialAddress?.state || '',
    zip5: initialAddress?.zip5 || '',
  });
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Auto-fill city/state when ZIP code is entered
  useEffect(() => {
    if (address.zip5?.length === 5) {
      handleZipCodeChange(address.zip5);
    }
  }, []);

  const handleZipCodeChange = async (zip: string) => {
    if (zip.length === 5) {
      try {
        const result = await uspsService.lookupCityState(zip);
        setAddress((prev) => ({
          ...prev,
          city: result.city,
          state: result.state,
        }));
      } catch (error) {
        console.log('Could not auto-fill city/state');
      }
    }
  };

  const handleValidateAddress = async () => {
    if (!address.address2 || !address.city || !address.state) {
      Alert.alert(
        t('common.error'),
        'Please fill in street address, city, and state'
      );
      return;
    }

    setValidating(true);
    setValidationError(null);

    try {
      const validatedAddress = await uspsService.validateAddress(address);
      setValidated(true);
      onAddressValidated(validatedAddress);
      
      // Update form with standardized address
      setAddress({
        address2: validatedAddress.address2,
        city: validatedAddress.city,
        state: validatedAddress.state,
        zip5: validatedAddress.zip5,
        zip4: validatedAddress.zip4,
      });

      Alert.alert(
        '✅ ' + t('common.success'),
        'Address validated successfully!'
      );
    } catch (error: any) {
      setValidationError(
        error.response?.data?.detail || 'Address validation failed'
      );
      Alert.alert(
        t('common.error'),
        'Could not validate address. Please check and try again.'
      );
    } finally {
      setValidating(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Street Address *</Text>
      <TextInput
        style={[styles.input, !editable && styles.inputDisabled]}
        value={address.address2}
        onChangeText={(text) => {
          setAddress({ ...address, address2: text });
          setValidated(false);
        }}
        placeholder="123 Main Street"
        editable={editable}
      />

      <Text style={styles.label}>Apartment/Suite (Optional)</Text>
      <TextInput
        style={[styles.input, !editable && styles.inputDisabled]}
        value={address.address1 || ''}
        onChangeText={(text) => {
          setAddress({ ...address, address1: text });
          setValidated(false);
        }}
        placeholder="Apt 4B"
        editable={editable}
      />

      <View style={styles.row}>
        <View style={styles.flex1}>
          <Text style={styles.label}>ZIP Code *</Text>
          <TextInput
            style={[styles.input, !editable && styles.inputDisabled]}
            value={address.zip5 || ''}
            onChangeText={(text) => {
              const cleaned = text.replace(/[^0-9]/g, '');
              setAddress({ ...address, zip5: cleaned });
              setValidated(false);
              if (cleaned.length === 5) {
                handleZipCodeChange(cleaned);
              }
            }}
            placeholder="12345"
            keyboardType="numeric"
            maxLength={5}
            editable={editable}
          />
        </View>

        <View style={styles.flex2}>
          <Text style={styles.label}>City *</Text>
          <TextInput
            style={[styles.input, !editable && styles.inputDisabled]}
            value={address.city || ''}
            onChangeText={(text) => {
              setAddress({ ...address, city: text });
              setValidated(false);
            }}
            placeholder="New York"
            editable={editable}
          />
        </View>

        <View style={styles.flex1}>
          <Text style={styles.label}>State *</Text>
          <TextInput
            style={[styles.input, !editable && styles.inputDisabled]}
            value={address.state || ''}
            onChangeText={(text) => {
              const cleaned = text.toUpperCase().replace(/[^A-Z]/g, '');
              setAddress({ ...address, state: cleaned });
              setValidated(false);
            }}
            placeholder="NY"
            maxLength={2}
            autoCapitalize="characters"
            editable={editable}
          />
        </View>
      </View>

      {editable && (
        <TouchableOpacity
          style={[
            styles.validateButton,
            validated && styles.validateButtonSuccess,
          ]}
          onPress={handleValidateAddress}
          disabled={validating}
        >
          {validating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons
                name={validated ? 'checkmark-circle' : 'mail'}
                size={20}
                color="#fff"
                style={styles.buttonIcon}
              />
              <Text style={styles.validateButtonText}>
                {validated ? 'Address Verified ✓' : 'Validate with USPS'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {validationError && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={20} color="#dc3545" />
          <Text style={styles.errorText}>{validationError}</Text>
        </View>
      )}

      {validated && (
        <View style={styles.successContainer}>
          <Ionicons name="checkmark-circle" size={20} color="#28a745" />
          <Text style={styles.successText}>
            Address validated and standardized by USPS
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputDisabled: {
    backgroundColor: '#f5f5f5',
    color: '#666',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
  flex2: {
    flex: 2,
  },
  validateButton: {
    backgroundColor: '#4E79A7',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  validateButtonSuccess: {
    backgroundColor: '#28a745',
  },
  buttonIcon: {
    marginRight: 8,
  },
  validateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8d7da',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  errorText: {
    color: '#721c24',
    flex: 1,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d4edda',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  successText: {
    color: '#155724',
    flex: 1,
  },
});

export default AddressValidationInput;
