import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useColors, FontSizes, BorderRadius } from '../../constants/theme';

interface GaugeChartProps {
  /** Current value (0-100 for percentage, or actual number) */
  value: number;
  /** Maximum/goal value */
  maxValue: number;
  /** Label text below the gauge */
  label: string;
  /** Icon name */
  icon: keyof typeof Ionicons.glyphMap;
  /** Icon color */
  iconColor?: string;
  /** Gradient start color for the progress arc */
  gradientStart?: string;
  /** Gradient end color for the progress arc */
  gradientEnd?: string;
  /** Format the value display (currency, number, etc.) */
  formatValue?: (val: number) => string;
  /** Format the max value display */
  formatMax?: (val: number) => string;
  /** Size of the gauge (width) */
  size?: number;
  /** Suffix for percentage (default: '%') */
  suffix?: string;
}

/**
 * Premium Semi-Circular Gauge Chart
 * Inspired by speedometer/progress gauges with glass styling
 */
export function GaugeChart({
  value,
  maxValue,
  label,
  icon,
  iconColor,
  gradientStart = '#C8102E',
  gradientEnd = '#E11D48',
  formatValue,
  formatMax,
  size = 200,
  suffix = '%',
}: GaugeChartProps) {
  const Colors = useColors();
  const styles = React.useMemo(() => create_styles(Colors), [Colors]);
  iconColor = iconColor || Colors.brandRed;
  const percentage = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
  const displayPercent = Math.round(percentage);

  // SVG Arc calculation
  const strokeWidth = 10;
  const radius = (size - strokeWidth * 2) / 2;
  const centerX = size / 2;
  const centerY = size / 2 + 10; // Slight offset down for semi-circle

  // Semi-circle arc (180 degrees, from left to right across the top)
  const startAngle = Math.PI; // 180° (left)
  const endAngle = 0; // 0° (right)
  const sweepAngle = Math.PI; // Total sweep is 180°

  // Background arc path (full semi-circle)
  const bgStartX = centerX + radius * Math.cos(startAngle);
  const bgStartY = centerY - radius * Math.sin(startAngle);
  const bgEndX = centerX + radius * Math.cos(endAngle);
  const bgEndY = centerY - radius * Math.sin(endAngle);

  const bgPath = `M ${bgStartX} ${bgStartY} A ${radius} ${radius} 0 0 1 ${bgEndX} ${bgEndY}`;

  // Progress arc path
  const progressAngle = startAngle - (sweepAngle * percentage) / 100;
  const progEndX = centerX + radius * Math.cos(progressAngle);
  const progEndY = centerY - radius * Math.sin(progressAngle);
  const largeArc = percentage > 50 ? 1 : 0;

  const progressPath =
    percentage > 0
      ? `M ${bgStartX} ${bgStartY} A ${radius} ${radius} 0 ${largeArc} 1 ${progEndX} ${progEndY}`
      : '';

  const formattedValue = formatValue ? formatValue(value) : `${value}`;
  const formattedMax = formatMax ? formatMax(maxValue) : `${maxValue}`;

  return (
    <View style={[styles.container, { borderColor: `${gradientStart}15` }]}>
      {/* Decorative corner orb */}
      <View style={[styles.cornerOrb, { backgroundColor: gradientStart }]} />

      <View style={styles.gaugeWrapper}>
        <Svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
          <Defs>
            <LinearGradient id={`gaugeGrad_${label.replace(/\s/g, '')}`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={gradientStart} stopOpacity="1" />
              <Stop offset="1" stopColor={gradientEnd} stopOpacity="1" />
            </LinearGradient>
          </Defs>

          {/* Background Track */}
          <Path
            d={bgPath}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
          />

          {/* Progress Arc */}
          {percentage > 0 && (
            <Path
              d={progressPath}
              stroke={`url(#gaugeGrad_${label.replace(/\s/g, '')})`}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
            />
          )}
        </Svg>

        {/* Center Content - positioned over the SVG */}
        <View style={[styles.centerContent, { top: size / 2 - 44 }]}>
          <Text style={[styles.percentText, { fontSize: size > 180 ? 36 : 28 }]}>
            {displayPercent}
            <Text style={styles.percentSuffix}>{suffix}</Text>
          </Text>
        </View>
      </View>

      {/* Label Row */}
      <View style={styles.labelRow}>
        <Ionicons name={icon} size={16} color={iconColor} />
        <Text style={styles.labelText}>{label}</Text>
      </View>

      {/* Value / Max Row */}
      <View style={styles.valueRow}>
        <Text style={[styles.valueText, { color: gradientStart }]}>{formattedValue}</Text>
        <Text style={styles.valueDivider}> / </Text>
        <Text style={styles.maxText}>{formattedMax}</Text>
      </View>
    </View>
  );
}

/**
 * Compact stat card (for secondary metrics below gauges)
 */
export function MiniStatCard({
  icon,
  iconColor,
  iconBg,
  value,
  label,
  orbColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBg?: string;
  value: string | number;
  label: string;
  orbColor?: string;
}) {
  const Colors = useColors();
  const styles = React.useMemo(() => create_styles(Colors), [Colors]);
  iconColor = iconColor || Colors.brandRed;
  return (
    <View style={[styles.miniCard, { borderColor: `${iconColor}15` }]}>
      {/* Corner decoration */}
      <View style={[styles.miniOrb, { backgroundColor: orbColor || iconColor }]} />

      <View style={[styles.miniIconWrap, { backgroundColor: iconBg || `${iconColor}12` }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={[styles.miniValue, { color: iconColor }]}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

const create_styles = (Colors: any) => StyleSheet.create({
  // Gauge Container
  container: {
    backgroundColor: Colors.glass,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  cornerOrb: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 80,
    height: 80,
    borderRadius: 40,
    opacity: 0.04,
  },
  gaugeWrapper: {
    alignItems: 'center',
    position: 'relative',
  },
  centerContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  percentText: {
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  percentSuffix: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textMuted,
  },

  // Label
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -4,
  },
  labelText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Value
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 6,
  },
  valueText: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  valueDivider: {
    fontSize: FontSizes.md,
    color: Colors.textDim,
    fontWeight: '500',
  },
  maxText: {
    fontSize: FontSizes.md,
    color: Colors.textMuted,
    fontWeight: '600',
  },

  // Mini Stat Card
  miniCard: {
    flex: 1,
    backgroundColor: Colors.glass,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    padding: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  miniOrb: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 60,
    height: 60,
    borderRadius: 30,
    opacity: 0.06,
  },
  miniIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  miniValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  miniLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 4,
    lineHeight: 14,
  },
});

export default GaugeChart;
