/**
 * AddressAutocomplete - Google Places autocomplete for Ross Lending
 * Dark theme optimized with auto-fill for city, state, zip
 */
import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, Keyboard, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors } from '../constants/theme';

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || '';

interface Prediction {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
}

interface AddressComponents {
  street: string;
  city: string;
  state: string;
  zip: string;
  full: string;
}

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onAddressSelected: (components: AddressComponents) => void;
  placeholder?: string;
  label?: string;
}

export default function AddressAutocomplete({
  value, onChangeText, onAddressSelected, placeholder, label,
}: Props) {
  const { t } = useTranslation();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPredictions = useCallback(async (input: string) => {
    if (input.length < 3 || !GOOGLE_API_KEY) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&types=address&components=country:us&key=${GOOGLE_API_KEY}`
      );
      const data = await res.json();
      if (data.predictions) {
        setPredictions(data.predictions.slice(0, 5));
        setShowDropdown(true);
      }
    } catch (e) {
      console.error('Places API error:', e);
    }
    setLoading(false);
  }, []);

  const handleTextChange = (text: string) => {
    onChangeText(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(text), 400);
  };

  const parseAddressComponents = (description: string): AddressComponents => {
    // Parse Google Places formatted address:
    // "1234 Main St, Houston, TX 77001, USA"
    const parts = description.split(',').map(p => p.trim());
    const street = parts[0] || '';
    const city = parts[1] || '';

    let state = '';
    let zip = '';
    if (parts[2]) {
      const stateZip = parts[2].trim();
      const match = stateZip.match(/^([A-Z]{2})\s+(\d{5})/);
      if (match) {
        state = match[1];
        zip = match[2];
      } else {
        state = stateZip;
      }
    }

    return { street, city, state, zip, full: description };
  };

  const getPlaceDetails = async (placeId: string): Promise<AddressComponents | null> => {
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=address_components,formatted_address&key=${GOOGLE_API_KEY}`
      );
      const data = await res.json();
      if (data.result) {
        const comps = data.result.address_components || [];
        let street_number = '';
        let route = '';
        let city = '';
        let state = '';
        let zip = '';

        for (const c of comps) {
          if (c.types.includes('street_number')) street_number = c.long_name;
          if (c.types.includes('route')) route = c.long_name;
          if (c.types.includes('locality')) city = c.long_name;
          if (c.types.includes('administrative_area_level_1')) state = c.short_name;
          if (c.types.includes('postal_code')) zip = c.long_name;
        }

        return {
          street: `${street_number} ${route}`.trim(),
          city,
          state,
          zip,
          full: data.result.formatted_address || '',
        };
      }
    } catch (e) {
      console.error('Place Details error:', e);
    }
    return null;
  };

  const selectPrediction = async (prediction: Prediction) => {
    Keyboard.dismiss();
    setShowDropdown(false);
    setPredictions([]);
    setLoading(true);

    // Try to get detailed address components
    const detailed = await getPlaceDetails(prediction.place_id);
    if (detailed) {
      onChangeText(detailed.street);
      onAddressSelected(detailed);
    } else {
      // Fallback: parse from description
      const parsed = parseAddressComponents(prediction.description);
      onChangeText(parsed.street);
      onAddressSelected(parsed);
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.inputRow}>
        <Ionicons name="location" size={16} color={Colors.primaryLight} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={handleTextChange}
          placeholder={placeholder || t('address.searchPlaceholder', 'Start typing your address...')}
          placeholderTextColor={Colors.textDim}
          autoCapitalize="words"
          returnKeyType="done"
        />
        {loading && <ActivityIndicator size="small" color={Colors.primaryLight} />}
        {value ? (
          <TouchableOpacity onPress={() => { onChangeText(''); setPredictions([]); setShowDropdown(false); }}>
            <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Google predictions dropdown */}
      {showDropdown && predictions.length > 0 && (
        <View style={styles.dropdown}>
          <View style={styles.poweredBy}>
            <Ionicons name="logo-google" size={12} color={Colors.textMuted} />
            <Text style={styles.poweredByText}>Google Places</Text>
          </View>
          {predictions.map((p) => (
            <TouchableOpacity key={p.place_id} onPress={() => selectPrediction(p)} style={styles.predictionItem}>
              <View style={styles.predIcon}>
                <Ionicons name="navigate" size={14} color={Colors.primaryLight} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.predMain}>
                  {p.structured_formatting?.main_text || p.description.split(',')[0]}
                </Text>
                <Text style={styles.predSecondary} numberOfLines={1}>
                  {p.structured_formatting?.secondary_text || p.description}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 4, zIndex: 100 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 6,
    marginLeft: 2,
    letterSpacing: 0.3,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    height: 50,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  dropdown: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 6,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: { elevation: 5 },
    }),
  },
  poweredBy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
  },
  poweredByText: {
    fontSize: 10,
    color: Colors.textDim,
    fontWeight: '600',
  },
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  predIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(5,150,105,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  predMain: { fontSize: 14, fontWeight: '600', color: Colors.text },
  predSecondary: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
});
