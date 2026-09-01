'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn, statusColor, statusLabel, formatHours } from '@/lib/utils'
import type { Timesheet } from '@/types'

export default function HistoriquePage() {
  const router = useRouter()
  const [timesheets, setTimesheets] = useState<Timesheet[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams({ limit: '200' })
    if (search) params.set('search', search)
    fetch(`/api/timesheets?${params}`)
      .then((r) => r.json())
      .then((j) => {
        setTimesheets(j.timesheets ?? [])
        setLoading(false)
      })
  }, [search])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-4 border-b border-gray-200 bg-white px-5 py-3">
        <h1 className="text-base font-semibold text-gray-900">Historique</h1>
        <div className="relative ml-auto w-64">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
          <input
            type="search"
            placeholder="Intérimaire, entreprise…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-gray-300 py-1.5 pl-8 pr-3 text-sm focus:border-blue-400 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex h-32 items-center justify-center text-sm text-gray-400">Chargement…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Statut</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Intérimaire</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Entreprise utilisatrice</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Période</th>
                <th className="px-4 py-2 text-right font-medium text-gray-600">Heures</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Validé le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {timesheets.map((ts) => (
                <tr
                  key={ts.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => router.push(`/releve/${ts.id}`)}
                >
                  <td className="px-4 py-2.5">
                    <Badge className={cn('text-xs', statusColor(ts.status))}>
                      {statusLabel(ts.status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{ts.interim_name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600">{ts.client_company ?? '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">
                    {ts.period_start ?? '—'} → {ts.period_end ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatHours(ts.handwritten_total_hours)}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">
                    {ts.validated_at ? new Date(ts.validated_at).toLocaleDateString('fr-FR') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
