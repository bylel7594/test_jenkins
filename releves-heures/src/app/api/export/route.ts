import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Timesheet, ExportConfig } from '@/types'

// POST /api/export — génère le CSV d'export paie
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { ids, config }: { ids: string[]; config: ExportConfig } = await request.json()
  if (!ids?.length) return NextResponse.json({ error: 'Aucun relevé sélectionné' }, { status: 400 })

  // Seuls les relevés validés peuvent être exportés
  const { data: timesheets, error } = await supabase
    .from('timesheets')
    .select('*')
    .in('id', ids)
    .eq('status', 'valide')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!timesheets?.length) {
    return NextResponse.json({ error: 'Aucun relevé validé dans la sélection' }, { status: 400 })
  }

  const csv = generateCsv(timesheets, config)

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="releves-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}

function formatDate(isoDate: string | null, format: ExportConfig['date_format']): string {
  if (!isoDate) return ''
  const [y, m, d] = isoDate.split('-')
  switch (format) {
    case 'DD/MM/YYYY': return `${d}/${m}/${y}`
    case 'MM/DD/YYYY': return `${m}/${d}/${y}`
    default: return isoDate
  }
}

function formatDuration(hours: number | null, format: ExportConfig['duration_format']): string {
  if (hours === null) return ''
  if (format === 'decimal') return hours.toFixed(2).replace('.', ',')
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function escapeCell(value: string, separator: string): string {
  if (value.includes(separator) || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function generateCsv(timesheets: Timesheet[], config: ExportConfig): string {
  const enabledColumns = [...config.columns]
    .filter((c) => c.enabled)
    .sort((a, b) => a.order - b.order)

  const sep = config.separator

  const header = enabledColumns.map((c) => escapeCell(c.label, sep)).join(sep)

  const rows = timesheets.map((ts) => {
    return enabledColumns
      .map((col) => {
        let value = ''
        switch (col.key) {
          case 'interim_name': value = ts.interim_name ?? ''; break
          case 'qualification': value = ts.qualification ?? ''; break
          case 'client_company': value = ts.client_company ?? ''; break
          case 'period_start': value = formatDate(ts.period_start, config.date_format); break
          case 'period_end': value = formatDate(ts.period_end, config.date_format); break
          case 'handwritten_total_hours': value = formatDuration(ts.handwritten_total_hours, config.duration_format); break
          case 'calculated_total_hours': value = formatDuration(ts.calculated_total_hours, config.duration_format); break
          case 'baskets': value = ts.baskets !== null ? String(ts.baskets) : ''; break
          case 'transport': value = ts.transport !== null ? String(ts.transport) : ''; break
          case 'bonuses': value = ts.bonuses !== null ? String(ts.bonuses) : ''; break
          case 'validated_at': value = ts.validated_at ? formatDate(ts.validated_at.slice(0, 10), config.date_format) : ''; break
          default: value = ''
        }
        return escapeCell(value, sep)
      })
      .join(sep)
  })

  return '﻿' + [header, ...rows].join('\r\n')
}
