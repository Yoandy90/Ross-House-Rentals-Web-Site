import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../constants/colors';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TimelineItem {
  id: string;
  type: 'document' | 'appointment' | 'note' | 'kyc' | 'tax_return' | 'whatsapp';
  title: string;
  description?: string;
  timestamp: string;
  metadata?: any;
}

interface ClientTimelineProps {
  items: TimelineItem[];
}

export default function ClientTimeline({ items }: ClientTimelineProps) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const getIconAndColor = (type: string) => {
    switch (type) {
      case 'document':
        return { icon: 'document-text', color: colors.accent };
      case 'appointment':
        return { icon: 'calendar', color: colors.warning };
      case 'note':
        return { icon: 'clipboard', color: colors.primary };
      case 'kyc':
        return { icon: 'shield-checkmark', color: colors.success };
      case 'tax_return':
        return { icon: 'receipt', color: colors.secondary };
      case 'whatsapp':
        return { icon: 'logo-whatsapp', color: '#25D366' };
      default:
        return { icon: 'information-circle', color: colors.textGray };
    }
  };

  if (!items || items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="time-outline" size={48} color={colors.textGray} />
        <Text style={styles.emptyText}>No hay actividad reciente</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {items.map((item, index) => {
        const { icon, color } = getIconAndColor(item.type);
        const isLast = index === items.length - 1;

        return (
          <View key={item.id} style={styles.timelineItem}>
            {/* Timeline Line */}
            {!isLast && <View style={styles.timelineLine} />}
            
            {/* Icon Container */}
            <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
              <Ionicons name={icon as any} size={20} color={color} />
            </View>

            {/* Content */}
            <View style={styles.contentContainer}>
              <View style={styles.contentHeader}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemTime}>
                  {format(new Date(item.timestamp), 'dd MMM, HH:mm', { locale: es })}
                </Text>
              </View>
              
              {item.description && (
                <Text style={styles.itemDescription}>{item.description}</Text>
              )}

              {/* Metadata Display */}
              {item.metadata && (
                <View style={styles.metadataContainer}>
                  {item.type === 'document' && item.metadata.category && (
                    <View style={styles.metadataBadge}>
                      <Text style={styles.metadataText}>
                        {item.metadata.category}
                      </Text>
                    </View>
                  )}
                  {item.type === 'appointment' && item.metadata.status && (
                    <View style={[styles.metadataBadge, { backgroundColor: colors.warning + '20' }]}>
                      <Text style={[styles.metadataText, { color: colors.warning }]}>
                        {item.metadata.status}
                      </Text>
                    </View>
                  )}
                  {item.type === 'tax_return' && item.metadata.tax_year && (
                    <View style={styles.metadataBadge}>
                      <Text style={styles.metadataText}>
                        Año {item.metadata.tax_year}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textGray,
    marginTop: 12,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 24,
    position: 'relative',
  },
  timelineLine: {
    position: 'absolute',
    left: 19,
    top: 40,
    bottom: -24,
    width: 2,
    backgroundColor: colors.border,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    zIndex: 1,
  },
  contentContainer: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
  },
  contentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  itemTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginRight: 8,
  },
  itemTime: {
    fontSize: 12,
    color: colors.textGray,
  },
  itemDescription: {
    fontSize: 13,
    color: colors.textGray,
    lineHeight: 18,
    marginBottom: 8,
  },
  metadataContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metadataBadge: {
    backgroundColor: colors.accent + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  metadataText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.accent,
  },
});