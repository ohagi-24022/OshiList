import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { GoodsProvider } from '../src/store/GoodsContext';
import { ProfileProvider } from '../src/store/ProfileContext';
import { RegistrationPresetProvider } from '../src/store/RegistrationPresetContext';
import { ThemeProvider, useAppTheme } from '../src/store/ThemeContext';

function RootStack() {
  const { colors } = useAppTheme();

  return (
    <>
      <StatusBar style={colors.background === '#050505' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: colors.background },
          fullScreenGestureEnabled: true,
          gestureEnabled: true,
          headerShown: false,
        }}
      />
    </>
  );
}

export default function Layout() {
  return (
    <ThemeProvider>
      <ProfileProvider>
        <RegistrationPresetProvider>
          <GoodsProvider>
            <RootStack />
          </GoodsProvider>
        </RegistrationPresetProvider>
      </ProfileProvider>
    </ThemeProvider>
  );
}
