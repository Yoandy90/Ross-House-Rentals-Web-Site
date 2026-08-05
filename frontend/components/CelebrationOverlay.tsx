import React, { useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Modal } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';

const { width, height } = Dimensions.get('window');

export interface CelebrationRef {
  celebrate: (amount?: string, message?: string) => void;
}

interface CelebrationProps {
  onComplete?: () => void;
}

const CelebrationOverlay = forwardRef<CelebrationRef, CelebrationProps>(({ onComplete }, ref) => {
  const [visible, setVisible] = useState(false);
  const [displayAmount, setDisplayAmount] = useState('');
  const [displayMessage, setDisplayMessage] = useState('');
  const confettiRef = useRef<any>(null);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useImperativeHandle(ref, () => ({
    celebrate: (amount?: string, message?: string) => {
      setDisplayAmount(amount || '');
      setDisplayMessage(message || '¡Felicidades!');
      setVisible(true);

      // Animate text
      Animated.sequence([
        Animated.parallel([
          Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 5, useNativeDriver: true }),
          Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]),
        Animated.delay(2500),
        Animated.parallel([
          Animated.timing(scaleAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.timing(opacityAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
      ]).start(() => {
        setVisible(false);
        scaleAnim.setValue(0);
        opacityAnim.setValue(0);
        onComplete?.();
      });

      // Fire confetti
      setTimeout(() => confettiRef.current?.start(), 100);
    },
  }));

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none">
      <View style={s.overlay}>
        <ConfettiCannon
          ref={confettiRef}
          count={80}
          origin={{ x: width / 2, y: -10 }}
          fadeOut
          autoStart={false}
          explosionSpeed={350}
          fallSpeed={2500}
          colors={['#059669', '#10B981', '#34D399', '#6EE7B7', '#FCD34D', '#F59E0B', '#EC4899', '#8B5CF6']}
        />
        <Animated.View
          style={[
            s.celebrationCard,
            { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          <Text style={s.emoji}>🎉</Text>
          <Text style={s.message}>{displayMessage}</Text>
          {displayAmount ? <Text style={s.amount}>{displayAmount}</Text> : null}
        </Animated.View>
      </View>
    </Modal>
  );
});

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  celebrationCard: {
    backgroundColor: '#FFF',
    borderRadius: 28,
    paddingHorizontal: 40,
    paddingVertical: 36,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  emoji: { fontSize: 56, marginBottom: 12 },
  message: { fontSize: 22, fontWeight: '800', color: '#1F2937', textAlign: 'center', marginBottom: 8 },
  amount: { fontSize: 40, fontWeight: '900', color: '#059669', letterSpacing: -1 },
});

CelebrationOverlay.displayName = 'CelebrationOverlay';
export default CelebrationOverlay;
