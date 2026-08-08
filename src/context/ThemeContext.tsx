import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getThemePref, setThemePref } from '../lib/storage'

type Theme = 'dark' | 'light'

interface ThemeCtx {
  theme: Theme
  toggle: () => void
}

const Ctx = createContext<ThemeCtx>({ theme: 'light', toggle: () => undefined })

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Light mode is the default; dark stays one tap away in the sidebar.
  const [theme, setTheme] = useState<Theme>(() => (getThemePref() === 'dark' ? 'dark' : 'light'))

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    setThemePref(theme)
  }, [theme])

  const value = useMemo<ThemeCtx>(
    () => ({ theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }),
    [theme],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTheme() {
  return useContext(Ctx)
}
