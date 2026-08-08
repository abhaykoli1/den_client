// Excel (.xlsx) downloads — generated ENTIRELY in the browser.
// Nothing is stored server-side / in MongoDB (zero storage used): the file is
// built on the fly from the club data already loaded, zipped (xlsx ≈ compact),
// and downloaded. SheetJS loads lazily on first use (split chunk).
import { dateStamp } from './csv'

export type SheetRow = Array<string | number | null | undefined>
export interface SheetDef {
  name: string
  rows: SheetRow[]
}

export async function downloadXlsx(filename: string, sheets: SheetDef[]) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sheet.rows)
    // approximate column widths for readability
    const cols: Array<{ wch: number }> = []
    for (const row of sheet.rows.slice(0, 60)) {
      row.forEach((cell, i) => {
        const len = String(cell ?? '').length
        cols[i] = { wch: Math.min(52, Math.max(cols[i]?.wch ?? 10, len + 2)) }
      })
    }
    ws['!cols'] = cols
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31))
  }
  XLSX.writeFile(wb, filename.match(/\.xlsx$/) ? filename : `${filename}.xlsx`)
}

export function xlsxName(base: string): string {
  return `rowdys-den-${base}-${dateStamp()}.xlsx`
}
