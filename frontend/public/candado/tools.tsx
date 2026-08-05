import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '../../constants/colors';

const { width: screenWidth } = Dimensions.get('window');

interface Tool {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  colors: string[];
  badge?: string;
}

export default function ToolsScreen() {
  const router = useRouter();
  const colors = useThemeColors();

  const mainTools: Tool[] = [
    {
      id: 'photo_2x2',
      title: 'Foto Personal 2x2',
      description: 'Toma tu foto de pasaporte con guías profesionales',
      icon: 'camera',
      route: '/camera-capture?type=photo_2x2',
      colors: ['#10B981', '#059669'],
      badge: 'Popular',
    },
    {
      id: 'id_document',
      title: 'ID / Licencia',
      description: 'Escanea tu identificación oficial o licencia de conducir',
      icon: 'id-card',
      route: '/camera-capture?type=id_front',
      colors: ['#3B82F6', '#1D4ED8'],
    },
    {
      id: 'tax_document',
      title: 'Documentos Fiscales',
      description: 'W2, 1099, y otros documentos de impuestos',
      icon: 'document-text',
      route: '/camera-capture?type=w2',
      colors: ['#F59E0B', '#D97706'],
      badge: 'Nuevo',
    },
  ];

  const additionalTools: Tool[] = [
    {
      id: 'receipt',
      title: 'Recibos',
      description: 'Escanea recibos y facturas',
      icon: 'receipt',
      route: '/camera-capture?type=receipt',
      colors: ['#8B5CF6', '#7C3AED'],
    },
    {
      id: 'my_documents',
      title: 'Mis Documentos',
      description: 'Ver documentos enviados',
      icon: 'folder-open',
      route: '/(tabs)/documents',
      colors: ['#6B7280', '#4B5563'],
    },
    {
      id: 'tax_calculator',
      title: 'Calculadora',
      description: 'Estima tus impuestos',
      icon: 'calculator',
      route: '/(tabs)/tax-calculator',
      colors: ['#EC4899', '#DB2777'],
    },
  ];

  const renderMainToolCard = (tool: Tool) => (
    <TouchableOpacity
      key={tool.id}
      style={styles.mainToolCard}
      onPress={() => router.push(tool.route as any)}
      activeOpacity={0.9}
    >
      <LinearGradient
        colors={tool.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.mainToolGradient}
      >
        {tool.badge && (
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>{tool.badge}</Text>
          </View>
        )}
        
        <View style={styles.mainToolContent}>
          <View style={styles.mainToolIconContainer}>
            <Ionicons name={tool.icon} size={36} color="#FFF" />
          </View>
          <View style={styles.mainToolTextContainer}>
            <Text style={styles.mainToolTitle}>{tool.title}</Text>
            <Text style={styles.mainToolDescription}>{tool.description}</Text>
          </View>
          <View style={styles.mainToolArrow}>
            <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.8)" />
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderSmallToolCard = (tool: Tool) => (
    <TouchableOpacity
      key={tool.id}
      style={styles.smallToolCard}
      onPress={() => router.push(tool.route as any)}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={tool.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.smallToolGradient}
      >
        <Ionicons name={tool.icon} size={28} color="#FFF" />
      </LinearGradient>
      <Text style={styles.smallToolTitle}>{tool.title}</Text>
      <Text style={styles.smallToolDescription}>{tool.description}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>🛠️ Herramientas</Text>
          <Text style={styles.headerSubtitle}>Escanea y gestiona tus documentos</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Tools Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Escanear Documentos</Text>
          <View style={styles.mainToolsContainer}>
            {mainTools.map(renderMainToolCard)}
          </View>
        </View>

        {/* Additional Tools Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Más Herramientas</Text>
          <View style={styles.smallToolsGrid}>
            {additionalTools.map(renderSmallToolCard)}
          </View>
        </View>

        {/* How it works */}
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <View style={styles.infoIconContainer}>
              <Ionicons name="help-circle" size={24} color="#6C1110" />
            </View>
            <Text style={styles.infoTitle}>¿Cómo funciona?</Text>
          </View>
          
          <View style={styles.stepContainer}>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={styles.stepText}>Selecciona el tipo de documento</Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.stepText}>Sigue las guías en pantalla</Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={styles.stepText}>Toma la foto y envía</Text>
            </View>
          </View>
        </View>

        {/* Security Note */}
        <View style={styles.securityCard}>
          <Ionicons name="shield-checkmark" size={24} color="#10B981" />
          <Text style={styles.securityText}>
            Tus documentos son enviados de forma segura con encriptación de extremo a extremo
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#6C1110',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 24,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
    marginLeft: 4,
  },
  mainToolsContainer: {
    gap: 12,
  },
  mainToolCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  mainToolGradient: {
    padding: 20,
    position: 'relative',
  },
  badgeContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  mainToolContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mainToolIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  mainToolTextContainer: {
    flex: 1,
    paddingRight: 32,
  },
  mainToolTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  mainToolDescription: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 18,
  },
  mainToolArrow: {
    position: 'absolute',
    right: 0,
    top: '50%',
    marginTop: -12,
  },
  smallToolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  smallToolCard: {
    width: (screenWidth - 44) / 3,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  smallToolGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  smallToolTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 4,
  },
  smallToolDescription: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 14,
  },
  infoCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  stepContainer: {
    gap: 12,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#6C1110',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  stepText: {
    fontSize: 14,
    color: '#4B5563',
    flex: 1,
  },
  securityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  securityText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 13,
    color: '#065F46',
    lineHeight: 18,
  },
});
