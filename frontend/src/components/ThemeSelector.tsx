import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ThemeMode } from '../theme/ThemeContext';

interface Props {
  variant?: 'segmented' | 'list';
}

const OPTIONS: { value: ThemeMode; label: string; sublabel: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'light', label: 'Claro', sublabel: 'Tema claro premium', icon: 'sunny-outline' },
  { value: 'dark', label: 'Oscuro', sublabel: 'Tema oscuro premium', icon: 'moon-outline' },
  { value: 'system', label: 'Automático', sublabel: 'Sigue al sistema', icon: 'phone-portrait-outline' },
];

export default function ThemeSelector({ variant = 'list' }: Props) {
  const { mode, setMode, colors, isDark } = useTheme();

  if (variant === 'list') {
    return (
      <View style={{ gap: 8 }}>
        {OPTIONS.map(opt => {
          const active = mode === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => setMode(opt.value)}
              style={({ pressed }) => [
                styles.listRow,
                {
                  backgroundColor: active ? colors.primary + '15' : colors.bgElevated,
                  borderColor: active ? colors.primary : colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <View style={[styles.iconWrap, { backgroundColor: active ? colors.primary + '20' : colors.bgMuted }]}>
                <Ionicons name={opt.icon} size={20} color={active ? colors.primary : colors.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.listLabel, { color: colors.text }]}>{opt.label}</Text>
                <Text style={[styles.listSublabel, { color: colors.textMuted }]}>{opt.sublabel}</Text>
              </View>
              {active ? (
                <View style={[styles.radioActive, { borderColor: colors.primary }]}>
                  <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />
                </View>
              ) : (
                <View style={[styles.radioInactive, { borderColor: colors.border }]} />
              )}
            </Pressable>
          );
        })}
      </View>
    );
  }

  // segmented
  return (
    <View style={[styles.segmented, { backgroundColor: colors.bgMuted, borderColor: colors.border }]}>
      {OPTIONS.map(opt => {
        const active = mode === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => setMode(opt.value)}
            style={({ pressed }) => [
              styles.segBtn,
              active && { backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : '#FFFFFF' },
              active && !isDark && {
                shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.06, shadowRadius: 2, elevation: 1,
              },
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Ionicons name={opt.icon} size={14} color={active ? colors.text : colors.textMuted} />
            <Text style={{ color: active ? colors.text : colors.textMuted, fontSize: 12, fontWeight: '600' }}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segmented: { flexDirection: 'row', padding: 4, borderRadius: 12, gap: 4, borderWidth: 1 },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  listLabel: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  listSublabel: { fontSize: 12 },
  radioActive: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInactive: { width: 22, height: 22, borderRadius: 11, borderWidth: 2 },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
});
