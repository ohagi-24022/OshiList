import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { GoodsProvider } from '../src/store/GoodsContext';
import { AppSettingsProvider } from '../src/store/AppSettingsContext';
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
          fullScreenGestureEnabled: false,
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
          <AppSettingsProvider>
            <GoodsProvider>
              <RootStack />
            </GoodsProvider>
          </AppSettingsProvider>
        </RegistrationPresetProvider>
      </ProfileProvider>
    </ThemeProvider>
  );
}
