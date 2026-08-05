import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import { useTranslation } from 'react-i18next';
import { changeLanguage, getCurrentLanguage } from '../../i18n/config';
import { useRouter } from 'expo-router';
import CustomHeader from '../../components/CustomHeader';

export default function LanguageSettings() {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [selectedLang, setSelectedLang] = useState(getCurrentLanguage());

  const languages = [
    {
      code: 'es',
      name: 'Español',
      nativeName: 'Español',
      flag: '🇪🇸',
    },
    {
      code: 'en',
      name: 'English',
      nativeName: 'English',
      flag: '🇺🇸',
    },
  ];

  const handleLanguageSelect = async (languageCode: string) => {
    try {
      setSelectedLang(languageCode);
      await changeLanguage(languageCode);
      
      // Show success message
      setTimeout(() => {
        Alert.alert(
          languageCode === 'es' ? 'Éxito' : 'Success',
          languageCode === 'es' 
            ? 'Idioma cambiado correctamente a Español' 
            : 'Language changed successfully to English',
          [
            {
              text: 'OK',
              onPress: () => router.back(),
            },
          ]
        );
      }, 100);
    } catch (error) {
      console.error('Error changing language:', error);
      Alert.alert('Error', 'No se pudo cambiar el idioma');
    }
  };

  return (
    <View style={styles.container}>
      <CustomHeader 
        title="Idioma / Language"
        showBackButton={true}
        backRoute="/(tabs)/profile"
      />
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="language" size={48} color={colors.primary} />
          </View>
          <Text style={styles.title}>Selecciona tu Idioma</Text>
          <Text style={styles.subtitle}>Select your Language</Text>
        </View>

        {/* Language Options */}
        <View style={styles.languagesContainer}>
          {languages.map((language) => (
            <TouchableOpacity
              key={language.code}
              style={[
                styles.languageCard,
                selectedLang === language.code && styles.languageCardSelected,
              ]}
              onPress={() => handleLanguageSelect(language.code)}
              activeOpacity={0.7}
            >
              <View style={styles.languageContent}>
                <Text style={styles.flag}>{language.flag}</Text>
                <View style={styles.languageInfo}>
                  <Text style={styles.languageName}>{language.name}</Text>
                  <Text style={styles.languageNative}>{language.nativeName}</Text>
                </View>
              </View>
              
              {selectedLang === language.code && (
                <View style={styles.checkContainer}>
                  <Ionicons name="checkmark-circle" size={28} color={colors.primary} />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color={colors.info} />
          <Text style={styles.infoText}>
            El idioma se aplicará en toda la aplicación. Algunas pantallas están en proceso de traducción.
            {'\n\n'}
            The language will be applied throughout the app. Some screens are being translated.
          </Text>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    paddingTop: 20,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textGray,
  },
  languagesContainer: {
    gap: 12,
    marginBottom: 24,
  },
  languageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  languageCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  languageContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  flag: {
    fontSize: 40,
  },
  languageInfo: {
    gap: 4,
  },
  languageName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  languageNative: {
    fontSize: 14,
    color: colors.textGray,
  },
  checkContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: colors.info + '15',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.info,
    lineHeight: 20,
  },
});