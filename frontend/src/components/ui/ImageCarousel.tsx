import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Image,
  FlatList,
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  Text,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ViewToken,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, BorderRadius, FontSizes } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ImageCarouselProps {
  images: string[];
  height?: number;
  showCounter?: boolean;
  onPress?: (index: number) => void;
  borderRadius?: number;
}

export function ImageCarousel({
  images,
  height = 260,
  showCounter = true,
  onPress,
  borderRadius = 0,
}: ImageCarouselProps) {
  const Colors = useColors();
  const styles = React.useMemo(() => create_styles(Colors), [Colors]);
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setActiveIndex(viewableItems[0].index);
    }
  }, []);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  if (!images || images.length === 0) {
    return (
      <View style={[styles.placeholder, { height, borderRadius }]}>
        <Ionicons name="home-outline" size={48} color={Colors.textMuted} />
        <Text style={styles.placeholderText}>Sin fotos</Text>
      </View>
    );
  }

  const renderItem = ({ item, index }: { item: string; index: number }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onPress?.(index)}
      style={{ width: SCREEN_WIDTH }}
    >
      <Image
        source={{ uri: item }}
        style={[styles.image, { height, borderRadius }]}
        resizeMode="cover"
      />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { height }]}>
      <FlatList
        ref={flatListRef}
        data={images}
        renderItem={renderItem}
        keyExtractor={(_, index) => `carousel-${index}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        bounces={false}
        decelerationRate="fast"
        snapToInterval={SCREEN_WIDTH}
        snapToAlignment="start"
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* Dot indicators */}
      {images.length > 1 && (
        <View style={styles.dotsContainer}>
          {images.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === activeIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>
      )}

      {/* Photo counter badge */}
      {showCounter && images.length > 1 && (
        <View style={styles.counterBadge}>
          <Ionicons name="images-outline" size={12} color={Colors.white} />
          <Text style={styles.counterText}>
            {activeIndex + 1}/{images.length}
          </Text>
        </View>
      )}
    </View>
  );
}

const create_styles = (Colors: any) => StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
  },
  image: {
    width: SCREEN_WIDTH,
  },
  placeholder: {
    width: '100%',
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  placeholderText: {
    fontSize: FontSizes.sm,
    color: Colors.textMuted,
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: Colors.brandRed,
    width: 20,
  },
  dotInactive: {
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  counterBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  counterText: {
    fontSize: FontSizes.xs,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
});
