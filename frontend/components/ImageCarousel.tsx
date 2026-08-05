import React, { useState } from 'react';
import {
  Modal,
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Text,
  StatusBar,
  Platform,
  SafeAreaView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ImageCarouselProps {
  images: { uri: string }[];
  visible: boolean;
  initialIndex?: number;
  onClose: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ImageCarousel({
  images,
  visible,
  initialIndex = 0,
  onClose,
}: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / SCREEN_WIDTH);
    setCurrentIndex(index);
  };

  React.useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
    }
  }, [visible, initialIndex]);

  if (!visible || images.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Top Bar with Close Button */}
          <View style={styles.topBar}>
            {/* Image Counter */}
            <View style={styles.counterContainer}>
              <Text style={styles.counterText}>
                {currentIndex + 1} / {images.length}
              </Text>
            </View>
            
            {/* Close Button - More accessible */}
            <Pressable 
              style={styles.closeButton} 
              onPress={onClose}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            >
              <View style={styles.closeButtonInner}>
                <Ionicons name="close" size={28} color="#FFF" />
              </View>
            </Pressable>
          </View>

          {/* Images ScrollView */}
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            contentOffset={{ x: initialIndex * SCREEN_WIDTH, y: 0 }}
            style={styles.scrollView}
          >
            {images.map((image, index) => (
              <TouchableOpacity 
                key={index} 
                style={styles.imageContainer}
                activeOpacity={1}
                onPress={onClose}
              >
                <Image
                  source={{ uri: image.uri }}
                  style={styles.image}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Navigation Dots */}
          {images.length > 1 && (
            <View style={styles.dotsContainer}>
              {images.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    currentIndex === index && styles.activeDot,
                  ]}
                />
              ))}
            </View>
          )}

          {/* Bottom Close Button for easier access */}
          <Pressable 
            style={styles.bottomCloseButton}
            onPress={onClose}
          >
            <View style={styles.bottomCloseInner}>
              <Ionicons name="close-circle" size={24} color="#FFF" />
              <Text style={styles.bottomCloseText}>Cerrar</Text>
            </View>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 10 : 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 100,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  counterContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  counterText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  activeDot: {
    backgroundColor: '#FFF',
    width: 24,
  },
  bottomCloseButton: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    zIndex: 100,
  },
  bottomCloseInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  bottomCloseText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
