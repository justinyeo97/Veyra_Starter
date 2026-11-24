const DAY = 86400000

function pad(value) {
  return String(value).padStart(2, '0')
}

export function toISODate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function todayISO() {
  return toISODate(new Date())
}

export function nowISO() {
  return new Date().toISOString()
}

export function parseDate(value) {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day)
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function addDays(value, days) {
  const date = parseDate(value) || new Date()
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

export function daysBetween(from, to) {
  const start = parseDate(from)
  const end = parseDate(to)
  if (!start || !end) return null
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  return Math.round((endDay - startDay) / DAY)
}

export function formatMoney(value, currency = 'USD') {
  const amount = Number(value) || 0
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'JPY' ? 0 : 2,
      minimumFractionDigits: currency === 'JPY' ? 0 : 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

export function formatCompactMoney(value, currency = 'USD') {
  const amount = Number(value) || 0
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      notation: Math.abs(amount) >= 10000 ? 'compact' : 'standard',
      maximumFractionDigits: Math.abs(amount) >= 10000 ? 1 : 0,
    }).format(amount)
  } catch {
    return `${currency} ${Math.round(amount)}`
  }
}

export function formatPercent(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '0%'
  return `${amount.toFixed(1)}%`
}

export function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value) || 0)
}

export function formatDate(value) {
  const date = parseDate(value)
  if (!date) return '—'
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatShortDate(value) {
  const date = parseDate(value)
  if (!date) return ''
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export function formatDateTime(value) {
  const date = parseDate(value)
  if (!date) return '—'
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatRelative(value) {
  const date = parseDate(value)
  if (!date) return ''
  const seconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(value)
}

export function formatSize(size) {
  if (size === '' || size === null || size === undefined) return '—'
  return `US ${size}`
}

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return parts
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

export function plural(count, word, pluralWord = `${word}s`) {
  return `${formatNumber(count)} ${count === 1 ? word : pluralWord}`
}

export function uid(prefix) {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `${prefix}-${Date.now().toString(36).slice(-4).toUpperCase()}${random}`
}

export function sneakerName(sneaker) {
  if (!sneaker) return 'Unknown sneaker'
  const brand = (sneaker.brand || '').trim()
  const model = (sneaker.model || '').trim()
  if (brand && model.toLowerCase().includes(brand.toLowerCase())) return model
  return [brand, model].filter(Boolean).join(' ') || 'Untitled sneaker'
}
