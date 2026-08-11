/**
 * useAdminReports — Fetch financial reports and export
 */
import { useState, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { API_URL } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';

export interface ReportData {
  by_type: Array<{
    loan_type: string;
    count: number;
    total_invested: number;
    total_interest: number;
    fees_collected: number;
    total_collected: number;
    total_balance: number;
  }>;
  by_month: Array<{
    month: string;
    count: number;
    total_invested: number;
    total_collected: number;
    fees_collected: number;
  }>;
  summary: {
    total_loans: number;
    total_invested: number;
    total_interest: number;
    total_fees: number;
    total_collected: number;
    total_balance: number;
    avg_loan_amount: number;
  };
}

export function useAdminReports() {
  const { token } = useAuth();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }), [token]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/regulated-loans/reports`, { headers: headers() });
      if (res.ok) setReport(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [headers]);

  const exportExcel = useCallback(async () => {
    setExporting(true);
    try {
      const url = `${API_URL}/api/admin/regulated-loans/export-excel`;
      const fileName = `Prestamos_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const fileUri = FileSystem.documentDirectory + fileName;

      const download = await FileSystem.downloadAsync(url, fileUri, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (download.status === 200) {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(download.uri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Exportar Reporte',
          });
        } else {
          Alert.alert('Descargado', `Archivo guardado: ${fileName}`);
        }
      } else {
        Alert.alert('Error', 'No se pudo generar el reporte');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Error al exportar el reporte');
    }
    setExporting(false);
  }, [token]);

  return { report, loading, exporting, fetchReport, exportExcel };
}
