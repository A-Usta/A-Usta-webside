import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, useColorScheme } from 'react-native';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'austa:app-settings:v1';

type AppSettingsValue = {
  themeMode: ThemeMode;
  colorScheme: 'light' | 'dark';
  setThemeMode: (mode: ThemeMode) => Promise<void>;
};

const AppSettingsContext = createContext<AppSettingsValue>({
  themeMode: 'system',
  colorScheme: 'light',
  setThemeMode: async () => {},
});

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (!mounted || !raw) return;
      try {
        const saved: unknown = JSON.parse(raw);
        if (saved && typeof saved === 'object' && isThemeMode((saved as { themeMode?: unknown }).themeMode)) {
          setThemeModeState((saved as { themeMode: ThemeMode }).themeMode);
        }
      } catch {
        // Invalid local preference data falls back to the system setting.
      }
    }).catch(() => {
      // A storage failure keeps the system appearance and does not block app startup.
    }).finally(() => {
      if (mounted) setHydrated(true);
    });
    return () => { mounted = false; };
  }, []);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ themeMode: mode }));
      setThemeModeState(mode);
    } catch {
      throw new Error('Görünüş seçimi cihazda saxlanmadı. Yenidən cəhd edin.');
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    Appearance.setColorScheme(themeMode === 'system' ? 'unspecified' : themeMode);
  }, [hydrated, themeMode]);

  const colorScheme = themeMode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : themeMode;
  const value = useMemo(() => ({ themeMode, colorScheme, setThemeMode }), [themeMode, colorScheme, setThemeMode]);
  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings() {
  return useContext(AppSettingsContext);
}
