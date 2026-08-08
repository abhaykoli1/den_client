// CSV / JSON download helpers (browser-only, no server round-trip needed).

export function csvEsc(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v)
  return `"${s.replace(/"/g, '""')}"`
}

export function downloadText(name: string, text: string, type: string) {
  const blob = new Blob([text], { type: `${type};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadCsv(name: string, lines: string[]) {
  downloadText(name, lines.join('\n'), 'text/csv')
}

export function downloadJson(name: string, payload: unknown) {
  downloadText(name, JSON.stringify(payload, null, 2), 'application/json')
}

export function dateStamp(iso?: string): string {
  return (iso ?? new Date().toISOString()).slice(0, 10)
}
