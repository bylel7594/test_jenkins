'use client'

import { Suspense } from 'react'
import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  ChevronRight,
  CheckSquare,
  Square,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, statusLabel, statusColor, formatHours, formatGap } from '@/lib/utils'
import type { Timesheet, TimesheetStatus } from '@/types'
import { createClient } from '@/lib/supabase/client'

const STATUS_ORDER: TimesheetStatus[] = ['a_confirmer', 'ecart', 'conforme', 'valide', 'processing']

const STATUS_ICONS: Record<string, React.ReactNode> = {
  a_confirmer: <AlertCircle className="h-3.5 w-3.5 text-amber-500" />,
  ecart: <AlertTriangle className="h-3.5 w-3.5 text-red-500" />,
  conforme: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  valide: <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />,
  processing: <Clock className="h-3.5 w-3.5 text-gray-400 animate-spin" />,
}

const FILTERS: { label: string; value: string }[] = [
  { label: 'Tous', value: '' },
  { label: 'À confirmer', value: 'a_confirmer' },
  { label: 'Écart', value: 'ecart' },
  { label: 'Conformes', value: 'conforme' },
  { label: 'Validés', value: 'valide' },
]

function FileAttenteInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeStatus = searchParams.get('status') ?? ''

  const [timesheets, setTimesheets] = useState<Timesheet[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [validating, setValidating] = useState(false)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (activeStatus) params.set('status', activeStatus)
    if (search) params.set('search', search)
    const res = await fetch(`/api/timesheets?${params}`)
    const json = await res.json()
    setTimesheets(
      (json.timesheets ?? []).sort(
        (a: Timesheet, b: Timesheet) =>
          STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
      )
    )
    setLoading(false)
  }, [activeStatus, search])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('timesheets-queue')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'timesheets' },
        () => load()
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAllConformes = () => {
    const ids = timesheets.filter((t) => t.status === 'conforme').map((t) => t.id)
    setSelected(new Set(ids))
  }

  const bulkValidate = async () => {
    if (!selected.size) return
    setValidating(true)
    await fetch('/api/timesheets/bulk-validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selected) }),
    })
    setSelected(new Set())
    await load()
    setValidating(false)
  }

  const conformeCount = timesheets.filter((t) => t.status === 'conforme').length
  const selectedConformeCount = Array.from(selected).filter(
    (id) => timesheets.find((t) => t.id === id)?.status === 'conforme'
  ).length

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-4 border-b border-gray-200 bg-white px-5 py-3">
        <h1 className="text-base font-semibold text-gray-900">File d'attente</h1>

        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => {
                const params = new URLSearchParams()
                if (f.value) params.set('status', f.value)
                router.push(`/file-attente?${params}`)
              }}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                activeStatus === f.value
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <input
          type="search"
          placeholder="Intérimaire, entreprise…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto h-7 w-48 rounded-md border border-gray-300 px-2 text-xs focus:border-blue-400 focus:outline-none"
        />

        {conformeCount > 0 && (
          <Button size="sm" variant="secondary" onClick={selectAllConformes}>
            Sélectionner les {conformeCount} conformes
          </Button>
        )}
        {selected.size > 0 && (
          <Button
            size="sm"
            loading={validating}
            onClick={bulkValidate}
            disabled={selectedConformeCount === 0}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Valider {selectedConformeCount > 0 ? selectedConformeCount : selected.size}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-32 items-center justify-center text-sm text-gray-400">Chargement…</div>
        ) : timesheets.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-gray-400">Aucun relevé</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="w-8 px-3 py-2"></th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Statut</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Intérimaire</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Entreprise utilisatrice</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Période</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Total écrit</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Total calculé</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Écart</th>
                <th className="w-6 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {timesheets.map((ts) => {
                const gap = formatGap(ts.handwritten_total_hours, ts.calculated_total_hours)
                const isSelected = selected.has(ts.id)
                return (
                  <tr
                    key={ts.id}
                    className={cn(
                      'group cursor-pointer hover:bg-blue-50',
                      isSelected && 'bg-blue-50'
                    )}
                    onClick={() => router.push(`/releve/${ts.id}`)}
                  >
                    <td className="px-3 py-2.5" onClick={(e) => { e.stopPropagation(); toggleSelect(ts.id) }}>
                      {isSelected
                        ? <CheckSquare className="h-4 w-4 text-blue-600" />
                        : <Square className="h-4 w-4 text-gray-300 group-hover:text-gray-400" />
                      }
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge className={cn('gap-1', statusColor(ts.status))}>
                        {STATUS_ICONS[ts.status]}
                        {statusLabel(ts.status)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 font-medium text-gray-800">
                      {ts.interim_name ?? <span className="text-amber-500 italic">Inconnu</span>}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">
                      {ts.client_company ?? <span className="text-amber-500 italic">Inconnu</span>}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">
                      {ts.period_start && ts.period_end
                        ? `${ts.period_start.slice(5)} → ${ts.period_end.slice(5)}`
                        : '—'
                      }
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatHours(ts.handwritten_total_hours)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">
                      {formatHours(ts.calculated_total_hours)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {gap ? (
                        <span className="font-semibold text-red-600">{gap}</span>
                      ) : ts.status !== 'processing' ? (
                        <span className="text-green-600">—</span>
                      ) : ''}
                    </td>
                    <td className="px-3 py-2.5">
                      <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default function FileAttentePage() {
  return (
    <Suspense fallback={
      <div className="flex h-full items-center justify-center text-sm text-gray-400">Chargement…</div>
    }>
      <FileAttenteInner />
    </Suspense>
  )
}
