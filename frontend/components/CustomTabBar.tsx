import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 70 + insets.bottom;

  return (
    <View style={[styles.container, { height: tabBarHeight }]}>
      {/* SVG Shape con curva */}
      <Svg
        width="100%"
        height={tabBarHeight}
        style={styles.svgContainer}
      >
        <Path
          d={`
            M 0,20
            Q 0,0 20,0
            L ${(state.routes.length === 5) ? '35%' : '40%'},0
            Q ${(state.routes.length === 5) ? '38%' : '43%'},0 ${(state.routes.length === 5) ? '40%' : '45%'},10
            Q ${(state.routes.length === 5) ? '42%' : '47%'},25 50,25
            Q ${(state.routes.length === 5) ? '58%' : '53%'},25 ${(state.routes.length === 5) ? '60%' : '55%'},10
            Q ${(state.routes.length === 5) ? '62%' : '57%'},0 ${(state.routes.length === 5) ? '65%' : '60%'},0
            L calc(100% - 20),0
            Q 100%,0 100%,20
            L 100%,100%
            L 0,100%
            Z
          `}
          fill="#FFFFFF"
        />
      </Svg>

      {/* Shadow overlay */}
      <View style={styles.shadowOverlay} />

      {/* Tabs */}
      <View style={[styles.tabsContainer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 8 }]}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;

          const isFocused = state.index === index;
          const isCenterButton = route.name === 'quick-actions';

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          // Renderizar botón central especial
          if (isCenterButton) {
            return (
              <View key={route.key} style={styles.centerButtonContainer}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={isFocused ? { selected: true } : {}}
                  onPress={onPress}
                  style={styles.centerButton}
                  activeOpacity={0.8}
                >
                  <View style={styles.centerButtonInner}>
                    <Ionicons name="add" size={32} color="#FFF" />
                  </View>
                </TouchableOpacity>
              </View>
            );
          }

          // Renderizar tabs normales
          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={onPress}
              style={styles.tab}
              activeOpacity={0.7}
            >
              <View style={styles.tabContent}>
                {options.tabBarIcon && options.tabBarIcon({
                  focused: isFocused,
                  color: isFocused ? '#6C1110' : '#999999',
                  size: 24,
                })}
                {typeof label === 'string' && (
                  <Text style={[
                    styles.labelText,
                    { color: isFocused ? '#6C1110' : '#999999' }
                  ]}>
                    {label}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 999,
  },
  svgContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  shadowOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '100%',
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingTop: 10,
    paddingHorizontal: 10,
  },
  tab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  centerButtonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -35,
  },
  centerButton: {
    width: 70,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerButtonInner: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: '#6C1110',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 15,
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
});
