import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

export default function NotFoundScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, loading } = useAuth();

  useEffect(() => {
    // Redirigir automáticamente
    if (!loading) {
      console.log('🚨 Not Found Screen - Usuario:', user?.email, 'Rol:', user?.role);
      if (user) {
        // Redirigir según el rol del usuario
        if (user.role === 'admin' || user.role === 'office_assistant') {
          router.replace('/(admin)');
        } else {
          router.replace('/(tabs)');
        }
      } else {
        // Si no hay usuario, ir a login
        router.replace('/(auth)/login');
      }
    }
  }, [user, loading]);

  const handleGoHome = () => {
    if (user) {
      // Redirigir según el rol del usuario
      if (user.role === 'admin' || user.role === 'office_assistant') {
        router.replace('/(admin)');
      } else {
        router.replace('/(tabs)');
      }
    } else {
      // Si no hay usuario, ir a login
      router.replace('/(auth)/login');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="alert-circle-outline" size={120} color="#6C1110" />
        <Text style={styles.title}>Redirigiendo...</Text>
        <Text style={styles.message}>
          Un momento por favor.
        </Text>
        <TouchableOpacity style={styles.button} onPress={handleGoHome}>
          <Ionicons name="home" size={24} color="#FFF" style={styles.buttonIcon} />
          <Text style={styles.buttonText}>Ir al Inicio</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6C1110',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
  },
});
