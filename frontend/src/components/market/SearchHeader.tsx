import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../constants/theme';

interface Props {
  city: string;
  state: string;
  onCityChange: (v: string) => void;
  onStateChange: (v: string) => void;
  onSearch: () => void;
  onFilterPress: () => void;
  onAddressSearch?: (address: string) => void;
  loading: boolean;
  resultCount?: number;
}

export default function SearchHeader({
  city, state, onCityChange, onStateChange, onSearch, onFilterPress, onAddressSearch, loading, resultCount,
}: Props) {
  const Colors = useColors();
  const styles = React.useMemo(() => create_styles(Colors), [Colors]);
  const [addressQuery, setAddressQuery] = useState('');

  const handleAddressSearch = () => {
    if (addressQuery.trim() && onAddressSearch) {
      onAddressSearch(addressQuery.trim());
    }
  };

  const clearAddressSearch = () => {
    setAddressQuery('');
    if (onAddressSearch) {
      onAddressSearch(''); // Clear address filter
    }
  };

  return (
    <View style={styles.container}>
      {/* Main search row: City + State */}
      <View style={styles.inputRow}>
        <View style={styles.inputWrap}>
          <Ionicons name="location-outline" size={16} color={Colors.brandRed} style={{ marginRight: 6 }} />
          <TextInput
            value={city}
            onChangeText={onCityChange}
            placeholder="Ciudad"
            placeholderTextColor={Colors.textDim}
            style={styles.input}
          />
        </View>
        <View style={[styles.inputWrap, { width: 56 }]}>
          <TextInput
            value={state}
            onChangeText={v => onStateChange(v.toUpperCase())}
            placeholder="TX"
            placeholderTextColor={Colors.textDim}
            style={[styles.input, { textAlign: 'center' }]}
            maxLength={2}
            autoCapitalize="characters"
          />
        </View>
        <TouchableOpacity style={styles.searchBtn} onPress={onSearch} disabled={loading}>
          <Ionicons name={loading ? 'hourglass-outline' : 'search'} size={18} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterBtn} onPress={onFilterPress}>
          <Ionicons name="options-outline" size={18} color={Colors.brandRed} />
        </TouchableOpacity>
      </View>

      {/* Address search row - Always visible */}
      <View style={styles.addressRow}>
        <View style={styles.addressInputRow}>
          <View style={styles.addressInputWrap}>
            <Ionicons name="home-outline" size={14} color={Colors.brandRed} style={{ marginRight: 6 }} />
            <TextInput
              value={addressQuery}
              onChangeText={setAddressQuery}
              placeholder="Ej: 913 E 8th, Fox Ave..."
              placeholderTextColor={Colors.textDim}
              style={styles.addressInput}
              onSubmitEditing={handleAddressSearch}
              returnKeyType="search"
              blurOnSubmit={false}
            />
            {addressQuery.length > 0 && (
              <TouchableOpacity onPress={clearAddressSearch} style={styles.clearBtn}>
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity 
            style={[styles.addressSearchBtn, !addressQuery.trim() && { opacity: 0.5 }]} 
            onPress={handleAddressSearch}
            disabled={!addressQuery.trim() || loading}
          >
            <Ionicons name={loading ? 'hourglass-outline' : 'search'} size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Results count */}
      {resultCount !== undefined && resultCount > 0 && (
        <Text style={styles.resultText}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>{resultCount.toLocaleString()}</Text>
          {' '}propiedades en {city}, {state}
          {addressQuery && (
            <Text style={{ color: Colors.brandRed }}> • &ldquo;{addressQuery}&rdquo;</Text>
          )}
        </Text>
      )}
    </View>
  );
}

const create_styles = (Colors: any) => StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.glassLight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.glassBorderLight,
    paddingHorizontal: 12,
    height: 46,
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  searchBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: Colors.brandRed,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: Colors.glassLight,
    borderWidth: 1,
    borderColor: Colors.glassBorderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Address search styles
  addressRow: { marginTop: 10 },
  addressInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(200, 16, 46, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(200, 16, 46, 0.2)',
    paddingHorizontal: 12,
    height: 40,
  },
  addressInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '500',
  },
  clearBtn: {
    padding: 4,
  },
  addressSearchBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.brandRed,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  resultText: {
    color: Colors.textDim,
    fontSize: 12,
    marginTop: 10,
    fontWeight: '500',
  },
});
