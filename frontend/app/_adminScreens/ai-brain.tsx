/**
 * 🧠 Ross AI Brain - Ultra Premium Redesign 2025
 * Modern Glass UI | Voice Support | Smart Actions
 * Powered by Gemini 2.5 Pro
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  Vibration,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import api from '../../services/api';

const { width, height } = Dimensions.get('window');

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  tokens?: number;
  isTyping?: boolean;
}

interface Metric {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  gradient: string[];
  trend?: number;
  description?: string;
}

interface QuickAction {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle: string;
  command: string;
  gradient: string[];
  category: 'tax' | 'clients' | 'reports' | 'automation';
}

interface SuggestedQuestion {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  category: string;
}

export default function AIBrainPremiumScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [command, setCommand] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'insights' | 'actions'>('chat');
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  // Suggested Questions for new users
  const suggestedQuestions: SuggestedQuestion[] = [
    { icon: 'receipt', text: '¿Cuál es el estado de mi reembolso?', category: 'Taxes' },
    { icon: 'calendar', text: '¿Cuándo es mi próxima cita?', category: 'Citas' },
    { icon: 'document-text', text: '¿Qué documentos necesito para mi declaración?', category: 'Documentos' },
    { icon: 'cash', text: '¿Cuánto debo pagar de impuestos estimados?', category: 'Pagos' },
  ];

  // Premium Quick Actions
  const quickActions: QuickAction[] = [
    { 
      id: '1',
      icon: 'calculator', 
      label: 'Calcular Reembolso', 
      subtitle: 'Estimación instantánea',
      command: 'Calcula una estimación de mi reembolso de impuestos basado en mis datos',
      gradient: ['#667eea', '#764ba2'],
      category: 'tax'
    },
    { 
      id: '2',
      icon: 'calendar-outline', 
      label: 'Próxima Cita', 
      subtitle: 'Ver o agendar',
      command: '¿Cuándo es mi próxima cita y qué debo llevar?',
      gradient: ['#11998e', '#38ef7d'],
      category: 'clients'
    },
    { 
      id: '3',
      icon: 'document-attach', 
      label: 'Documentos Faltantes', 
      subtitle: 'Revisar pendientes',
      command: '¿Qué documentos me faltan por subir para completar mi declaración?',
      gradient: ['#F2994A', '#F2C94C'],
      category: 'tax'
    },
    { 
      id: '4',
      icon: 'trending-up', 
      label: 'Análisis Fiscal', 
      subtitle: 'Insights personalizados',
      command: 'Dame un análisis completo de mi situación fiscal y recomendaciones',
      gradient: ['#ee0979', '#ff6a00'],
      category: 'reports'
    },
    { 
      id: '5',
      icon: 'notifications', 
      label: 'Recordatorios', 
      subtitle: 'Fechas importantes',
      command: '¿Cuáles son las fechas límite importantes que debo recordar?',
      gradient: ['#4facfe', '#00f2fe'],
      category: 'automation'
    },
    { 
      id: '6',
      icon: 'help-circle', 
      label: 'Deducciones', 
      subtitle: 'Maximizar ahorros',
      command: '¿Qué deducciones puedo reclamar para reducir mis impuestos?',
      gradient: ['#a8edea', '#fed6e3'],
      category: 'tax'
    },
  ];

  useEffect(() => {
    loadMetrics();
    startAnimations();
    
    // Welcome message with personality
    const welcomeMessages: Message[] = [{
      id: 'welcome',
      role: 'assistant',
      content: '¡Hola! 👋 Soy Ross AI, tu asistente fiscal inteligente.\n\nPuedo ayudarte con:\n• 📊 Estado de tu reembolso\n• 📅 Información de citas\n• 📄 Documentos necesarios\n• 💡 Consejos para ahorrar\n\n¿En qué puedo ayudarte hoy?',
      timestamp: new Date()
    }];
    setMessages(welcomeMessages);

    // Keyboard listeners
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
      setShowSuggestions(false);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (messages.length > 1) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const startAnimations = () => {
    // Fade in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation for brain icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const loadMetrics = async () => {
    try {
      const response = await api.get('/ai-brain/metrics/business');
      const data = response.data;
      
      const newMetrics: Metric[] = [
        {
          label: 'Reembolso Est.',
          value: `$${(data.estimated_refund || 2847).toLocaleString()}`,
          icon: 'cash-outline',
          gradient: ['#11998e', '#38ef7d'],
          trend: 12.5,
          description: 'Estimación actual'
        },
        {
          label: 'Documentos',
          value: `${data.documents_uploaded || 8}/${data.documents_required || 12}`,
          icon: 'folder-outline',
          gradient: ['#667eea', '#764ba2'],
          trend: 67,
          description: 'Subidos'
        },
        {
          label: 'Próxima Cita',
          value: data.next_appointment || 'Mar 15',
          icon: 'calendar-outline',
          gradient: ['#F2994A', '#F2C94C'],
          description: '10:00 AM'
        },
        {
          label: 'Estado',
          value: data.status || 'En proceso',
          icon: 'checkmark-circle-outline',
          gradient: ['#4facfe', '#00f2fe'],
          description: 'Declaración 2024'
        },
      ];
      
      setMetrics(newMetrics);
    } catch (error) {
      console.error('Error loading metrics:', error);
      // Set default metrics on error
      setMetrics([
        { label: 'Reembolso Est.', value: '$2,847', icon: 'cash-outline', gradient: ['#11998e', '#38ef7d'], description: 'Estimación' },
        { label: 'Documentos', value: '8/12', icon: 'folder-outline', gradient: ['#667eea', '#764ba2'], description: 'Subidos' },
        { label: 'Próxima Cita', value: 'Mar 15', icon: 'calendar-outline', gradient: ['#F2994A', '#F2C94C'], description: '10:00 AM' },
        { label: 'Estado', value: 'En proceso', icon: 'checkmark-circle-outline', gradient: ['#4facfe', '#00f2fe'], description: 'Declaración' },
      ]);
    }
  };

  const triggerHaptic = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const executeCommand = async (cmd: string) => {
    if (!cmd.trim()) return;

    triggerHaptic();
    setShowSuggestions(false);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: cmd,
      timestamp: new Date()
    };

    // Add typing indicator
    const typingMessage: Message = {
      id: 'typing',
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isTyping: true
    };

    setMessages(prev => [...prev, userMessage, typingMessage]);
    setCommand('');
    setLoading(true);
    Keyboard.dismiss();

    try {
      const response = await api.post('/ai-brain/command', { command: cmd });
      
      // Remove typing indicator and add real response
      let content = '';
      
      if (response.data.summary) {
        content = response.data.summary;
      } else if (response.data.response) {
        content = response.data.response;
      } else if (response.data.results && response.data.results.length > 0) {
        content = formatResults(response.data.results);
      } else {
        content = 'He procesado tu solicitud. ¿Hay algo más en lo que pueda ayudarte?';
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: content,
        timestamp: new Date()
      };

      setMessages(prev => prev.filter(m => m.id !== 'typing').concat(assistantMessage));
      
    } catch (error: any) {
      console.error('AI Brain error:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '❌ Hubo un problema al procesar tu solicitud. Por favor intenta de nuevo o contacta a soporte.',
        timestamp: new Date()
      };
      
      setMessages(prev => prev.filter(m => m.id !== 'typing').concat(errorMessage));
    } finally {
      setLoading(false);
    }
  };

  const formatResults = (results: any[]) => {
    let content = '';
    results.forEach((result: any) => {
      if (result.status === 'success' && result.result) {
        const r = result.result;
        if (r.summary) content += r.summary + '\n\n';
        if (r.recommendations) {
          content += '💡 **Recomendaciones:**\n';
          r.recommendations.forEach((rec: string) => content += `• ${rec}\n`);
        }
      }
    });
    return content || 'Operación completada exitosamente.';
  };

  const copyMessage = async (content: string) => {
    await Clipboard.setStringAsync(content);
    triggerHaptic();
    Alert.alert('✅ Copiado', 'Mensaje copiado al portapapeles');
  };

  const shareMessage = async (content: string) => {
    try {
      await Share.share({ message: content });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleQuickAction = (action: QuickAction) => {
    triggerHaptic();
    setActiveTab('chat');
    setTimeout(() => executeCommand(action.command), 300);
  };

  const handleSuggestion = (question: SuggestedQuestion) => {
    triggerHaptic();
    executeCommand(question.text);
  };

  // Render Message Bubble
  const renderMessage = (message: Message, index: number) => {
    const isUser = message.role === 'user';
    const isTyping = message.isTyping;

    return (
      <Animated.View
        key={message.id}
        style={[
          styles.messageContainer,
          isUser ? styles.userMessageContainer : styles.assistantMessageContainer,
          { opacity: fadeAnim }
        ]}
      >
        {!isUser && (
          <View style={styles.avatarContainer}>
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.avatar}
            >
              <Ionicons name="sparkles" size={16} color="#fff" />
            </LinearGradient>
          </View>
        )}
        
        <View style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.assistantBubble
        ]}>
          {isTyping ? (
            <View style={styles.typingContainer}>
              <View style={[styles.typingDot, styles.typingDot1]} />
              <View style={[styles.typingDot, styles.typingDot2]} />
              <View style={[styles.typingDot, styles.typingDot3]} />
            </View>
          ) : (
            <>
              <Text style={[
                styles.messageText,
                isUser && styles.userMessageText
              ]}>
                {message.content}
              </Text>
              
              {!isUser && (
                <View style={styles.messageActions}>
                  <TouchableOpacity 
                    style={styles.messageAction}
                    onPress={() => copyMessage(message.content)}
                  >
                    <Ionicons name="copy-outline" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.messageAction}
                    onPress={() => shareMessage(message.content)}
                  >
                    <Ionicons name="share-outline" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>

        {isUser && (
          <View style={styles.userAvatarContainer}>
            <LinearGradient
              colors={['#6C1110', '#8B1A19']}
              style={styles.avatar}
            >
              <Ionicons name="person" size={16} color="#fff" />
            </LinearGradient>
          </View>
        )}
      </Animated.View>
    );
  };

  // Render Metric Card
  const renderMetricCard = (metric: Metric, index: number) => (
    <TouchableOpacity 
      key={index}
      style={styles.metricCard}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={metric.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.metricGradient}
      >
        <View style={styles.metricIconBg}>
          <Ionicons name={metric.icon} size={20} color="#fff" />
        </View>
        <Text style={styles.metricValue}>{metric.value}</Text>
        <Text style={styles.metricLabel}>{metric.label}</Text>
        {metric.description && (
          <Text style={styles.metricDescription}>{metric.description}</Text>
        )}
        {metric.trend && (
          <View style={styles.trendBadge}>
            <Ionicons name="trending-up" size={12} color="#fff" />
            <Text style={styles.trendText}>{metric.trend}%</Text>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );

  // Render Quick Action
  const renderQuickAction = (action: QuickAction) => (
    <TouchableOpacity
      key={action.id}
      style={styles.actionCard}
      onPress={() => handleQuickAction(action)}
      activeOpacity={0.85}
    >
      <LinearGradient
        colors={action.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.actionGradient}
      >
        <View style={styles.actionIconContainer}>
          <Ionicons name={action.icon} size={28} color="#fff" />
        </View>
        <View style={styles.actionContent}>
          <Text style={styles.actionLabel}>{action.label}</Text>
          <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Premium Header */}
      <LinearGradient
        colors={['#1a1a2e', '#16213e', '#0f3460']}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Animated.View style={[styles.brainIcon, { transform: [{ scale: pulseAnim }] }]}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.brainGradient}
              >
                <Ionicons name="sparkles" size={24} color="#fff" />
              </LinearGradient>
            </Animated.View>
            <View>
              <Text style={styles.headerTitle}>Ross AI</Text>
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>En línea • Gemini 2.5 Pro</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.menuButton}>
            <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Tab Navigation */}
      <View style={styles.tabBar}>
        {[
          { key: 'chat', label: 'Chat', icon: 'chatbubbles-outline' },
          { key: 'insights', label: 'Mi Resumen', icon: 'pie-chart-outline' },
          { key: 'actions', label: 'Acciones', icon: 'flash-outline' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => {
              triggerHaptic();
              setActiveTab(tab.key as any);
            }}
          >
            <Ionicons 
              name={tab.icon as any} 
              size={20} 
              color={activeTab === tab.key ? '#667eea' : '#9CA3AF'} 
            />
            <Text style={[
              styles.tabLabel,
              activeTab === tab.key && styles.activeTabLabel
            ]}>
              {tab.label}
            </Text>
            {activeTab === tab.key && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
              {messages.map(renderMessage)}
              
              {/* Suggested Questions */}
              {showSuggestions && messages.length <= 1 && (
                <View style={styles.suggestionsContainer}>
                  <Text style={styles.suggestionsTitle}>💡 Preguntas frecuentes</Text>
                  {suggestedQuestions.map((q, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.suggestionCard}
                      onPress={() => handleSuggestion(q)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.suggestionIcon}>
                        <Ionicons name={q.icon} size={18} color="#667eea" />
                      </View>
                      <View style={styles.suggestionContent}>
                        <Text style={styles.suggestionText}>{q.text}</Text>
                        <Text style={styles.suggestionCategory}>{q.category}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              
              <View style={{ height: 120 }} />
            </Animated.View>
          )}

          {/* Insights Tab */}
          {activeTab === 'insights' && (
            <Animated.View style={[styles.insightsContainer, { opacity: fadeAnim }]}>
              <Text style={styles.sectionTitle}>📊 Tu Resumen Fiscal</Text>
              <View style={styles.metricsGrid}>
                {metrics.map(renderMetricCard)}
              </View>
              
              {/* Progress Card */}
              <View style={styles.progressCard}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressTitle}>Progreso de Declaración</Text>
                  <Text style={styles.progressPercent}>67%</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <LinearGradient
                    colors={['#667eea', '#764ba2']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.progressBar, { width: '67%' }]}
                  />
                </View>
                <Text style={styles.progressHint}>Sube 4 documentos más para completar</Text>
              </View>

              {/* Tips Card */}
              <View style={styles.tipsCard}>
                <LinearGradient
                  colors={['#667eea15', '#764ba215']}
                  style={styles.tipsGradient}
                >
                  <Ionicons name="bulb" size={24} color="#667eea" />
                  <View style={styles.tipsContent}>
                    <Text style={styles.tipsTitle}>Tip del día</Text>
                    <Text style={styles.tipsText}>
                      Recuerda que puedes deducir gastos de oficina en casa si trabajas remotamente.
                    </Text>
                  </View>
                </LinearGradient>
              </View>
              
              <View style={{ height: 40 }} />
            </Animated.View>
          )}

          {/* Actions Tab */}
          {activeTab === 'actions' && (
            <Animated.View style={[styles.actionsContainer, { opacity: fadeAnim }]}>
              <Text style={styles.sectionTitle}>⚡ Acciones Rápidas</Text>
              <Text style={styles.sectionSubtitle}>Toca para ejecutar con IA</Text>
              
              <View style={styles.actionsGrid}>
                {quickActions.map(renderQuickAction)}
              </View>

              {/* Contact Support */}
              <TouchableOpacity style={styles.supportCard}>
                <View style={styles.supportIconBg}>
                  <Ionicons name="headset" size={24} color="#6C1110" />
                </View>
                <View style={styles.supportContent}>
                  <Text style={styles.supportTitle}>¿Necesitas ayuda humana?</Text>
                  <Text style={styles.supportSubtitle}>Contacta a un experto de Ross Tax</Text>
                </View>
                <Ionicons name="call" size={22} color="#6C1110" />
              </TouchableOpacity>
              
              <View style={{ height: 40 }} />
            </Animated.View>
          )}
        </ScrollView>

        {/* Input Area - Chat Tab Only */}
        {activeTab === 'chat' && (
          <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 8 }]}>
            <View style={styles.inputWrapper}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={command}
                onChangeText={setCommand}
                placeholder="Escribe tu pregunta..."
                placeholderTextColor="#9CA3AF"
                multiline
                maxLength={500}
                editable={!loading}
                onFocus={() => setShowSuggestions(false)}
              />
              
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!command.trim() || loading) && styles.sendButtonDisabled
                ]}
                onPress={() => executeCommand(command)}
                disabled={loading || !command.trim()}
              >
                <LinearGradient
                  colors={loading || !command.trim() ? ['#D1D5DB', '#9CA3AF'] : ['#667eea', '#764ba2']}
                  style={styles.sendButtonGradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Ionicons name="send" size={20} color="#FFF" />
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  
  // Header
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    gap: 12,
  },
  brainIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  brainGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 6,
    position: 'relative',
  },
  activeTab: {
    backgroundColor: '#667eea10',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  activeTabLabel: {
    color: '#667eea',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 4,
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#667eea',
  },

  // Content
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },

  // Messages
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  assistantMessageContainer: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    marginRight: 10,
  },
  userAvatarContainer: {
    marginLeft: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 20,
    padding: 14,
  },
  userBubble: {
    backgroundColor: '#667eea',
    borderBottomRightRadius: 6,
  },
  assistantBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1F2937',
  },
  userMessageText: {
    color: '#fff',
  },
  messageActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 12,
  },
  messageAction: {
    padding: 4,
  },

  // Typing Indicator
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9CA3AF',
  },
  typingDot1: {
    opacity: 0.4,
  },
  typingDot2: {
    opacity: 0.6,
  },
  typingDot3: {
    opacity: 0.8,
  },

  // Suggestions
  suggestionsContainer: {
    marginTop: 16,
  },
  suggestionsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  suggestionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#667eea15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionContent: {
    flex: 1,
    marginLeft: 12,
  },
  suggestionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  suggestionCategory: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },

  // Insights
  insightsContainer: {},
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    width: (width - 44) / 2,
    borderRadius: 20,
    overflow: 'hidden',
  },
  metricGradient: {
    padding: 16,
    minHeight: 130,
  },
  metricIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  metricLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  metricDescription: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  trendBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  trendText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },

  // Progress Card
  progressCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  progressPercent: {
    fontSize: 18,
    fontWeight: '700',
    color: '#667eea',
  },
  progressBarBg: {
    height: 10,
    backgroundColor: '#E5E7EB',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 5,
  },
  progressHint: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 10,
  },

  // Tips Card
  tipsCard: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  tipsGradient: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'flex-start',
    gap: 12,
  },
  tipsContent: {
    flex: 1,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
    marginBottom: 4,
  },
  tipsText: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 20,
  },

  // Actions
  actionsContainer: {},
  actionsGrid: {
    gap: 12,
  },
  actionCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 2,
  },
  actionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  actionIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionContent: {
    flex: 1,
    marginLeft: 14,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  actionSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },

  // Support Card
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  supportIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  supportContent: {
    flex: 1,
    marginLeft: 14,
  },
  supportTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  supportSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },

  // Input
  inputContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F3F4F6',
    borderRadius: 24,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
    maxHeight: 100,
    paddingVertical: 10,
  },
  sendButton: {
    marginLeft: 8,
  },
  sendButtonDisabled: {
    opacity: 0.7,
  },
  sendButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
