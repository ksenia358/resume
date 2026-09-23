import { ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import ruRU from 'antd/locale/ru_RU';
import type { PropsWithChildren } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { lightTheme, darkTheme } from '../theme';
import { getInitialMode, STORAGE_KEY, ThemeModeContext, type ThemeMode } from './themeMode';

const antdLocales = {
  ru: ruRU,
  en: enUS,
};

export function AntdProvider({ children }: PropsWithChildren) {
  const { i18n } = useTranslation();
  const [mode, setMode] = useState<ThemeMode>(getInitialMode);
  const lang = (i18n.resolvedLanguage ?? 'ru') as keyof typeof antdLocales;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  const contextValue = useMemo(
    () => ({
      mode,
      toggle: () => setMode((current) => (current === 'dark' ? 'light' : 'dark')),
    }),
    [mode],
  );

  return (
    <ThemeModeContext.Provider value={contextValue}>
      <ConfigProvider
        locale={antdLocales[lang] ?? ruRU}
        theme={mode === 'dark' ? darkTheme : lightTheme}
      >
        {children}
      </ConfigProvider>
    </ThemeModeContext.Provider>
  );
}
