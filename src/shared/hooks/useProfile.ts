import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getProfile } from '../api/resume';
import type { ProfileInfo } from '../data/types';
import type { SupportedLanguage } from '../../i18n';

export function useProfile(): { data: ProfileInfo | null; loading: boolean } {
  const { i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'ru') as SupportedLanguage;
  const [state, setState] = useState<{ lang: SupportedLanguage | null; data: ProfileInfo | null }>({
    lang: null,
    data: null,
  });

  useEffect(() => {
    let cancelled = false;

    getProfile(lang)
      .catch(() => null)
      .then((result) => {
        if (!cancelled) {
          setState({ lang, data: result });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [lang]);

  return { data: state.data, loading: state.lang !== lang };
}
