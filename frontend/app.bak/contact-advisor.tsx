import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Linking, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors } from '../src/constants/theme';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface ContactOption {
  icon: IoniconsName;
  title: string;
  subtitle: string;
  color: string;
  bgColor: string;
  gradientColors: [string, string];
  onPress: () => void;
}

export default function ContactAdvisorScreen() {
  const { t } = useTranslation();

  const options: ContactOption[] = [
    {
      icon: 'call-outline',
      title: 'Llamar',
      subtitle: `(806) 934-2018\n${t('contactAdvisor.schedule')}`,
      color: '#34D399',
      bgColor: 'rgba(52,211,153,0.15)',
      gradientColors: ['rgba(52,211,153,0.12)', 'rgba(52,211,153,0.03)'],
      onPress: () => Linking.openURL('tel:+18069342018'),
    },
    {
      icon: 'chatbubbles-outline',
      title: 'Chat en Vivo',
      subtitle: t('contactAdvisor.chatSub', 'Chat with an advisor\nin real time'),
      color: '#60A5FA',
      bgColor: 'rgba(96,165,250,0.15)',
      gradientColors: ['rgba(96,165,250,0.12)', 'rgba(96,165,250,0.03)'],
      onPress: () => router.push('/chat'),
    },
    {
      icon: 'mail-outline',
      title: 'Email',
      subtitle: 'info@rosslending.com\nRespuesta en 24h',
      color: '#A78BFA',
      bgColor: 'rgba(167,139,250,0.15)',
      gradientColors: ['rgba(167,139,250,0.12)', 'rgba(167,139,250,0.03)'],
      onPress: () => Linking.openURL('mailto:info@rosslending.com?subject=Consulta%20de%20Préstamo'),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contactar Asesor</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Hero Section */}
      <View style={styles.heroSection}>
        <LinearGradient
          colors={['rgba(5,150,105,0.15)', 'rgba(5,150,105,0.03)']}
          style={styles.heroGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.heroIconCircle}>
            <Ionicons name="headset-outline" size={32} color="#34D399" />
          </View>
          <Text style={styles.heroTitle}>¿Cómo podemos ayudarte?</Text>
          <Text style={styles.heroSubtitle}>
            Nuestro equipo está listo para asistirte con tu préstamo
          </Text>
        </LinearGradient>
      </View>

      {/* Contact Options */}
      <View style={styles.optionsContainer}>
        {options.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={styles.optionCard}
            onPress={option.onPress}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={option.gradientColors}
              style={styles.optionGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={[styles.optionIconCircle, { backgroundColor: option.bgColor }]}>
                <Ionicons name={option.icon} size={26} color={option.color} />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>{option.title}</Text>
                <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
              </View>
              <View style={[styles.optionArrow, { backgroundColor: option.bgColor }]}>
                <Ionicons name="chevron-forward" size={18} color={option.color} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </View>

      {/* Office Info */}
      <View style={styles.officeInfo}>
        <Ionicons name="location-outline" size={14} color={Colors.textMuted} />
        <Text style={styles.officeText}>305 Bruce Ave, Dumas, TX 79029</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.card,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  heroSection: { paddingHorizontal: 20, marginBottom: 8 },
  heroGradient: {
    borderRadius: 20, padding: 28, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(52,211,153,0.15)',
  },
  heroIconCircle: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: 'rgba(52,211,153,0.12)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  heroTitle: {
    fontSize: 20, fontWeight: '800', color: Colors.text,
    textAlign: 'center', marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 13, color: Colors.textSecondary, textAlign: 'center',
    lineHeight: 19,
  },
  optionsContainer: { paddingHorizontal: 20, marginTop: 12, gap: 12 },
  optionCard: { borderRadius: 16, overflow: 'hidden' },
  optionGradient: {
    flexDirection: 'row', alignItems: 'center', padding: 18,
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  optionIconCircle: {
    width: 52, height: 52, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  optionTextContainer: { flex: 1, marginLeft: 16 },
  optionTitle: {
    fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 3,
  },
  optionSubtitle: {
    fontSize: 12, color: Colors.textMuted, lineHeight: 17,
  },
  optionArrow: {
    width: 32, height: 32, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  officeInfo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 32,
  },
  officeText: { fontSize: 12, color: Colors.textMuted },
});
