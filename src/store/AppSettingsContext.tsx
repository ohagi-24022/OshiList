import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

type AppSettings = {
  exchangeEnabled: boolean;
  groupRandomGoods: boolean;
};

type AppSettingsContextValue = {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
};

const STORAGE_KEY = 'oshilist.appSettings.v1';

const defaultSettings: AppSettings = {
  exchangeEnabled: false,
  groupRandomGoods: false,
};

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

function readStoredSettings(stored: string): AppSettings {
  try {
    const parsed = JSON.parse(stored) as Partial<AppSettings>;
    return { ...defaultSettings, ...parsed };
  } catch {
    return defaultSettings;
  }
}

export function AppSettingsProvider({ children }: PropsWithChildren) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored) {
        setSettings(readStoredSettings(stored));
      }
    });
  }, []);

  const updateSettings = async (patch: Partial<AppSettings>) => {
    const nextSettings = { ...settings, ...patch };
    setSettings(nextSettings);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextSettings));
  };

  const value = useMemo(() => ({ settings, updateSettings }), [settings]);

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);
  if (!context) {
    throw new Error('useAppSettings must be used inside AppSettingsProvider');
  }
  return context;
}
