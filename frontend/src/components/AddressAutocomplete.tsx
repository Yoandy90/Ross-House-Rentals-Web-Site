/**
 * AddressAutocomplete - Google Places autocomplete with saved addresses
 * For Trucker Tools trip origin/destination
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator,
  StyleSheet, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || '';

const C = {
  bg: '#F2F2F7', card: '#fff', text: '#1C1C1E', sub: '#636366', muted: '#AEAEB2',
  border: '#E5E5EA', brand: '#1E40AF', brandSoft: '#EFF6FF', success: '#059669',
  successSoft: '#ECFDF5',
};

interface Prediction {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
}

interface SavedAddress {
  _id?: string;
  label: string;
  address: string;
  state?: string;
  used_count: number;
}

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onAddressSelected: (address: string, state: string | null) => void;
  placeholder?: string;
  savedAddresses?: SavedAddress[];
  onRefreshSaved?: () => void;
}

export default function AddressAutocomplete({
  value, onChangeText, onAddressSelected, placeholder, savedAddresses = [], onRefreshSaved,
}: Props) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPredictions = useCallback(async (input: string) => {
    if (input.length < 3) {
      setPredictions([]);
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
    setShowSaved(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(text), 400);
  };

  const extractStateFromAddress = (address: string): string | null => {
    // Try to extract US state abbreviation from Google Places address
    // Format typically: "123 Main St, City, TX 79029, USA"
    const stateMatch = address.match(/,\s*([A-Z]{2})\s+\d{5}/);
    if (stateMatch) return stateMatch[1];
    // Fallback: look for 2-letter state code
    const parts = address.split(',').map(p => p.trim());
    for (const part of parts) {
      const match = part.match(/^([A-Z]{2})\s/);
      if (match) return match[1];
    }
    return null;
  };

  const selectPrediction = async (prediction: Prediction) => {
    const address = prediction.description;
    onChangeText(address);
    setPredictions([]);
    setShowDropdown(false);
    Keyboard.dismiss();

    // Extract state
    const state = extractStateFromAddress(address);
    onAddressSelected(address, state);
  };

  const selectSavedAddress = (saved: SavedAddress) => {
    onChangeText(saved.address);
    setShowSaved(false);
    setShowDropdown(false);
    Keyboard.dismiss();
    onAddressSelected(saved.address, saved.state || null);
  };

  const handleFocus = () => {
    if (savedAddresses.length > 0 && !value) {
      setShowSaved(true);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <Ionicons name="location" size={18} color={C.brand} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={handleTextChange}
          placeholder={placeholder || 'Escribe dirección...'}
          placeholderTextColor={C.muted}
          onFocus={handleFocus}
          returnKeyType="done"
        />
        {loading && <ActivityIndicator size="small" color={C.brand} />}
        {value ? (
          <TouchableOpacity onPress={() => { onChangeText(''); setPredictions([]); setShowDropdown(false); }}>
            <Ionicons name="close-circle" size={20} color={C.muted} />
          </TouchableOpacity>
        ) : savedAddresses.length > 0 ? (
          <TouchableOpacity onPress={() => setShowSaved(!showSaved)}>
            <Ionicons name="bookmark" size={20} color={C.brand} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Saved addresses dropdown */}
      {showSaved && savedAddresses.length > 0 && (
        <View style={styles.dropdown}>
          <View style={styles.savedHeader}>
            <Ionicons name="bookmark" size={14} color={C.brand} />
            <Text style={styles.savedTitle}>Direcciones Guardadas</Text>
          </View>
          {savedAddresses.slice(0, 6).map((sa, i) => (
            <TouchableOpacity key={sa._id || i} onPress={() => selectSavedAddress(sa)} style={styles.savedItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.savedLabel}>{sa.label}</Text>
                <Text style={styles.savedAddress} numberOfLines={1}>{sa.address}</Text>
              </View>
              <Text style={styles.usedBadge}>{sa.used_count}×</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Google predictions dropdown */}
      {showDropdown && predictions.length > 0 && (
        <View style={styles.dropdown}>
          {predictions.map((p) => (
            <TouchableOpacity key={p.place_id} onPress={() => selectPrediction(p)} style={styles.predictionItem}>
              <Ionicons name="navigate" size={16} color={C.sub} style={{ marginRight: 10 }} />
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
  container: { marginBottom: 12, zIndex: 100 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1,
    borderColor: '#E5E5EA', paddingHorizontal: 12, height: 48,
  },
  input: { flex: 1, fontSize: 15, color: '#1C1C1E' },
  dropdown: {
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1,
    borderColor: '#E5E5EA', marginTop: 4, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  predictionItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: '#F2F2F7',
  },
  predMain: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  predSecondary: { fontSize: 12, color: '#636366', marginTop: 2 },
  savedHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6,
  },
  savedTitle: { fontSize: 12, fontWeight: '700', color: C.brand },
  savedItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: '#F2F2F7',
  },
  savedLabel: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  savedAddress: { fontSize: 12, color: '#636366', marginTop: 1 },
  usedBadge: {
    fontSize: 11, color: C.brand, fontWeight: '700',
    backgroundColor: C.brandSoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
  },
});
