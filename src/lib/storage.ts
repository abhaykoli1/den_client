// Local-storage helpers. Never store backend secrets here — only the
// client session token, theme and active club id.
const PREFIX = 'rowdysden.'

export function getItem(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key)
  } catch {
    return null
  }
}

export function setItem(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(PREFIX + key)
    else localStorage.setItem(PREFIX + key, value)
  } catch {
    /* storage unavailable */
  }
}

export const getToken = () => getItem('authToken')
export const setToken = (t: string) => setItem('authToken', t)
export const clearToken = () => setItem('authToken', null)

export const getActiveClubId = () => getItem('activeClubId')
export const setActiveClubId = (id: string) => setItem('activeClubId', id)

export const getThemePref = () => getItem('theme')
export const setThemePref = (t: 'dark' | 'light') => setItem('theme', t)
