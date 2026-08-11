import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useColors } from '../constants/theme';
import Svg, {
  Defs, LinearGradient, Stop, RadialGradient, Path,
  Rect, Circle, G, Mask, Line, Text as SvgText,
} from 'react-native-svg';

/**
 * Premium chart components for the energy dashboard.
 * Uses react-native-svg (already a dependency) to render high-quality
 * visualizations with gradients, glow effects and rounded geometry.
 */

// ─────────────────────────────────────────────
// SHARED THEME — aligned with Ross House Rentals brand red
// ─────────────────────────────────────────────
export const ChartPalette = {
  // Primary gradient set — brand red (Colors.brandRed family)
  brandGradient: ['#FF4D6D', '#E11D48', '#9F1239'],   // bright → deep
  brandSoft:     ['rgba(225,29,72,0.45)', 'rgba(159,18,72,0.20)'],
  weekendBrand:  ['rgba(255,77,109,0.65)', 'rgba(225,29,72,0.32)'],
  weekdayBrand:  ['rgba(225,29,72,0.32)', 'rgba(159,18,72,0.10)'],

  // Backward-compat aliases (legacy code may still reference amber*)
  amberGradient: ['#FF4D6D', '#E11D48', '#9F1239'],
  amberSoft:     ['rgba(225,29,72,0.45)', 'rgba(159,18,72,0.20)'],
  weekendAmber:  ['rgba(255,77,109,0.65)', 'rgba(225,29,72,0.32)'],
  weekdayAmber:  ['rgba(225,29,72,0.32)', 'rgba(159,18,72,0.10)'],

  donutCurrent:  ['#FF4D6D', '#9F1239'],              // brand red gradient
  donutPrev:     ['#475569', '#1E293B'],              // slate dim
  donutSaved:    ['#34D399', '#059669'],              // emerald
  donutWasted:   ['#F87171', '#DC2626'],              // rose

  text:       '#F1F5F9',
  textMuted:  '#94A3B8',
  textDim:    '#64748B',
  glow:       '#FF4D6D',
};

// ─────────────────────────────────────────────
// MODERN BAR CHART
// ─────────────────────────────────────────────
interface BarPoint {
  key: string;
  label: string;
  value: number;
  isCurrent?: boolean;
  isWeekend?: boolean;
}

interface ModernBarChartProps {
  data: BarPoint[];
  height?: number;
  showValues?: boolean;
  variant?: 'auto' | 'compact' | 'scroll';
  unit?: string;
}

export function ModernBarChart({
  data,
  height = 140,
  showValues = false,
  variant = 'auto',
  unit = 'kWh',
}: ModernBarChartProps) {
  const themeC = useColors();
  if (!data || data.length === 0) return null;

  const max = Math.max(...data.map((d) => d.value), 1);
  const compact = variant === 'compact' || (variant === 'auto' && data.length <= 14);
  const barWidth = compact ? Math.max(14, Math.min(28, 280 / data.length)) : 16;
  const barGap = compact ? 6 : 4;
  const totalWidth = (barWidth + barGap) * data.length;
  const chartHeight = height;
  const labelHeight = 22;
  const valueHeight = showValues ? 18 : 0;
  const svgHeight = chartHeight + labelHeight + valueHeight;

  const Content = (
    <Svg width={totalWidth} height={svgHeight} viewBox={`0 0 ${totalWidth} ${svgHeight}`}>
      <Defs>
        {/* current / highlighted bar */}
        <LinearGradient id="barCurrent" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={ChartPalette.amberGradient[0]} stopOpacity="1" />
          <Stop offset="50%" stopColor={ChartPalette.amberGradient[1]} stopOpacity="1" />
          <Stop offset="100%" stopColor={ChartPalette.amberGradient[2]} stopOpacity="0.9" />
        </LinearGradient>
        {/* weekday standard */}
        <LinearGradient id="barWeekday" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={ChartPalette.weekdayAmber[0]} stopOpacity="1" />
          <Stop offset="100%" stopColor={ChartPalette.weekdayAmber[1]} stopOpacity="1" />
        </LinearGradient>
        {/* weekend stronger */}
        <LinearGradient id="barWeekend" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={ChartPalette.weekendAmber[0]} stopOpacity="1" />
          <Stop offset="100%" stopColor={ChartPalette.weekendAmber[1]} stopOpacity="1" />
        </LinearGradient>
        {/* background track for each bar */}
        <LinearGradient id="barTrack" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="rgba(255,255,255,0.025)" />
          <Stop offset="100%" stopColor="rgba(255,255,255,0.005)" />
        </LinearGradient>
        {/* faint glow circle for the current bar top */}
        <RadialGradient id="topGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#FBBF24" stopOpacity="0.6" />
          <Stop offset="100%" stopColor="#FBBF24" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {/* Bars */}
      {data.map((d, idx) => {
        const x = idx * (barWidth + barGap);
        const valueH = Math.max((d.value / max) * chartHeight, 4);
        const y = valueHeight + (chartHeight - valueH);
        const fill = d.isCurrent
          ? 'url(#barCurrent)'
          : d.isWeekend
            ? 'url(#barWeekend)'
            : 'url(#barWeekday)';
        const rx = barWidth / 3;

        return (
          <G key={d.key}>
            {/* Track */}
            <Rect
              x={x}
              y={valueHeight}
              width={barWidth}
              height={chartHeight}
              fill="url(#barTrack)"
              rx={rx}
              ry={rx}
            />
            {/* Glow halo for current */}
            {d.isCurrent && (
              <Circle
                cx={x + barWidth / 2}
                cy={y}
                r={barWidth * 0.9}
                fill="url(#topGlow)"
                opacity={0.55}
              />
            )}
            {/* Real bar */}
            <Rect
              x={x}
              y={y}
              width={barWidth}
              height={valueH}
              fill={fill}
              rx={rx}
              ry={rx}
            />
            {/* Value label */}
            {showValues && (
              <SvgText
                x={x + barWidth / 2}
                y={valueHeight - 4}
                fontSize="9"
                fontWeight="700"
                fill={d.isCurrent ? ChartPalette.amberGradient[0] : ChartPalette.textMuted}
                textAnchor="middle"
              >
                {Math.round(d.value)}
              </SvgText>
            )}
            {/* X-axis label */}
            <SvgText
              x={x + barWidth / 2}
              y={svgHeight - 6}
              fontSize="10"
              fontWeight={d.isCurrent ? '800' : '600'}
              fill={d.isCurrent ? ChartPalette.amberGradient[0] : ChartPalette.textDim}
              textAnchor="middle"
            >
              {d.label}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );

  if (compact) {
    return <View style={styles.barWrap}>{Content}</View>;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 6 }}
    >
      {Content}
    </ScrollView>
  );
}

// ─────────────────────────────────────────────
// PREMIUM DONUT CHART
// ─────────────────────────────────────────────
interface DonutSegment {
  label: string;
  value: number;
  gradient: [string, string];
}

interface ModernDonutProps {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
  centerSub?: string;
}

export function ModernDonut({
  segments,
  size = 140,
  thickness = 16,
  centerLabel,
  centerValue,
  centerSub,
}: ModernDonutProps) {
  const themeC = useColors();
  const total = segments.reduce((acc, s) => acc + Math.max(s.value, 0), 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  let accumulated = 0;

  const arcs = useMemo(() => {
    if (total <= 0) return [];
    const gap = 0.005 * circumference; // small visual gap between arcs
    return segments.map((s, idx) => {
      const fraction = s.value / total;
      const length = Math.max(fraction * circumference - gap, 0.5);
      const offset = -accumulated;
      accumulated += fraction * circumference;
      return {
        id: `arc-${idx}`,
        length,
        offset,
        gradId: `donutGrad-${idx}`,
        gradient: s.gradient,
      };
    });
  }, [segments, total, circumference]);

  return (
    <View style={[styles.donutWrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Defs>
          {arcs.map((a) => (
            <LinearGradient
              key={a.gradId}
              id={a.gradId}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <Stop offset="0%" stopColor={a.gradient[0]} stopOpacity="1" />
              <Stop offset="100%" stopColor={a.gradient[1]} stopOpacity="1" />
            </LinearGradient>
          ))}
        </Defs>

        {/* Background track */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={themeC.glassBorder}
          strokeWidth={thickness}
          fill="none"
        />

        {/* Arcs */}
        {arcs.map((a) => (
          <Circle
            key={a.id}
            cx={cx}
            cy={cy}
            r={radius}
            stroke={`url(#${a.gradId})`}
            strokeWidth={thickness}
            fill="none"
            strokeDasharray={`${a.length} ${circumference - a.length}`}
            strokeDashoffset={a.offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ))}
      </Svg>

      {/* Center label */}
      <View style={styles.donutCenter} pointerEvents="none">
        {centerLabel ? (
          <Text style={[styles.donutLabel, { color: themeC.textMuted }]}>{centerLabel}</Text>
        ) : null}
        {centerValue ? (
          <Text style={[styles.donutValue, { color: themeC.textPrimary }]}>{centerValue}</Text>
        ) : null}
        {centerSub ? <Text style={styles.donutSub}>{centerSub}</Text> : null}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// SEGMENT LEGEND (for donut)
// ─────────────────────────────────────────────
interface LegendItem {
  label: string;
  value: string;
  color: string;
}

export function DonutLegend({ items }: { items: LegendItem[] }) {
  const themeC = useColors();
  return (
    <View style={styles.legendRoot}>
      {items.map((it, idx) => (
        <View key={idx} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: it.color }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.legendLabel}>{it.label}</Text>
            <Text style={[styles.legendValue, { color: themeC.textPrimary }]}>{it.value}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  barWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  donutWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  donutCenter: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
  },
  donutLabel: {
    fontSize: 9,
    color: ChartPalette.textDim,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  donutValue: {
    fontSize: 22,
    color: ChartPalette.text,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  donutSub: {
    fontSize: 10,
    color: ChartPalette.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  legendRoot: {
    gap: 6,
    marginTop: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10, height: 10, borderRadius: 5,
  },
  legendLabel: {
    fontSize: 11,
    color: ChartPalette.textMuted,
    fontWeight: '600',
  },
  legendValue: {
    fontSize: 12,
    color: ChartPalette.text,
    fontWeight: '700',
    marginTop: 1,
  },
});
