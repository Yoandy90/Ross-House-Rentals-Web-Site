import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import CustomHeader from '../../components/CustomHeader';
import { useTranslation } from 'react-i18next';

export default function PrivacyScreen() {
  const colors = useThemeColors();
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'es' ? es : enUS;
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [version, setVersion] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');

  useEffect(() => {
    loadPrivacy();
  }, []);

  const loadPrivacy = async () => {
    try {
      setLoading(true);
      const response = await api.get('/legal/privacy');
      setContent(response.data.content);
      setVersion(response.data.version);
      setEffectiveDate(response.data.effective_date);
    } catch (error) {
      console.error('Error loading privacy policy:', error);
      Alert.alert('Error', 'No se pudo cargar la política de privacidad');
      // Set default content
      setContent('# Política de Privacidad\n\nLa política de privacidad aún no ha sido publicada.');
      setVersion('1.0');
    } finally {
      setLoading(false);
    }
  };

  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, index) => {
      // Headers
      if (line.startsWith('# ')) {
        return (
          <Text key={index} style={styles.h1}>
            {line.replace('# ', '')}
          </Text>
        );
      }
      if (line.startsWith('## ')) {
        return (
          <Text key={index} style={styles.h2}>
            {line.replace('## ', '')}
          </Text>
        );
      }
      // Bold text
      if (line.includes('**')) {
        const parts = line.split('**');
        return (
          <Text key={index} style={styles.p}>
            {parts.map((part, i) => (
              i % 2 === 1 ? <Text key={i} style={styles.bold}>{part}</Text> : part
            ))}
          </Text>
        );
      }
      // List items
      if (line.startsWith('- ')) {
        return (
          <View key={index} style={styles.listItem}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.listText}>{line.replace('- ', '')}</Text>
          </View>
        );
      }
      // Empty line
      if (line.trim() === '') {
        return <View key={index} style={styles.spacer} />;
      }
      // Regular paragraph
      return (
        <Text key={index} style={styles.p}>
          {line}
        </Text>
      );
    });
  };

  return (
    <View style={styles.container}>
      <CustomHeader title={t('legal.privacyTitle')} showBack={true} />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#dc2626" />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {version && (
            <View style={styles.versionBadge}>
              <Text style={styles.versionText}>{t('legal.version', { version })}</Text>
              {effectiveDate && (
                <Text style={styles.dateText}>
                  Vigente desde: {format(new Date(effectiveDate), "d 'de' MMMM, yyyy", { locale: es })}
                </Text>
              )}
            </View>
          )}

          {renderMarkdown(content)}

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {t('legal.acceptPrivacy')}
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#6C1110',
    padding: 20,
    paddingTop: 60,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textGray,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  versionBadge: {
    backgroundColor: colors.info + '10',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  versionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.info,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 12,
    color: colors.textGray,
  },
  h1: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginTop: 20,
    marginBottom: 12,
  },
  h2: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  p: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
    marginBottom: 8,
  },
  bold: {
    fontWeight: '600',
    color: colors.text,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingLeft: 12,
  },
  bullet: {
    fontSize: 15,
    color: colors.primary,
    marginRight: 8,
  },
  listText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  spacer: {
    height: 12,
  },
  footer: {
    marginTop: 32,
    padding: 16,
    backgroundColor: colors.backgroundGray,
    borderRadius: 8,
  },
  footerText: {
    fontSize: 13,
    color: colors.textGray,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});