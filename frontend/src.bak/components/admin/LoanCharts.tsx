/**
 * LoanCharts — Pie and Bar charts for loan distribution and trends
 */
import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { PieChart, BarChart } from 'react-native-chart-kit';
import { Colors } from '../../constants/theme';

const screenWidth = Dimensions.get('window').width;

interface PieItem {
  name: string;
  count: number;
  color: string;
  legendFontColor: string;
  amount?: number;
}

interface MonthlyItem {
  month: string;
  invested: number;
  profit: number;
  count: number;
}

interface LoanChartsProps {
  typeDistribution: PieItem[];
  statusDistribution: PieItem[];
  monthlyTrend: MonthlyItem[];
}

const chartConfig = {
  backgroundGradientFrom: Colors.surface,
  backgroundGradientTo: Colors.surface,
  color: (opacity = 1) => `rgba(52, 211, 153, ${opacity})`,
  labelColor: () => Colors.textMuted,
  barPercentage: 0.6,
  decimalPlaces: 0,
  propsForLabels: { fontSize: 10 },
};

export default function LoanCharts({ typeDistribution, statusDistribution, monthlyTrend }: LoanChartsProps) {
  const pieWidth = screenWidth - 48;

  const hasTypeData = typeDistribution && typeDistribution.length > 0;
  const hasStatusData = statusDistribution && statusDistribution.length > 0;
  const hasTrendData = monthlyTrend && monthlyTrend.some(m => m.invested > 0 || m.profit > 0);

  return (
    <View style={styles.container}>
      {/* ═══ Loan Type Pie Chart ═══ */}
      {hasTypeData && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>📊 Distribución por Tipo</Text>
          <PieChart
            data={typeDistribution.map(d => ({ ...d, population: d.count, legendFontSize: 11 }))}
            width={pieWidth}
            height={160}
            chartConfig={chartConfig}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          />
        </View>
      )}

      {/* ═══ Status Pie Chart ═══ */}
      {hasStatusData && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>📋 Estado de Préstamos</Text>
          <PieChart
            data={statusDistribution.map(d => ({ ...d, population: d.count, legendFontSize: 11 }))}
            width={pieWidth}
            height={160}
            chartConfig={chartConfig}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          />
        </View>
      )}

      {/* ═══ Monthly Trend Bar Chart ═══ */}
      {hasTrendData && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>📈 Tendencia Mensual</Text>
          <BarChart
            data={{
              labels: monthlyTrend.map(m => m.month),
              datasets: [
                {
                  data: monthlyTrend.map(m => m.invested / 1000 || 0),
                  color: (opacity = 1) => `rgba(52, 211, 153, ${opacity})`,
                },
              ],
            }}
            width={pieWidth}
            height={180}
            chartConfig={{
              ...chartConfig,
              barPercentage: 0.5,
            }}
            fromZero
            showValuesOnTopOfBars
            yAxisSuffix="K"
            yAxisLabel="$"
            style={styles.barChart}
          />
          <Text style={styles.chartNote}>Capital invertido por mes (en miles)</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  chartCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  barChart: {
    borderRadius: 12,
  },
  chartNote: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
});
