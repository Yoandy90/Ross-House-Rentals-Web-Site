import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  Platform,
  ScrollView,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ImageItem {
  uri: string;
  caption?: string;
}

interface Props {
  images: ImageItem[];
  visible: boolean;
  initialIndex?: number;
  onClose: () => void;
}

// ─── Each image in its own zoomable ScrollView ───
// Using ScrollView's native pinch-to-zoom (maximumZoomScale) lets the parent
// horizontal FlatList still handle page swipes. This is the pattern used by
// Instagram, WhatsApp, etc.
const ZoomableImage = React.memo(function ZoomableImage({ uri, onLoadStart, onLoad }: {
  uri: string;
  onLoadStart: () => void;
  onLoad: () => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const lastTap = useRef<number>(0);

  // Double-tap to zoom in / out
  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      // Toggle zoom
      const sv = scrollRef.current as any;
      if (!sv) return;
      // Approximate: zoom in to 2.5x centered, or reset
      if (sv._zoomedIn) {
        sv.scrollResponderZoomTo({ x: 0, y: 0, width: SCREEN_WIDTH, height: SCREEN_HEIGHT, animated: true });
        sv._zoomedIn = false;
      } else {
        sv.scrollResponderZoomTo({
          x: SCREEN_WIDTH / 4,
          y: SCREEN_HEIGHT / 4,
          width: SCREEN_WIDTH / 2,
          height: SCREEN_HEIGHT / 2,
          animated: true,
        });
        sv._zoomedIn = true;
      }
    }
    lastTap.current = now;
  }, []);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.pageWrap}
      contentContainerStyle={styles.scrollContent}
      maximumZoomScale={4}
      minimumZoomScale={1}
      bouncesZoom
      pinchGestureEnabled
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      centerContent
    >
      <TouchableOpacity activeOpacity={1} onPress={handleTap} style={styles.scrollContent}>
        <Image
          source={{ uri }}
          style={styles.image}
          resizeMode="contain"
          onLoadStart={onLoadStart}
          onLoad={onLoad}
        />
      </TouchableOpacity>
    </ScrollView>
  );
});

export default function FullscreenImageViewer({ images, visible, initialIndex = 0, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [loadingStates, setLoadingStates] = useState<Record<number, boolean>>({});
  const flatListRef = useRef<FlatList>(null);

  const onScroll = useCallback((event: any) => {
    const offset = event.nativeEvent.contentOffset.x;
    const idx = Math.round(offset / SCREEN_WIDTH);
    setCurrentIndex(idx);
  }, []);

  const handleImageLoad = (index: number) => {
    setLoadingStates(prev => ({ ...prev, [index]: false }));
  };

  const handleImageLoadStart = (index: number) => {
    setLoadingStates(prev => ({ ...prev, [index]: true }));
  };

  if (!visible || images.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="black" />
      <View style={styles.container}>
        {/* Close button */}
        <TouchableOpacity
          onPress={onClose}
          style={[styles.closeBtn, { top: insets.top + 10 }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View style={styles.closeBtnInner}>
            <Ionicons name="close" size={24} color="#fff" />
          </View>
        </TouchableOpacity>

        {/* Counter + zoom hint */}
        <View style={[styles.counter, { top: insets.top + 16 }]}>
          <Text style={styles.counterText}>
            {currentIndex + 1} / {images.length}
          </Text>
        </View>

        {/* Image carousel with zoom support */}
        <FlatList
          ref={flatListRef}
          data={images}
          keyExtractor={(_, i) => `fullscreen-${i}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          decelerationRate="fast"
          snapToInterval={SCREEN_WIDTH}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, i) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * i,
            index: i,
          })}
          onMomentumScrollEnd={onScroll}
          renderItem={({ item, index }) => (
            <View style={styles.pageWrap}>
              {loadingStates[index] && (
                <ActivityIndicator
                  size="large"
                  color="rgba(255,255,255,0.5)"
                  style={styles.loader}
                />
              )}
              <ZoomableImage
                uri={item.uri}
                onLoadStart={() => handleImageLoadStart(index)}
                onLoad={() => handleImageLoad(index)}
              />
            </View>
          )}
        />

        {/* Caption footer */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          {images[currentIndex]?.caption ? (
            <Text style={styles.caption}>{images[currentIndex].caption}</Text>
          ) : null}
          <Text style={styles.zoomHint}>
            <Ionicons name="expand-outline" size={11} color="rgba(255,255,255,0.5)" />
            {'  '}Pellizca o doble toque para hacer zoom
          </Text>
          {/* Navigation dots */}
          {images.length > 1 && images.length <= 12 && (
            <View style={styles.dotsRow}>
              {images.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i === currentIndex ? styles.dotActive : styles.dotInactive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.97)',
    justifyContent: 'center',
  },
  closeBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 20,
  },
  closeBtnInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  counter: {
    position: 'absolute',
    right: 16,
    zIndex: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  counterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageWrap: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  scrollContent: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomHint: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 6,
  },
  loader: {
    position: 'absolute',
    zIndex: 1,
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  caption: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 18,
  },
  dotInactive: {
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
});
