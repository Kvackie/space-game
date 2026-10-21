const numberFormat = new Intl.NumberFormat('en')

export const formatNumber = (n: number) => numberFormat.format(n)

/** "45s", "1:05", "1:02:03". */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  if (m) return `${m}:${String(s).padStart(2, '0')}`
  return `${s}s`
}
