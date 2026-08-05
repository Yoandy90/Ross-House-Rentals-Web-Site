import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import CustomHeader from '../../components/CustomHeader';

export default function RefundPolicyScreen() {
  const colors = useThemeColors();
  const { t, i18n } = useTranslation();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [version, setVersion] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [title, setTitle] = useState('');

  useEffect(() => {
    loadRefundPolicy();
  }, [i18n.language]);

  const loadRefundPolicy = async () => {
    try {
      setLoading(true);
      const currentLang = i18n.language || 'es';
      const response = await api.get(`/legal/refund?lang=${currentLang}`);
      setContent(response.data.content);
      setVersion(response.data.version);
      setEffectiveDate(response.data.effective_date);
      setTitle(response.data.title || t('legal.refundPolicy'));
    } catch (error) {
      console.error('Error loading refund policy:', error);
      Alert.alert(t('common.error'), t('legal.error'));
      setContent(`# ${t('legal.refundPolicy')}\n\n${t('legal.notPublished')}`);
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
            <Text style={styles.listText}>{line.substring(2)}</Text>
          </View>
        );
      }
      // Empty lines
      if (line.trim() === '') {
        return <View key={index} style={styles.spacing} />;
      }
      // Regular paragraph
      return (
        <Text key={index} style={styles.p}>
          {line}
        </Text>
      );
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <CustomHeader 
          title={t('legal.refundPolicy')}
          showBack={true}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{t('legal.loading')}</Text>
        </View>
      </View>
    );
  }

  const currentLang = i18n.language || 'es';
  const dateLocale = currentLang === 'es' ? es : enUS;

  return (
    <View style={styles.container}>
      <CustomHeader 
        title={title || t('legal.refundPolicy')}
        showBack={true}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {/* Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.iconContainer}>
            <Ionicons name="cash-outline" size={32} color={colors.primary} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.metaInfo}>
            <View style={styles.metaItem}>
              <Ionicons name="shield-checkmark" size={16} color={colors.textSecondary} />
              <Text style={styles.metaText}>{t('legal.version')} {version}</Text>
            </View>
            {effectiveDate && (
              <View style={styles.metaItem}>
                <Ionicons name="calendar" size={16} color={colors.textSecondary} />
                <Text style={styles.metaText}>
                  {t('legal.effectiveDate')} {format(new Date(effectiveDate), 'PP', { locale: dateLocale })}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Content */}
        <View style={styles.contentCard}>
          {renderMarkdown(content)}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Ionicons name="information-circle" size={20} color={colors.textSecondary} />
          <Text style={styles.footerText}>
            {t('legal.footerNote')}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  headerCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  metaInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  contentCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  h1: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 20,
    marginBottom: 12,
  },
  h2: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: 20,
    marginBottom: 8,
  },
  p: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.text,
    marginBottom: 12,
  },
  bold: {
    fontWeight: '600',
    color: colors.text,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingLeft: 12,
  },
  bullet: {
    fontSize: 15,
    color: colors.primary,
    marginRight: 8,
    marginTop: 2,
  },
  listText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 24,
    color: colors.text,
  },
  spacing: {
    height: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.primaryLight || colors.backgroundGray,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  footerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },
});
