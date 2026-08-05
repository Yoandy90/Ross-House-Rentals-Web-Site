import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  PanResponder,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '../constants/colors';
import api from '../services/api';
import CustomHeader from '../components/CustomHeader';

// Simple custom slider component to avoid @react-native-community/slider issues
const SimpleSlider = ({ 
  minimumValue = 0, 
  maximumValue = 100, 
  value = 50, 
  step = 1,
  onValueChange,
  minimumTrackTintColor = '#007AFF',
  maximumTrackTintColor = '#E0E0E0',
  thumbTintColor = '#007AFF',
  style
}: {
  minimumValue?: number;
  maximumValue?: number;
  value?: number;
  step?: number;
  onValueChange?: (value: number) => void;
  minimumTrackTintColor?: string;
  maximumTrackTintColor?: string;
  thumbTintColor?: string;
  style?: any;
}) => {
  const [sliderWidth, setSliderWidth] = useState(0);
  const calculatePosition = () => {
    const range = maximumValue - minimumValue;
    const normalizedValue = (value - minimumValue) / range;
    return normalizedValue * sliderWidth;
  };

  const handlePress = (event: any) => {
    if (sliderWidth === 0) return;
    const { locationX } = event.nativeEvent;
    const range = maximumValue - minimumValue;
    let newValue = minimumValue + (locationX / sliderWidth) * range;
    
    // Apply step
    if (step > 0) {
      newValue = Math.round(newValue / step) * step;
    }
    
    // Clamp value
    newValue = Math.max(minimumValue, Math.min(maximumValue, newValue));
    
    if (onValueChange) {
      onValueChange(newValue);
    }
  };

  const thumbPosition = calculatePosition();

  return (
    <View 
      style={[{ height: 40, justifyContent: 'center' }, style]}
      onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={handlePress}
        style={{ height: 40, justifyContent: 'center' }}
      >
        {/* Track */}
        <View style={{ 
          height: 4, 
          backgroundColor: maximumTrackTintColor, 
          borderRadius: 2,
          overflow: 'hidden'
        }}>
          <View style={{ 
            height: 4, 
            width: thumbPosition, 
            backgroundColor: minimumTrackTintColor,
            borderRadius: 2
          }} />
        </View>
        
        {/* Thumb */}
        <View style={{
          position: 'absolute',
          left: thumbPosition - 12,
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: thumbTintColor,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 5,
        }} />
      </TouchableOpacity>
    </View>
  );
};

interface LoanProduct {
  id: string;
  name: string;
  description: string;
  min_amount: number;
  max_amount: number;
  term_type: string;
  term_count: number;
  apr: number;
  opening_fee: {
    type: string;
    value: number;
  };
  interest_method: string;
}

export default function LoansScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { t } = useTranslation();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<LoanProduct | null>(null);
  
  // Simulator state
  const [amount, setAmount] = useState(1000);
  const [termMonths, setTermMonths] = useState(12);
  const [monthlyPayment, setMonthlyPayment] = useState(0);
  const [totalInterest, setTotalInterest] = useState(0);
  const [totalPayment, setTotalPayment] = useState(0);
  const [apr, setApr] = useState(0);
  const [openingFee, setOpeningFee] = useState(0);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (selectedProduct) {
      calculateLoan();
    }
  }, [amount, termMonths, selectedProduct]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/loan-products');
      const prods = response.data;
      
      if (prods.length > 0) {
        setProducts(prods);
        setSelectedProduct(prods[0]);
        setAmount(prods[0].min_amount);
        setTermMonths(prods[0].term_count);
      }
    } catch (error: any) {
      console.error('Error loading products:', error);
      Alert.alert('Error', 'No se pudieron cargar los productos de préstamo');
    } finally {
      setLoading(false);
    }
  };

  const calculateLoan = () => {
    if (!selectedProduct) return;

    const principal = amount;
    const annualRate = selectedProduct.apr;
    const monthlyRate = annualRate / 12;
    const n = termMonths;

    // Calculate opening fee
    let fee = 0;
    if (selectedProduct.opening_fee.type === 'percent') {
      fee = principal * (selectedProduct.opening_fee.value / 100);
    } else {
      fee = selectedProduct.opening_fee.value;
    }

    // Calculate monthly payment using Price formula
    let payment = 0;
    if (monthlyRate === 0) {
      payment = principal / n;
    } else {
      payment = principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -n));
    }

    const totalPaid = payment * n;
    const interest = totalPaid - principal;
    const totalWithFee = totalPaid + fee;

    setMonthlyPayment(Math.round(payment * 100) / 100);
    setTotalInterest(Math.round(interest * 100) / 100);
    setTotalPayment(Math.round(totalWithFee * 100) / 100);
    setApr(annualRate);
    setOpeningFee(Math.round(fee * 100) / 100);
  };

  const handleApply = () => {
    if (!selectedProduct) return;
    
    router.push({
      pathname: '/loan-application',
      params: {
        productId: selectedProduct.id,
        amount: amount.toString(),
        termMonths: termMonths.toString(),
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <CustomHeader 
          title="Préstamos"
          showBackButton={true}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando productos...</Text>
        </View>
      </View>
    );
  }

  if (products.length === 0) {
    return (
      <View style={styles.container}>
        <CustomHeader 
          title="Préstamos"
          showBackButton={true}
        />
        <View style={styles.emptyContainer}>
          <Ionicons name="business-outline" size={64} color={colors.textGray} />
          <Text style={styles.emptyText}>No hay productos disponibles</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CustomHeader 
        title="Préstamos"
        showBackButton={true}
      />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Product Selector */}
          {products.length > 1 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Selecciona un producto</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.productChips}>
                  {products.map((product) => (
                    <TouchableOpacity
                      key={product.id}
                      style={[
                        styles.productChip,
                        selectedProduct?.id === product.id && styles.productChipActive,
                      ]}
                      onPress={() => {
                        setSelectedProduct(product);
                        setAmount(product.min_amount);
                        setTermMonths(product.term_count);
                      }}
                    >
                      <Text
                        style={[
                          styles.productChipText,
                          selectedProduct?.id === product.id && styles.productChipTextActive,
                        ]}
                      >
                        {product.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {selectedProduct && (
            <>
              {/* Simulator */}
              <View style={styles.simulatorCard}>
                <Text style={styles.simulatorTitle}>Simula tu préstamo</Text>

                {/* Amount */}
                <View style={styles.inputSection}>
                  <Text style={styles.inputLabel}>Monto del préstamo</Text>
                  <Text style={styles.inputValue}>${amount.toLocaleString()}</Text>
                  <SimpleSlider
                    style={styles.slider}
                    minimumValue={selectedProduct.min_amount}
                    maximumValue={selectedProduct.max_amount}
                    step={100}
                    value={amount}
                    onValueChange={setAmount}
                    minimumTrackTintColor={colors.primary}
                    maximumTrackTintColor={colors.border}
                    thumbTintColor={colors.primary}
                  />
                  <View style={styles.sliderLabels}>
                    <Text style={styles.sliderLabel}>
                      ${selectedProduct.min_amount.toLocaleString()}
                    </Text>
                    <Text style={styles.sliderLabel}>
                      ${selectedProduct.max_amount.toLocaleString()}
                    </Text>
                  </View>
                </View>

                {/* Term */}
                <View style={styles.inputSection}>
                  <Text style={styles.inputLabel}>Plazo (meses)</Text>
                  <Text style={styles.inputValue}>{termMonths} meses</Text>
                  <SimpleSlider
                    style={styles.slider}
                    minimumValue={6}
                    maximumValue={selectedProduct.term_count}
                    step={1}
                    value={termMonths}
                    onValueChange={setTermMonths}
                    minimumTrackTintColor={colors.primary}
                    maximumTrackTintColor={colors.border}
                    thumbTintColor={colors.primary}
                  />
                  <View style={styles.sliderLabels}>
                    <Text style={styles.sliderLabel}>6 meses</Text>
                    <Text style={styles.sliderLabel}>{selectedProduct.term_count} meses</Text>
                  </View>
                </View>

                {/* Results */}
                <View style={styles.resultsCard}>
                  <View style={styles.resultRow}>
                    <Text style={styles.resultLabel}>Pago mensual</Text>
                    <Text style={styles.resultValue}>
                      ${monthlyPayment.toLocaleString()}
                    </Text>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.resultRow}>
                    <Text style={styles.resultLabelSmall}>Comisión de apertura</Text>
                    <Text style={styles.resultValueSmall}>
                      ${openingFee.toLocaleString()}
                    </Text>
                  </View>

                  <View style={styles.resultRow}>
                    <Text style={styles.resultLabelSmall}>Intereses totales</Text>
                    <Text style={styles.resultValueSmall}>
                      ${totalInterest.toLocaleString()}
                    </Text>
                  </View>

                  <View style={styles.resultRow}>
                    <Text style={styles.resultLabelSmall}>Total a pagar</Text>
                    <Text style={styles.resultValueSmall}>
                      ${totalPayment.toLocaleString()}
                    </Text>
                  </View>

                  <View style={styles.resultRow}>
                    <Text style={styles.resultLabelSmall}>Tasa anual (APR)</Text>
                    <Text style={styles.resultValueSmall}>
                      {(apr * 100).toFixed(2)}%
                    </Text>
                  </View>
                </View>

                {/* Apply Button */}
                <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
                  <LinearGradient
                    colors={[colors.primary, colors.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.applyButtonGradient}
                  >
                    <Ionicons name="document-text" size={20} color="#FFF" />
                    <Text style={styles.applyButtonText}>Solicitar Préstamo</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {/* Info */}
              <View style={styles.infoCard}>
                <Ionicons name="information-circle" size={24} color={colors.accent} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoTitle}>Requisitos</Text>
                  <Text style={styles.infoText}>• Ser mayor de 18 años</Text>
                  <Text style={styles.infoText}>• Comprobante de ingresos</Text>
                  <Text style={styles.infoText}>• Identificación oficial</Text>
                  <Text style={styles.infoText}>• Cuenta bancaria activa</Text>
                </View>
              </View>

              {/* My Loans Button */}
              <TouchableOpacity
                style={styles.myLoansButton}
                onPress={() => router.push('/my-loans')}
              >
                <Ionicons name="list" size={20} color={colors.primary} />
                <Text style={styles.myLoansButtonText}>Ver mis préstamos</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.primary} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textGray,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textGray,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingTop: Platform.OS === 'web' ? 32 : 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  productChips: {
    flexDirection: 'row',
    gap: 12,
  },
  productChip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
  },
  productChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  productChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  productChipTextActive: {
    color: '#FFF',
  },
  simulatorCard: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  simulatorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 24,
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textGray,
    marginBottom: 8,
  },
  inputValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 12,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sliderLabel: {
    fontSize: 12,
    color: colors.textGray,
  },
  resultsCard: {
    backgroundColor: colors.backgroundGray,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
  },
  resultLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  resultValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
  },
  resultLabelSmall: {
    fontSize: 14,
    color: colors.text,
  },
  resultValueSmall: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  applyButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  applyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: colors.accent + '10',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.accent + '30',
    marginBottom: 20,
  },
  infoContent: {
    flex: 1,
    gap: 6,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  myLoansButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
    gap: 8,
  },
  myLoansButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    flex: 1,
  },
});
