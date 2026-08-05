import React, { useState, useEffect } from 'react';
import { View, Platform, StyleSheet, Dimensions } from 'react-native';
import { Tabs, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AdminSidebar from '../../components/admin/AdminSidebar';
import { registerForPushNotificationsAsync } from '../../services/notificationService';
import { useAuth } from '../../contexts/AuthContext';

export default function AdminLayout() {
  const isWeb = Platform.OS === 'web';
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isAssistant = user?.role === 'office_assistant' || user?.role === 'assistant';
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width);
  
  // Detectar cambios de tamaño de ventana
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setWindowWidth(window.width);
    });
    
    return () => subscription?.remove();
  }, []);

  // Request push notification permissions on admin app start
  useEffect(() => {
    const initNotifications = async () => {
      if (Platform.OS !== 'web') {
        try {
          console.log('🔔 Admin: Initializing push notifications...');
          await registerForPushNotificationsAsync();
          console.log('✅ Admin: Push notifications initialized');
        } catch (error) {
          console.log('⚠️ Admin: Push notifications not available:', error);
        }
      }
    };
    
    // Small delay to let the app fully load first
    const timer = setTimeout(initNotifications, 1500);
    return () => clearTimeout(timer);
  }, []);
  
  // Mostrar sidebar solo en web Y con ancho > 768px (tablet/desktop)
  const shouldShowSidebar = isWeb && windowWidth > 768;

  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
      {!isWeb && <StatusBar style="light" backgroundColor="#0F172A" />}
      
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#0F172A' }}>
        {/* Sidebar solo en web con ancho suficiente */}
        {shouldShowSidebar && <AdminSidebar />}
        
        {/* Contenido con tabs */}
        <View style={shouldShowSidebar ? styles.webContent : { flex: 1 }}>
        <Tabs
          backBehavior="history"
          screenOptions={{
            tabBarActiveTintColor: '#C41E3A',
            tabBarInactiveTintColor: '#95A5A6',
            tabBarStyle: shouldShowSidebar ? { display: 'none' } : {
              backgroundColor: '#0F172A',
              borderTopWidth: 1,
              borderTopColor: '#334155',
              elevation: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              height: 70 + insets.bottom,
              paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
              paddingTop: 12,
            },
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: '600',
              marginBottom: 5,
            },
            tabBarIconStyle: {
              marginTop: 3,
            },
            tabBarHideOnKeyboard: true,
            headerShown: false,
            contentStyle: shouldShowSidebar ? undefined : {
              backgroundColor: '#0F172A',
              paddingTop: 0,
            },
            lazy: true,
            // Fix para crash iOS en react-native-screens
            // Previene SIGABRT en setViewToSnapshot durante navegación
            detachInactiveScreens: false,
            freezeOnBlur: false,
          }}
        >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          href: isAssistant ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: 'Clientes',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tramites"
        options={{
          title: 'Trámites',
          href: isAssistant ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="folder-open" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="invoices"
        options={{
          title: 'Facturas',
          href: isAssistant ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'Menú',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="menu" size={size} color={color} />
          ),
        }}
      />
      
      {/* Hidden screens - accessible from menu only */}
      <Tabs.Screen
        name="leads"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="job-applications"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="whatsapp-conversations"
        options={{
          href: null, // Hide from tab bar - accessible from menu
        }}
      />
      <Tabs.Screen
        name="whatsapp-settings"
        options={{
          href: null, // Hide from tab bar - accessible from menu
        }}
      />
      <Tabs.Screen
        name="whatsapp-automation"
        options={{
          href: null, // Hide from tab bar - accessible from menu
        }}
      />
      <Tabs.Screen
        name="logs"
        options={{
          href: null, // Hide from tab bar - accessible from menu
        }}
      />
      <Tabs.Screen
        name="feedbacks"
        options={{
          href: null, // Hide from tab bar - accessible from menu
        }}
      />
      <Tabs.Screen
        name="felicitaciones"
        options={{
          href: null, // Hide from tab bar - accessible from menu
        }}
      />
      <Tabs.Screen
        name="reviews"
        options={{
          href: null, // Hide from tab bar - accessible from menu
        }}
      />
      <Tabs.Screen
        name="calendario"
        options={{
          href: null, // Hide from tab bar - accessible from menu
        }}
      />
      <Tabs.Screen
        name="gastos-clientes"
        options={{
          href: null, // Hide from tab bar - accessible from menu
        }}
      />
      <Tabs.Screen
        name="declaraciones"
        options={{
          href: null, // Hide from tab bar - accessible from menu
        }}
      />
      <Tabs.Screen
        name="completar-servicio"
        options={{
          href: null, // Hide from tab bar - accessed from appointment actions
        }}
      />
      <Tabs.Screen
        name="marketing"
        options={{
          href: null, // Hide from tab bar - accessible from menu
        }}
      />
      <Tabs.Screen
        name="motions"
        options={{
          href: null, // Hide from tab bar - accessible from menu (Immigration Motions)
        }}
      />
      
        </Tabs>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  webContent: {
    flex: 1,
    marginLeft: 280,
  },
});
