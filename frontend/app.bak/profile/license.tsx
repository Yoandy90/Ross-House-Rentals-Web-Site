import React from 'react';
import { View, Text, StyleSheet, ScrollView, Linking, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../src/constants/theme';

export default function LicenseScreen() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('license.title') }} />
      <SafeAreaView style={S.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={S.scroll}>
          <View style={S.iconWrap}>
            <View style={S.iconCircle}>
              <Ionicons name="business" size={40} color={Colors.primaryLight} />
            </View>
          </View>

          <Text style={S.heading}>Licencia del Estado de Texas</Text>
          <Text style={S.subtext}>Office of Consumer Credit Commissioner (OCCC)</Text>

          <View style={S.card}>
            <View style={S.cardRow}>
              <Text style={S.cardLabel}>Empresa</Text>
              <Text style={S.cardValue}>Ross Lending Solutions LLC</Text>
            </View>
            <View style={S.cardRow}>
              <Text style={S.cardLabel}>Regulación</Text>
              <Text style={S.cardValue}>Capítulo 342, Código Financiero de Texas</Text>
            </View>
            <View style={S.cardRow}>
              <Text style={S.cardLabel}>Tipo</Text>
              <Text style={S.cardValue}>Préstamos Regulados al Consumidor</Text>
            </View>
            <View style={S.cardRow}>
              <Text style={S.cardLabel}>Ubicación</Text>
              <Text style={S.cardValue}>305 Bruce Ave, Dumas, TX 79029</Text>
            </View>
            <View style={S.cardRow}>
              <Text style={S.cardLabel}>Estado</Text>
              <View style={S.statusBadge}>
                <View style={S.statusDot} />
                <Text style={S.statusText}>En proceso de obtención</Text>
              </View>
            </View>
          </View>

          <View style={S.infoBox}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.primaryLight} />
            <Text style={S.infoText}>
              Ross Lending Solutions LLC opera bajo las regulaciones del Capítulo 342 del Código Financiero de Texas, supervisado por la OCCC. Esto garantiza tasas de interés justas y prácticas de préstamo transparentes para nuestros clientes.
            </Text>
          </View>

          <TouchableOpacity style={S.linkBtn} onPress={() => Linking.openURL('https://occc.texas.gov')}>
            <Ionicons name="open-outline" size={18} color={Colors.primaryLight} />
            <Text style={S.linkBtnText}>Visitar sitio web de la OCCC</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  iconWrap: { alignItems: 'center', marginBottom: 16 },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(5, 150, 105, 0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  heading: { fontSize: 20, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  subtext: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: 24 },
  card: {
    backgroundColor: Colors.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 20,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  cardLabel: { fontSize: 13, color: Colors.textMuted, fontWeight: '600', flex: 0.35 },
  cardValue: { fontSize: 14, color: Colors.text, fontWeight: '600', flex: 0.65, textAlign: 'right' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#f59e0b' },
  statusText: { fontSize: 13, color: '#f59e0b', fontWeight: '600' },
  infoBox: {
    flexDirection: 'row', gap: 10, backgroundColor: 'rgba(5, 150, 105, 0.06)',
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(5, 150, 105, 0.15)',
    marginBottom: 20,
  },
  infoText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  linkBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, height: 48, borderWidth: 1, borderColor: Colors.border,
  },
  linkBtnText: { fontSize: 15, color: Colors.primaryLight, fontWeight: '600' },
});
