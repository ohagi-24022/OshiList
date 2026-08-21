import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

type AppSettings = {
  exchangeEnabled: boolean;
  groupRandomGoods: boolean;
  homeCards: string[];
  utilityTabs: string[];
};

type AppSettingsContextValue = {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
};

const STORAGE_KEY = 'oshilist.appSettings.v1';

const defaultSettings: AppSettings = {
  exchangeEnabled: false,
  groupRandomGoods: false,
  homeCards: ['oshi', 'lineup', 'unorganized', 'quickActions', 'exchange', 'schedule', 'favorites', 'oshiGoods', 'recent'],
  utilityTabs: ['schedule', 'mypage'],
};
const allowedUtilityTabs = new Set(['schedule', 'mypage', 'event', 'random']);
const allowedHomeCards = new Set(defaultSettings.homeCards);

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

function readStoredSettings(stored: string): AppSettings {
  try {
    const parsed = JSON.parse(stored) as Partial<AppSettings>;
    const utilityTabs = Array.isArray(parsed.utilityTabs)
      ? parsed.utilityTabs.filter((tab) => allowedUtilityTabs.has(tab)).slice(0, 2)
      : [];
    const homeCards = Array.isArray(parsed.homeCards)
      ? parsed.homeCards.filter((card) => allowedHomeCards.has(card))
      : [];
    return {
      ...defaultSettings,
      ...parsed,
      homeCards: homeCards.length ? homeCards : defaultSettings.homeCards,
      utilityTabs: utilityTabs.length === 2 ? utilityTabs : defaultSettings.utilityTabs,
    };
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
    const utilityTabs = patch.utilityTabs
      ? patch.utilityTabs.filter((tab) => allowedUtilityTabs.has(tab)).slice(0, 2)
      : settings.utilityTabs;
    const homeCards = patch.homeCards
      ? patch.homeCards.filter((card) => allowedHomeCards.has(card))
      : settings.homeCards;
    const nextSettings = {
      ...settings,
      ...patch,
      homeCards: homeCards.length ? homeCards : settings.homeCards,
      utilityTabs: utilityTabs.length === 2 ? utilityTabs : settings.utilityTabs,
    };
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
