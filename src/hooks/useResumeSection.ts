import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { SupportedLanguage } from '../i18n'

export function useResumeSection<T>(
  loader: (lang: SupportedLanguage) => Promise<T[]>,
): { data: T[]; loading: boolean } {
  const { i18n } = useTranslation()
  const lang = (i18n.resolvedLanguage ?? 'ru') as SupportedLanguage
  const [state, setState] = useState<{ lang: SupportedLanguage | null; data: T[] }>({
    lang: null,
    data: [],
  })

  useEffect(() => {
    let cancelled = false

    loader(lang).then((result) => {
      if (!cancelled) {
        setState({ lang, data: result })
      }
    })

    return () => {
      cancelled = true
    }
  }, [lang, loader])

  return { data: state.data, loading: state.lang !== lang }
}
