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

function readStoredPresets(stored: string): RegistrationPreset[] {
  try {
    const parsed = JSON.parse(stored) as RegistrationPreset[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function RegistrationPresetProvider({ children }: PropsWithChildren) {
  const [presets, setPresets] = useState<RegistrationPreset[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored) {
        setPresets(readStoredPresets(stored));
      }
    });
  }, []);

  const persistPresets = async (nextPresets: RegistrationPreset[]) => {
    setPresets(nextPresets);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextPresets));
  };

  const addPreset = async (input: Omit<RegistrationPreset, 'id'>) => {
    const normalized = {
      name: input.name.trim(),
      seriesName: input.seriesName.trim(),
      characterName: input.characterName.trim(),
      variantName: input.variantName.trim(),
    };
    const exists = presets.some(
      (preset) =>
        preset.seriesName.trim() === normalized.seriesName &&
        preset.characterName.trim() === normalized.characterName &&
        preset.variantName.trim() === normalized.variantName,
    );
    if (exists) return;

    const nextPreset: RegistrationPreset = {
      ...normalized,
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
