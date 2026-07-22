import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';

import { useAppTheme } from '../../src/store/ThemeContext';

export default function TabsLayout() {
  const { colors } = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'ホーム',
          tabBarIcon: ({ color, size }) => <Ionicons color={color} name="albums-outline" size={size} />,
        }}
      />
      <Tabs.Screen
        name="manage"
        options={{
          title: '管理',
          tabBarIcon: ({ color, size }) => <Ionicons color={color} name="create-outline" size={size} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'スキャン',
          tabBarIcon: ({ color, size }) => <Ionicons color={color} name="barcode-outline" size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '設定',
          tabBarIcon: ({ color, size }) => <Ionicons color={color} name="color-palette-outline" size={size} />,
        }}
      />
    </Tabs>
  );
}
