import { Stack, router } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/theme';

export default function ProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: Colors.bg },
        headerTintColor: Colors.primaryLight,
        headerTitleStyle: { fontWeight: '700', fontSize: 17, color: Colors.text },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: Colors.bg },
        animation: 'slide_from_right',
        headerLeft: () => (
          <TouchableOpacity 
            onPress={() => router.back()} 
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginRight: 16, padding: 4 }}
          >
            <Ionicons name="chevron-back" size={28} color={Colors.primaryLight} />
          </TouchableOpacity>
        ),
      }}
    />
  );
}
