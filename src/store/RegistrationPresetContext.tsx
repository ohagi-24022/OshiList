import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

export type RegistrationPreset = {
  id: string;
  name: string;
  seriesName: string;
  characterName: string;
  variantName: string;
};

type RegistrationPresetContextValue = {
  presets: RegistrationPreset[];
  addPreset: (input: Omit<RegistrationPreset, 'id'>) => Promise<void>;
  removePreset: (id: string) => Promise<void>;
};

const STORAGE_KEY = 'oshilist.registrationPresets.v1';
const RegistrationPresetContext = createContext<RegistrationPresetContextValue | null>(null);

export function RegistrationPresetProvider({ children }: PropsWithChildren) {
  const [presets, setPresets] = useState<RegistrationPreset[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored) {
        setPresets(JSON.parse(stored) as RegistrationPreset[]);
      }
    });
  }, []);

  const persistPresets = async (nextPresets: RegistrationPreset[]) => {
    setPresets(nextPresets);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextPresets));
  };

  const addPreset = async (input: Omit<RegistrationPreset, 'id'>) => {
    const nextPreset: RegistrationPreset = {
      ...input,
      id: `registration-${Date.now()}`,
    };
    await persistPresets([nextPreset, ...presets]);
  };

  const removePreset = async (id: string) => {
    await persistPresets(presets.filter((preset) => preset.id !== id));
  };

  const value = useMemo(() => ({ presets, addPreset, removePreset }), [presets]);

  return <RegistrationPresetContext.Provider value={value}>{children}</RegistrationPresetContext.Provider>;
}

export function useRegistrationPresets() {
  const context = useContext(RegistrationPresetContext);
  if (!context) {
    throw new Error('useRegistrationPresets must be used inside RegistrationPresetProvider');
  }
  return context;
}
