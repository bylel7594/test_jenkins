import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { TimesheetStatus } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function statusLabel(status: TimesheetStatus): string {
  const labels: Record<TimesheetStatus, string> = {
    processing: 'En traitement',
    conforme: 'Conforme',
    ecart: 'Écart',
    a_confirmer: 'À confirmer',
    valide: 'Validé',
  }
  return labels[status] ?? status
}

export function statusColor(status: TimesheetStatus): string {
  switch (status) {
    case 'conforme': return 'text-green-700 bg-green-50 border-green-200'
    case 'ecart': return 'text-red-700 bg-red-50 border-red-200'
    case 'a_confirmer': return 'text-amber-700 bg-amber-50 border-amber-200'
    case 'valide': return 'text-blue-700 bg-blue-50 border-blue-200'
    default: return 'text-gray-500 bg-gray-50 border-gray-200'
  }
}

export function confidenceColor(confidence: number | null, threshold = 0.85): string {
  if (confidence === null) return 'border-amber-400 bg-amber-50'
  if (confidence >= threshold) return ''
  if (confidence >= 0.6) return 'border-amber-400 bg-amber-50'
  return 'border-red-400 bg-red-50'
}

export function formatHours(hours: number | null): string {
  if (hours === null) return '—'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, '0')}`
}

export function formatGap(handwritten: number | null, calculated: number | null): string | null {
  if (handwritten === null || calculated === null) return null
  const gap = handwritten - calculated
  if (Math.abs(gap) < 0.01) return null
  const sign = gap > 0 ? '+' : ''
  return `${sign}${formatHours(gap)}`
}
