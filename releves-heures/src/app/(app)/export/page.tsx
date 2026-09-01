'use client'

import { useEffect, useState } from 'react'
import { Download, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, formatHours, statusColor, statusLabel } from '@/lib/utils'
import type { Timesheet, ExportConfig } from '@/types'
import { DEFAULT_EXPORT_CONFIG } from '@/types'

export default function ExportPage() {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [config] = useState<ExportConfig>(DEFAULT_EXPORT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    fetch('/api/timesheets?status=valide&limit=500')
      .then((r) => r.json())
      .then((j) => {
        setTimesheets(j.timesheets ?? [])
        setLoading(false)
      })
  }, [])

  const selectAll = () =>
    setSelected(new Set(timesheets.map((t) => t.id)))
  const clearAll = () => setSelected(new Set())
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const doExport = async () => {
    if (!selected.size) return
    setExporting(true)
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selected), config }),
    })
    if (res.ok) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `releves-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    }
    setExporting(false)
  }

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Export paie</h1>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm">
            <Settings2 className="h-4 w-4" />
            Format CSV
          </Button>
          <Button
            onClick={doExport}
            loading={exporting}
            disabled={selected.size === 0}
          >
            <Download className="h-4 w-4" />
            Exporter {selected.size > 0 ? `${selected.size} relevé${selected.size > 1 ? 's' : ''}` : ''}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm text-gray-500">
        <span>{timesheets.length} relevé{timesheets.length > 1 ? 's' : ''} validé{timesheets.length > 1 ? 's' : ''} disponible{timesheets.length > 1 ? 's' : ''}</span>
        <button onClick={selectAll} className="text-blue-600 hover:underline">Tout sélectionner</button>
        {selected.size > 0 && (
          <button onClick={clearAll} className="text-gray-500 hover:underline">Tout désélectionner</button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Chargement…</p>
      ) : timesheets.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-400">
          Aucun relevé validé. Validez des relevés dans la file d'attente avant d'exporter.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-8 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.size === timesheets.length}
                    onChange={() => selected.size === timesheets.length ? clearAll() : selectAll()}
                  />
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Intérimaire</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">EU</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Période</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Heures</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {timesheets.map((ts) => (
                <tr
                  key={ts.id}
                  className={cn(
                    'cursor-pointer hover:bg-blue-50',
                    selected.has(ts.id) && 'bg-blue-50'
                  )}
                  onClick={() => toggle(ts.id)}
                >
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={selected.has(ts.id)}
                      onChange={() => toggle(ts.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="px-3 py-2.5 font-medium text-gray-800">{ts.interim_name ?? '—'}</td>
                  <td className="px-3 py-2.5 text-gray-600">{ts.client_company ?? '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-500">
                    {ts.period_start} → {ts.period_end}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                    {formatHours(ts.handwritten_total_hours)}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge className={statusColor(ts.status)}>
                      {statusLabel(ts.status)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
