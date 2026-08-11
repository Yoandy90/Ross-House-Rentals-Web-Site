import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Stack, router } from 'expo-router';

class LoanErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[LoanErrorBoundary] Crash caught:', error.message, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Algo salió mal</Text>
          <Text style={styles.errorMsg}>{this.state.error?.message || 'Error desconocido'}</Text>
          <TouchableOpacity
            style={styles.errorBtn}
            onPress={() => {
              this.setState({ hasError: false, error: null });
              try { router.replace('/(tabs)/apply'); } catch { /* ignore */ }
            }}
          >
            <Text style={styles.errorBtnText}>Volver al Inicio</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function LoanLayout() {
  return (
    <LoanErrorBoundary>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="verify-identity" />
        <Stack.Screen name="disbursement" />
        <Stack.Screen name="sign-contract" />
        <Stack.Screen name="application-status" />
      </Stack>
    </LoanErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#060910', padding: 32 },
  errorIcon: { fontSize: 48, marginBottom: 16 },
  errorTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 8 },
  errorMsg: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  errorBtn: { backgroundColor: '#059669', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  errorBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
