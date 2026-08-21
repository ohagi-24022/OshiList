import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';

import { useAppSettings } from '../../src/store/AppSettingsContext';
import { useAppTheme } from '../../src/store/ThemeContext';

export default function TabsLayout() {
  const { colors } = useAppTheme();
  const { settings } = useAppSettings();
  const visibleTabs = new Set(settings.utilityTabs);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 66,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'ホーム',
          tabBarIcon: ({ color, size }) => <Ionicons color={color} name="home-outline" size={size} />,
        }}
      />
      <Tabs.Screen
        name="collection"
        options={{
          title: 'コレクション',
          tabBarIcon: ({ color, size }) => <Ionicons color={color} name="albums-outline" size={size} />,
        }}
      />
      <Tabs.Screen
        name="manage"
        options={{
          href: visibleTabs.has('manage') ? undefined : null,
          title: '管理',
          tabBarIcon: ({ color, size }) => <Ionicons color={color} name="create-outline" size={size} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          href: visibleTabs.has('schedule') ? undefined : null,
          title: '予定',
          tabBarIcon: ({ color, size }) => <Ionicons color={color} name="calendar-outline" size={size} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          href: visibleTabs.has('calendar') ? undefined : null,
          title: 'カレンダー',
          tabBarIcon: ({ color, size }) => <Ionicons color={color} name="calendar-number-outline" size={size} />,
        }}
      />
      <Tabs.Screen
        name="event"
        options={{
          href: visibleTabs.has('event') ? undefined : null,
          title: 'イベント',
          tabBarIcon: ({ color, size }) => <Ionicons color={color} name="sparkles-outline" size={size} />,
        }}
      />
      <Tabs.Screen
        name="random"
        options={{
          href: visibleTabs.has('random') ? undefined : null,
          title: '開封',
          tabBarIcon: ({ color, size }) => <Ionicons color={color} name="cube-outline" size={size} />,
        }}
      />
      <Tabs.Screen
        name="mypage-tab"
        options={{
          href: visibleTabs.has('mypage') ? undefined : null,
          title: 'マイページ',
          tabBarIcon: ({ color, size }) => <Ionicons color={color} name="person-circle-outline" size={size} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: '登録',
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
