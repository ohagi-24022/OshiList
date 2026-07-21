import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { GoodsProvider } from '../src/store/GoodsContext';
import { ThemeProvider, useAppTheme } from '../src/store/ThemeContext';

function RootStack() {
  const { colors } = useAppTheme();

  return (
    <>
      <StatusBar style={colors.background === '#050505' ? 'light' : 'dark'} />
      <Stack screenOptions={{ contentStyle: { backgroundColor: colors.background }, headerShown: false }} />
    </>
  );
}

export default function Layout() {
  return (
    <ThemeProvider>
      <GoodsProvider>
        <RootStack />
      </GoodsProvider>
    </ThemeProvider>
  );
}
