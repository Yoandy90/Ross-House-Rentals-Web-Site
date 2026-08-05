/**
 * HelpSection Component for React Native
 * Shows FAQ panel with expandable questions
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface FAQItem {
  question: string;
  answer: string;
}

interface HelpSectionProps {
  faqs: FAQItem[];
  context?: string;
}

export function HelpSection({ faqs, context }: HelpSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const handleCall = () => {
    Linking.openURL('tel:+18069342018');
  };

  return (
    <>
      {/* Floating Help Button */}
      <TouchableOpacity
        style={styles.helpButton}
        onPress={() => setIsOpen(true)}
      >
        <Ionicons name="help-circle" size={28} color="#fff" />
      </TouchableOpacity>

      {/* FAQ Modal */}
      <Modal
        visible={isOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.backdrop} 
            activeOpacity={1}
            onPress={() => setIsOpen(false)}
          />
          
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>❓ Ayuda</Text>
                {context && <Text style={styles.modalContext}>{context}</Text>}
              </View>
              <TouchableOpacity onPress={() => setIsOpen(false)}>
                <Ionicons name="close" size={28} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* FAQ List */}
            <ScrollView style={styles.faqList} showsVerticalScrollIndicator={false}>
              {faqs.map((faq, index) => (
                <View key={index} style={styles.faqItem}>
                  <TouchableOpacity
                    style={styles.faqQuestion}
                    onPress={() => setExpandedIndex(expandedIndex === index ? null : index)}
                  >
                    <Text style={styles.faqQuestionText}>{faq.question}</Text>
                    <Ionicons 
                      name={expandedIndex === index ? 'chevron-up' : 'chevron-down'} 
                      size={20} 
                      color="#10B981" 
                    />
                  </TouchableOpacity>
                  {expandedIndex === index && (
                    <View style={styles.faqAnswer}>
                      <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>

            {/* Contact Support */}
            <View style={styles.contactSection}>
              <Text style={styles.contactText}>¿Necesitas más ayuda?</Text>
              <TouchableOpacity style={styles.callButton} onPress={handleCall}>
                <Ionicons name="call" size={20} color="#10B981" />
                <Text style={styles.callButtonText}>Llamar a Ross Tax: (806) 934-2018</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

// Pre-defined FAQs for each step
export const WIZARD_FAQS = {
  discovery: [
    { question: '¿Qué información necesito para empezar?', answer: 'Solo necesitas tener a mano tu SSN (Seguro Social), tus formularios W-2 o 1099 si los tienes, y la información de tus dependientes si aplica.' },
    { question: '¿Cuánto tiempo toma completar el wizard?', answer: 'El proceso completo toma aproximadamente 10-15 minutos. Puedes pausar y continuar después, tu información se guarda automáticamente.' },
    { question: '¿Es seguro ingresar mi información aquí?', answer: 'Sí, toda tu información está encriptada y protegida. Ross Tax está certificado por el IRS como preparador autorizado (EFIN #759071).' },
  ],
  personalInfo: [
    { question: '¿Por qué necesitan mi SSN?', answer: 'El SSN es requerido por el IRS para identificarte en tu declaración de impuestos. Lo guardamos de forma encriptada y segura.' },
    { question: '¿Qué pasa si no tengo SSN?', answer: 'Si eres extranjero sin SSN, puedes usar un ITIN (Individual Taxpayer Identification Number). Contáctanos para ayudarte a obtener uno.' },
    { question: '¿Puedo cambiar mi información después?', answer: 'Sí, puedes editar cualquier información antes de enviar tu declaración final. Tu información se guarda automáticamente mientras escribes.' },
  ],
  filingStatus: [
    { question: '¿Cuál es la diferencia entre los estados civiles?', answer: 'Soltero: No estás casado. Casado Conjunto: Declaras junto con tu esposo/a (generalmente más beneficioso). Casado Separado: Declaras por separado. Cabeza de Familia: Soltero con dependientes (más deducciones).' },
    { question: '¿Qué es "Cabeza de Familia"?', answer: 'Es un estado especial para personas solteras que pagan más del 50% de los gastos del hogar y tienen un dependiente calificado. Ofrece mejores deducciones.' },
    { question: '¿Puedo declarar como soltero si estoy separado?', answer: 'Si estuviste legalmente separado o divorciado antes del 31 de diciembre, puedes declarar como soltero.' },
  ],
  income: [
    { question: '¿Qué es un W-2?', answer: 'Es el formulario que tu empleador te da cada año mostrando cuánto ganaste y cuánto te retuvieron de impuestos.' },
    { question: '¿Necesito reportar ingresos en efectivo?', answer: 'Sí, por ley debes reportar todos tus ingresos, incluyendo efectivo, propinas, y trabajos por cuenta propia.' },
    { question: '¿Qué pasa si no tengo mi W-2?', answer: 'Puedes solicitarlo a tu empleador o descargar una copia del IRS. También puedes subir una foto y nuestro sistema lo escanea automáticamente.' },
  ],
  dependents: [
    { question: '¿Quién califica como dependiente?', answer: 'Generalmente tus hijos menores de 19 años (o 24 si son estudiantes), o familiares que dependen de ti financieramente y viven contigo más de 6 meses.' },
    { question: '¿Cuánto me dan por cada dependiente?', answer: 'El Child Tax Credit puede darte hasta $2,000 por hijo menor de 17 años. Además, podrías calificar para el Earned Income Credit que puede llegar hasta $7,430.' },
    { question: '¿Qué pasa si comparto custodia?', answer: 'Solo uno de los padres puede reclamar al hijo como dependiente cada año. Generalmente es quien tiene la custodia principal.' },
  ],
  deductions: [
    { question: '¿Qué es mejor, estándar o detallada?', answer: 'La deducción estándar ($14,600 para solteros en 2024) es mejor para la mayoría. Solo usa detallada si tus gastos deducibles (hipoteca, donaciones, etc.) superan ese monto.' },
    { question: '¿Qué puedo deducir?', answer: 'Intereses de hipoteca, impuestos de propiedad, donaciones caritativas, gastos médicos que superen el 7.5% de tus ingresos, y contribuciones a IRA.' },
    { question: '¿Qué es el EITC?', answer: 'El Earned Income Tax Credit es un crédito para trabajadores con ingresos bajos a moderados. Puede darte un reembolso incluso si no debes impuestos.' },
  ],
  review: [
    { question: '¿El estimado es exacto?', answer: 'El estimado se basa en la información que proporcionaste. El monto final puede variar ligeramente después de la revisión profesional.' },
    { question: '¿Cuándo recibiré mi reembolso?', answer: 'Si eliges depósito directo, generalmente entre 10-21 días después de que el IRS acepte tu declaración.' },
    { question: '¿Qué pasa después de confirmar?', answer: 'Un preparador de Ross Tax revisará tu información, te contactará si tiene preguntas, y enviará tu declaración al IRS una vez aprobada.' },
  ],
};

const styles = StyleSheet.create({
  helpButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  modalContext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  faqList: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  faqItem: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  faqQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
  },
  faqQuestionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginRight: 10,
  },
  faqAnswer: {
    padding: 16,
    paddingTop: 0,
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  faqAnswerText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
  },
  contactSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  contactText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  callButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
  },
});
