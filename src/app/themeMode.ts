import { createContext, useContext } from 'react'

export type ThemeMode = 'light' | 'dark'

export const STORAGE_KEY = 'theme-mode'

export const ThemeModeContext = createContext<{
  mode: ThemeMode
  toggle: () => void
} | null>(null)

export function useThemeMode() {
  const context = useContext(ThemeModeContext)
  if (!context) {
    throw new Error('useThemeMode must be used within AntdProvider')
  }
  return context
}

export function getInitialMode(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
