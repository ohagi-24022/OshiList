import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

const THEME_STORAGE_KEY = 'oshilist.theme.v3';
const CUSTOM_PRESETS_STORAGE_KEY = 'oshilist.customPresets.v1';

export type ColorRole =
  | 'primary'
  | 'secondary'
  | 'background'
  | 'surface'
  | 'elevated'
  | 'text'
  | 'muted'
  | 'border'
  | 'input'
  | 'success'
  | 'danger';

export type ThemePreset = {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  elevated: string;
  text: string;
  muted: string;
  border: string;
  input: string;
  success: string;
  danger: string;
  custom?: boolean;
};

export type AppColors = ThemePreset;

type ThemeContextValue = {
  colors: AppColors;
  presets: ThemePreset[];
  builtInPresets: ThemePreset[];
  customPresets: ThemePreset[];
  setPreset: (preset: ThemePreset) => void;
  setCustomColor: (key: ColorRole, value: string) => void;
  saveCurrentAsPreset: (name: string) => Promise<void>;
  deleteCustomPreset: (id: string) => Promise<void>;
};

const builtInPresets: ThemePreset[] = [
  {
    id: 'rose-stage',
    name: 'ローズステージ',
    primary: '#e94f7d',
    secondary: '#ffb2c8',
    background: '#fff7fa',
    surface: '#ffffff',
    elevated: '#ffe8f0',
    text: '#26151c',
    muted: '#775765',
    border: '#f2cbd8',
    input: '#fff0f5',
    success: '#198754',
    danger: '#d92d20',
  },
  {
    id: 'moon-lavender',
    name: 'ムーンラベンダー',
    primary: '#7b61ff',
    secondary: '#b9a7ff',
    background: '#fbfaff',
    surface: '#ffffff',
    elevated: '#f0edff',
    text: '#171622',
    muted: '#656079',
    border: '#ddd7ff',
    input: '#f4f1ff',
    success: '#16845b',
    danger: '#d63d47',
  },
  {
    id: 'aqua-live',
    name: 'アクアライブ',
    primary: '#00a7b5',
    secondary: '#8fe3ea',
    background: '#f5feff',
    surface: '#ffffff',
    elevated: '#e6f8fa',
    text: '#102225',
    muted: '#51686c',
    border: '#c8eef2',
    input: '#eefdff',
    success: '#148a4f',
    danger: '#cc3344',
  },
  {
    id: 'sunny-pop',
    name: 'サニーポップ',
    primary: '#f5a400',
    secondary: '#ffe08a',
    background: '#fffdf5',
    surface: '#ffffff',
    elevated: '#fff3cf',
    text: '#231c10',
    muted: '#6c604a',
    border: '#f1dfaa',
    input: '#fff7df',
    success: '#248a3d',
    danger: '#d63b30',
  },
  {
    id: 'mono-gallery',
    name: 'モノギャラリー',
    primary: '#0a84ff',
    secondary: '#8ec5ff',
    background: '#ffffff',
    surface: '#ffffff',
    elevated: '#f4f4f4',
    text: '#111111',
    muted: '#666666',
    border: '#e5e5e5',
    input: '#f4f4f4',
    success: '#138a3d',
    danger: '#ff3b30',
  },
];

const darkPreset: ThemePreset = {
  id: 'night-penlight',
  name: 'ナイトペンライト',
  primary: '#8fb5ff',
  secondary: '#f2a6ff',
  background: '#050505',
  surface: '#111111',
  elevated: '#1d1d1d',
  text: '#f5f5f5',
  muted: '#a3a3a3',
  border: '#2a2a2a',
  input: '#171717',
  success: '#31c759',
  danger: '#ff453a',
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemMode = useColorScheme();
  const [theme, setTheme] = useState<ThemePreset>(() => (systemMode === 'dark' ? darkPreset : builtInPresets[0]));
  const [customPresets, setCustomPresets] = useState<ThemePreset[]>([]);

  useEffect(() => {
    AsyncStorage.multiGet([THEME_STORAGE_KEY, CUSTOM_PRESETS_STORAGE_KEY]).then((entries) => {
      const storedTheme = entries[0][1];
      const storedCustomPresets = entries[1][1];
      if (storedCustomPresets) {
        setCustomPresets(JSON.parse(storedCustomPresets) as ThemePreset[]);
      }
      if (storedTheme) {
        setTheme(JSON.parse(storedTheme) as ThemePreset);
      }
    });
  }, []);

  const persistTheme = (nextTheme: ThemePreset) => {
    setTheme(nextTheme);
    AsyncStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(nextTheme));
  };

  const saveCurrentAsPreset = async (name: string) => {
    const presetName = name.trim() || 'マイテーマ';
    const nextPreset: ThemePreset = {
      ...theme,
      id: `custom-${Date.now()}`,
      name: presetName,
      custom: true,
    };
    const nextPresets = [nextPreset, ...customPresets];
    setCustomPresets(nextPresets);
    await AsyncStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(nextPresets));
    persistTheme(nextPreset);
  };

  const deleteCustomPreset = async (id: string) => {
    const nextPresets = customPresets.filter((preset) => preset.id !== id);
    setCustomPresets(nextPresets);
    await AsyncStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(nextPresets));

    if (theme.id === id) {
      persistTheme(builtInPresets[0]);
    }
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: theme,
      presets: [...customPresets, ...builtInPresets],
      builtInPresets,
      customPresets,
      setPreset: persistTheme,
      setCustomColor: (key, value) => persistTheme({ ...theme, id: 'draft-custom', name: '編集中のテーマ', [key]: value }),
      saveCurrentAsPreset,
      deleteCustomPreset,
    }),
    [customPresets, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used inside ThemeProvider');
  }
  return context;
}
