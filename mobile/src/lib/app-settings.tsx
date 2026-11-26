import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, useColorScheme } from 'react-native';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { cbarDailyUrl, isCurrencyCode, parseCbarRates, setCurrencySnapshot, type CurrencyCode, type ExchangeRates } from './currency';

export type ThemeMode = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'austa:app-settings:v1';

type AppSettingsValue = {
  themeMode: ThemeMode;
  colorScheme: 'light' | 'dark';
  currency: CurrencyCode;
  exchangeRates: ExchangeRates | null;
  exchangeRateError: string;
  setCurrency: (currency: CurrencyCode) => Promise<void>;
  refreshExchangeRates: () => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
};

const AppSettingsContext = createContext<AppSettingsValue>({
  themeMode: 'system',
  colorScheme: 'light',
  currency: 'AZN',
  exchangeRates: null,
  exchangeRateError: '',
  setCurrency: async () => {},
  refreshExchangeRates: async () => {},
  setThemeMode: async () => {},
});

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [currency, setCurrencyState] = useState<CurrencyCode>('AZN');
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(null);
  const [exchangeRateError, setExchangeRateError] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (!mounted || !raw) return;
      try {
        const saved: unknown = JSON.parse(raw);
        if (saved && typeof saved === 'object') {
          if (isThemeMode((saved as { themeMode?: unknown }).themeMode)) setThemeModeState((saved as { themeMode: ThemeMode }).themeMode);
          if (isCurrencyCode((saved as { currency?: unknown }).currency)) setCurrencyState((saved as { currency: CurrencyCode }).currency);
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

  const savePreference = useCallback(async (patch: Partial<{ themeMode: ThemeMode; currency: CurrencyCode }>) => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      let existing: Record<string, unknown> = {};
      try { const parsed = raw ? JSON.parse(raw) : {}; if (parsed && typeof parsed === 'object') existing = parsed; } catch { /* recover by replacing malformed local data */ }
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...existing, ...patch }));
    } catch {
      throw new Error('Seçim cihazda saxlanmadı. Yenidən cəhd edin.');
    }
  }, []);
  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    await savePreference({ themeMode: mode });
    setThemeModeState(mode);
  }, [savePreference]);
  const setCurrency = useCallback(async (value: CurrencyCode) => {
    await savePreference({ currency: value });
    setCurrencyState(value);
  }, [savePreference]);

  const refreshExchangeRates = useCallback(async () => {
    try {
      let parsed: ExchangeRates | null = null;
      for (let dayOffset=0;dayOffset<=7&&!parsed;dayOffset++) {
        const date=new Date();date.setDate(date.getDate()-dayOffset);
        const controller=new AbortController();
        const timeout=setTimeout(()=>controller.abort(),8000);
        try {
          const response = await fetch(cbarDailyUrl(date), { headers: { Accept: 'application/xml,text/xml' }, signal: controller.signal });
          if (!response.ok) continue;
          parsed = parseCbarRates(await response.text());
        } catch { /* CBAR does not publish a new document on some nonbusiness days. */ }
        finally { clearTimeout(timeout); }
      }
      if (!parsed) throw new Error('Mərkəzi Bank feed-ində USD/EUR məzənnəsi tapılmadı.');
      await AsyncStorage.setItem('austa:cbar-rates:v1', JSON.stringify(parsed));
      setExchangeRates(parsed);
      setExchangeRateError('');
    } catch {
      setExchangeRateError('Rəsmi məzənnə indi yenilənmədi. Son saxlanmış məzənnə varsa onun tarixi tətbiq olunur; çevirmə məlumatı yoxdursa qiymət ilkin valyutada qalır.');
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    Appearance.setColorScheme(themeMode === 'system' ? 'unspecified' : themeMode);
  }, [hydrated, themeMode]);

  useEffect(() => {
    let mounted = true;
    const refreshTimer=setTimeout(()=>{if(mounted)void refreshExchangeRates();},0);
    void AsyncStorage.getItem('austa:cbar-rates:v1').then(raw => {
      if (!mounted || !raw) return;
      const cached = JSON.parse(raw) as ExchangeRates;
      if (cached?.date && cached?.aznPerUnit?.AZN === 1 && cached.aznPerUnit.USD > 0 && cached.aznPerUnit.EUR > 0) setExchangeRates(cached);
    }).catch(() => {});
    return () => { mounted = false; clearTimeout(refreshTimer); };
  }, [refreshExchangeRates]);

  useEffect(() => { setCurrencySnapshot(currency, exchangeRates); }, [currency, exchangeRates]);

  const colorScheme = themeMode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : themeMode;
  const value = useMemo(() => ({ themeMode, colorScheme, currency, exchangeRates, exchangeRateError, setCurrency, refreshExchangeRates, setThemeMode }), [themeMode, colorScheme, currency, exchangeRates, exchangeRateError, setCurrency, refreshExchangeRates, setThemeMode]);
  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings() {
  return useContext(AppSettingsContext);
}
