import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, ThemeMode } from '../../contexts/ThemeContext';
import { useThemeColors } from '../../constants/colors';
import CustomHeader from '../../components/CustomHeader';
import { useTranslation } from 'react-i18next';

export default function ThemeSettings() {
  const router = useRouter();
  const { themeMode, setThemeMode } = useTheme();
  const colors = useThemeColors();
  const { t } = useTranslation();
  const [selectedScale] = useState(new Animated.Value(1));

  const themeOptions: { mode: ThemeMode; label: string; icon: string; description: string }[] = [
    {
      mode: 'light',
      label: t('theme.light'),
      icon: 'sunny',
      description: t('theme.lightDesc')
    },
    {
      mode: 'dark',
      label: t('theme.dark'),
      icon: 'moon',
      description: t('theme.darkDesc')
    },
    {
      mode: 'system',
      label: t('theme.system'),
      icon: 'phone-portrait',
      description: t('theme.systemDesc')
    }
  ];

  const handleSelectTheme = (mode: ThemeMode) => {
    // Animate selection
    Animated.sequence([
      Animated.timing(selectedScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(selectedScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    setThemeMode(mode);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <CustomHeader 
        title={t('theme.title')}
        showBackButton={true}
        backRoute="/(tabs)/profile"
      />

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Description */}
        <View style={styles.descriptionContainer}>
          <Text style={[styles.descriptionTitle, { color: colors.text }]}>
            {t('theme.customizeAppearance')}
          </Text>
          <Text style={[styles.descriptionText, { color: colors.textGray }]}>
            {t('theme.chooseTheme')}
          </Text>
        </View>

        {/* Theme Options */}
        {themeOptions.map((option) => (
          <TouchableOpacity
            key={option.mode}
            activeOpacity={0.7}
            onPress={() => handleSelectTheme(option.mode)}
            style={[
              styles.optionCard,
              {
                backgroundColor: colors.backgroundCard,
                borderColor: themeMode === option.mode ? colors.primary : colors.border,
                borderWidth: themeMode === option.mode ? 3 : 1,
              }
            ]}
          >
            <View style={styles.optionContent}>
              <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name={option.icon as any} size={28} color={colors.primary} />
              </View>
              <View style={styles.optionText}>
                <Text style={[styles.optionLabel, { color: colors.text }]}>{option.label}</Text>
                <Text style={[styles.optionDescription, { color: colors.textGray }]}>
                  {option.description}
                </Text>
              </View>
            </View>
            {themeMode === option.mode && (
              <View style={[styles.checkmarkContainer, { backgroundColor: colors.primary }]}>
                <Ionicons name="checkmark" size={20} color="#FFF" />
              </View>
            )}
          </TouchableOpacity>
        ))}

        {/* Preview Section */}
        <View style={styles.previewContainer}>
          <Text style={[styles.previewTitle, { color: colors.text }]}>{t('theme.preview')}</Text>
          
          {/* Preview Card with Theme-specific styling */}
          <View style={[
            styles.previewCard, 
            { 
              backgroundColor: colors.backgroundCard, 
              borderColor: colors.border,
              shadowColor: colors.text,
            }
          ]}>
            {/* Header Section */}
            <View style={[styles.previewTopBar, { backgroundColor: colors.primary + '10' }]}>
              <Ionicons name="menu" size={20} color={colors.text} />
              <Text style={[styles.previewAppName, { color: colors.text }]}>Ross Tax</Text>
              <Ionicons name="notifications" size={20} color={colors.text} />
            </View>

            {/* User Info */}
            <View style={styles.previewHeader}>
              <View style={[styles.previewAvatar, { backgroundColor: colors.primary }]}>
                <Ionicons name="person" size={24} color="#FFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.previewName, { color: colors.text }]}>{t('theme.sampleClient')}</Text>
                <Text style={[styles.previewEmail, { color: colors.textGray }]}>cliente@ross.com</Text>
              </View>
              <View style={[styles.previewBadge, { backgroundColor: colors.success + '20' }]}>
                <Text style={[styles.previewBadgeText, { color: colors.success }]}>{t('theme.active')}</Text>
              </View>
            </View>
            
            <View style={[styles.previewDivider, { backgroundColor: colors.border }]} />
            
            {/* Stats */}
            <View style={styles.previewStats}>
              <View style={styles.previewStat}>
                <View style={[styles.previewStatIcon, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="document-text" size={20} color={colors.primary} />
                </View>
                <Text style={[styles.previewStatValue, { color: colors.text }]}>3</Text>
                <Text style={[styles.previewStatLabel, { color: colors.textGray }]}>{t('theme.documents')}</Text>
              </View>
              <View style={styles.previewStat}>
                <View style={[styles.previewStatIcon, { backgroundColor: colors.accent + '15' }]}>
                  <Ionicons name="calendar" size={20} color={colors.accent} />
                </View>
                <Text style={[styles.previewStatValue, { color: colors.text }]}>2</Text>
                <Text style={[styles.previewStatLabel, { color: colors.textGray }]}>{t('theme.appointments')}</Text>
              </View>
              <View style={styles.previewStat}>
                <View style={[styles.previewStatIcon, { backgroundColor: colors.success + '15' }]}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                </View>
                <Text style={[styles.previewStatValue, { color: colors.text }]}>1</Text>
                <Text style={[styles.previewStatLabel, { color: colors.textGray }]}>{t('theme.completed')}</Text>
              </View>
            </View>

            {/* Action Button Preview */}
            <View style={styles.previewActions}>
              <View style={[styles.previewButton, { backgroundColor: colors.primary }]}>
                <Text style={styles.previewButtonText}>{t('theme.seeMore')}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Info Box */}
        <View style={[styles.infoBox, { backgroundColor: colors.info + '15', borderColor: colors.info + '30' }]}>
          <Ionicons name="information-circle" size={20} color={colors.info} />
          <Text style={[styles.infoText, { color: colors.text }]}>
            {t('theme.themeInfo')}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  descriptionContainer: {
    marginBottom: 24,
  },
  descriptionTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 15,
    lineHeight: 22,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  checkmarkContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  previewContainer: {
    marginTop: 32,
    marginBottom: 24,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  previewCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  previewTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: -20,
    marginTop: -20,
    marginBottom: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  previewAppName: {
    fontSize: 16,
    fontWeight: '700',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  previewAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  previewBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  previewName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  previewEmail: {
    fontSize: 14,
  },
  previewDivider: {
    height: 1,
    marginVertical: 16,
  },
  previewStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  previewStat: {
    alignItems: 'center',
  },
  previewStatIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  previewStatValue: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  previewStatLabel: {
    fontSize: 12,
  },
  previewActions: {
    marginTop: 8,
  },
  previewButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  previewButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    lineHeight: 20,
  },
});
