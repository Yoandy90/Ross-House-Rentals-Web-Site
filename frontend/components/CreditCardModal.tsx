import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Linking,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../constants/colors';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../services/api';

interface CreditCardModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function CreditCardModal({ visible, onClose }: CreditCardModalProps) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(false);
  const [affiliateData, setAffiliateData] = useState<any>(null);

  useEffect(() => {
    if (visible) {
      loadAffiliateLink();
    }
  }, [visible]);

  const loadAffiliateLink = async () => {
    try {
      setLoading(true);
      const response = await api.get('/affiliate-links');
      
      // Find the credit card link (Yendo)
      const creditCardLink = response.data.links.find(
        (link: any) => link.service_type === 'credit_card'
      );
      
      if (creditCardLink) {
        setAffiliateData(creditCardLink);
      }
    } catch (error) {
      console.error('Error loading affiliate link:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyNow = async () => {
    if (affiliateData?.affiliate_url) {
      try {
        const supported = await Linking.canOpenURL(affiliateData.affiliate_url);
        
        if (supported) {
          await Linking.openURL(affiliateData.affiliate_url);
        } else {
          Alert.alert('Error', 'No se puede abrir el enlace');
        }
      } catch (error) {
        console.error('Error opening URL:', error);
        Alert.alert('Error', 'No se pudo abrir el enlace de aplicación');
      }
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="card" size={28} color={colors.primary} />
              <Text style={styles.modalTitle}>
                {affiliateData?.service_name || 'Tarjeta de Crédito'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : affiliateData ? (
            <ScrollView 
              style={styles.contentScroll}
              showsVerticalScrollIndicator={false}
            >
              {/* Service Logo/Icon - Yendo Card Image */}
              <View style={styles.logoContainer}>
                <Image
                  source={{ uri: 'https://customer-assets.emergentagent.com/job_tax-portal-ui/artifacts/ivehwnfr_IMG_1999.webp' }}
                  style={styles.yendoCardImage}
                  resizeMode="contain"
                />
              </View>

              {/* Description */}
              <View style={styles.descriptionContainer}>
                <Text style={styles.descriptionText}>
                  {affiliateData.description_es}
                </Text>
              </View>

              {/* Benefits Section */}
              {affiliateData.benefits_es && affiliateData.benefits_es.length > 0 && (
                <View style={styles.benefitsContainer}>
                  <Text style={styles.benefitsTitle}>✨ Beneficios Principales</Text>
                  {affiliateData.benefits_es.map((benefit: string, index: number) => (
                    <View key={index} style={styles.benefitItem}>
                      <Ionicons 
                        name="checkmark-circle" 
                        size={24} 
                        color={colors.success} 
                      />
                      <Text style={styles.benefitText}>{benefit}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Apply Button */}
              <TouchableOpacity
                onPress={handleApplyNow}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[colors.primary, colors.secondary]}
                  style={styles.applyButton}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.applyButtonText}>
                    {affiliateData.button_text_es || 'Aplicar Ahora'}
                  </Text>
                  <Ionicons name="arrow-forward" size={24} color="#FFF" />
                </LinearGradient>
              </TouchableOpacity>

              {/* Disclaimer */}
              <View style={styles.disclaimerContainer}>
                <Ionicons name="information-circle-outline" size={20} color={colors.textGray} />
                <Text style={styles.disclaimerText}>
                  Serás redirigido al sitio oficial de {affiliateData.service_name} para completar tu aplicación.
                </Text>
              </View>
            </ScrollView>
          ) : (
            <View style={styles.noDataContainer}>
              <Ionicons name="alert-circle-outline" size={60} color={colors.textGray} />
              <Text style={styles.noDataText}>
                No hay información disponible en este momento
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.okButton}>
                <Text style={styles.okButtonText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  contentScroll: {
    paddingHorizontal: 20,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  yendoCardImage: {
    width: 280,
    height: 180,
    borderRadius: 16,
  },
  yendoLogo: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  logoGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  descriptionContainer: {
    marginBottom: 24,
  },
  descriptionText: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  benefitsContainer: {
    marginBottom: 24,
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 20,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  benefitText: {
    fontSize: 15,
    color: colors.textPrimary,
    flex: 1,
    lineHeight: 22,
  },
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 18,
    borderRadius: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  applyButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  disclaimerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: 24,
  },
  disclaimerText: {
    fontSize: 13,
    color: colors.textGray,
    flex: 1,
    lineHeight: 18,
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  noDataText: {
    fontSize: 16,
    color: colors.textGray,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  okButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  okButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});