import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type DappLocale = 'en' | 'es';

export const LOCALE_STORAGE_KEY = 'synapseq.locale.v2';

export function detectDappLocale(): DappLocale {
  if (typeof window === 'undefined') return 'en';
  const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (saved === 'en' || saved === 'es') return saved;
  return 'en';
}

interface I18nContextValue {
  readonly locale: DappLocale;
  readonly setLocale: (next: DappLocale) => void;
  readonly tr: (en: string, es: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  setLocale: () => undefined,
  tr: (en) => en,
});

export function I18nProvider({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  const [locale, setLocaleState] = useState<DappLocale>(() => detectDappLocale());

  const setLocale = useCallback((next: DappLocale) => {
    setLocaleState(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
      document.documentElement.lang = next;
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.lang = locale;
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    }
  }, [locale]);

  const tr = useCallback(
    (en: string, es: string): string => (locale === 'es' ? es : en),
    [locale]
  );

  const value = useMemo(
    () => ({ locale, setLocale, tr }),
    [locale, setLocale, tr]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
