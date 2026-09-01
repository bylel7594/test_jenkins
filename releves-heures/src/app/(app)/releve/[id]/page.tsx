'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  cn,
  statusLabel,
  statusColor,
  confidenceColor,
  formatHours,
} from '@/lib/utils'
import type { Timesheet, TimesheetLine } from '@/types'
import { createClient } from '@/lib/supabase/client'

const THRESHOLD = 0.85

function isLow(confidence: number | null) {
  return confidence !== null && confidence < THRESHOLD
}

export default function RelevePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [timesheet, setTimesheet] = useState<Timesheet | null>(null)
  const [lines, setLines] = useState<TimesheetLine[]>([])
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Champs éditables
  const [fields, setFields] = useState({
    interim_name: '',
    qualification: '',
    client_company: '',
    period_start: '',
    period_end: '',
    handwritten_total_hours: '',
    baskets: '',
    transport: '',
    bonuses: '',
  })

  const firstFieldRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/timesheets/${id}`)
    if (!res.ok) return
    const json = await res.json()
    const ts: Timesheet = json.timesheet
    setTimesheet(ts)
    setLines((ts.lines ?? []).sort((a, b) => a.line_order - b.line_order))
    setFields({
      interim_name: ts.interim_name ?? '',
      qualification: ts.qualification ?? '',
      client_company: ts.client_company ?? '',
      period_start: ts.period_start ?? '',
      period_end: ts.period_end ?? '',
      handwritten_total_hours: ts.handwritten_total_hours?.toString() ?? '',
      baskets: ts.baskets?.toString() ?? '',
      transport: ts.transport?.toString() ?? '',
      bonuses: ts.bonuses?.toString() ?? '',
    })

    // Charge l'image depuis Supabase Storage
    const supabase = createClient()
    const { data } = supabase.storage.from('timesheets').getPublicUrl(ts.file_path)
    setImgSrc(data.publicUrl)
  }, [id])

  useEffect(() => { load() }, [load])

  // Navigation clavier
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft') navigateRelative(-1)
      if (e.key === 'ArrowRight') navigateRelative(1)
      if (e.key === 'v' || e.key === 'V') handleValidate()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  const navigateRelative = async (delta: number) => {
    const res = await fetch('/api/timesheets?limit=200')
    const json = await res.json()
    const all: Timesheet[] = json.timesheets ?? []
    const idx = all.findIndex((t) => t.id === id)
    const target = all[idx + delta]
    if (target) router.push(`/releve/${target.id}`)
  }

  const updateLine = (lineId: string, field: keyof TimesheetLine, value: string) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l
        const updated = { ...l, [field]: value || null }
        // Recalcule les heures de la ligne
        if (field === 'arrival_time' || field === 'departure_time') {
          const arr = field === 'arrival_time' ? value : l.arrival_time
          const dep = field === 'departure_time' ? value : l.departure_time
          if (arr && dep) {
            const [ah, am] = arr.split(':').map(Number)
            const [dh, dm] = dep.split(':').map(Number)
            const mins = (dh * 60 + dm) - (ah * 60 + am)
            updated.calculated_hours = mins > 0 ? Math.round(mins / 6) / 10 : null
          }
        }
        return updated
      })
    )
    setDirty(true)
  }

  const calculatedTotal = lines.reduce((sum, l) => sum + (l.calculated_hours ?? 0), 0)
  const handwrittenTotal = parseFloat(fields.handwritten_total_hours) || null
  const gap =
    handwrittenTotal !== null
      ? handwrittenTotal - calculatedTotal
      : null

  const hasGap = gap !== null && Math.abs(gap) > 0.01

  const handleSave = async () => {
    setSaving(true)
    await fetch(`/api/timesheets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...fields,
        handwritten_total_hours: handwrittenTotal,
        baskets: parseFloat(fields.baskets) || null,
        transport: parseFloat(fields.transport) || null,
        bonuses: parseFloat(fields.bonuses) || null,
        lines: lines.map((l) => ({
          id: l.id,
          arrival_time: l.arrival_time,
          departure_time: l.departure_time,
          calculated_hours: l.calculated_hours,
        })),
      }),
    })
    setDirty(false)
    await load()
    setSaving(false)
  }

  const handleValidate = async () => {
    setValidating(true)
    await fetch(`/api/timesheets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...fields,
        handwritten_total_hours: handwrittenTotal,
        validate: true,
        lines: lines.map((l) => ({
          id: l.id,
          arrival_time: l.arrival_time,
          departure_time: l.departure_time,
          calculated_hours: l.calculated_hours,
        })),
      }),
    })
    await load()
    setDirty(false)
    setValidating(false)
  }

  if (!timesheet) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Chargement du relevé…
      </div>
    )
  }

  const canValidate =
    timesheet.status !== 'valide' &&
    fields.interim_name.trim() !== '' &&
    fields.client_company.trim() !== ''

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* En-tête */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2.5">
        <button
          onClick={() => router.push('/file-attente')}
          className="text-gray-400 hover:text-gray-600"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <Badge className={cn('gap-1', statusColor(timesheet.status))}>
          {timesheet.status === 'a_confirmer' && <AlertCircle className="h-3 w-3" />}
          {timesheet.status === 'ecart' && <AlertTriangle className="h-3 w-3" />}
          {timesheet.status === 'conforme' && <CheckCircle2 className="h-3 w-3" />}
          {timesheet.status === 'valide' && <CheckCircle2 className="h-3 w-3" />}
          {statusLabel(timesheet.status)}
        </Badge>
        <span className="text-sm text-gray-500 flex-1">
          {timesheet.interim_name ?? 'Intérimaire inconnu'} —{' '}
          {timesheet.client_company ?? 'EU inconnue'}
        </span>

        {/* Navigation */}
        <div className="flex items-center gap-1">
          <button
            title="Relevé précédent (←)"
            onClick={() => navigateRelative(-1)}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            title="Relevé suivant (→)"
            onClick={() => navigateRelative(1)}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {dirty && (
          <Button size="sm" variant="secondary" onClick={handleSave} loading={saving}>
            Enregistrer
          </Button>
        )}
        <Button
          size="sm"
          onClick={handleValidate}
          loading={validating}
          disabled={!canValidate || timesheet.status === 'valide'}
          title="Valider (V)"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {timesheet.status === 'valide' ? 'Validé' : 'Valider (V)'}
        </Button>
      </div>

      {/* Corps : image à gauche, formulaire à droite */}
      <div className="flex flex-1 overflow-hidden">
        {/* Image */}
        <div className="relative flex-1 overflow-auto bg-gray-900">
          <div className="absolute right-3 top-3 z-10 flex gap-1">
            <button
              onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
              className="rounded bg-black/50 p-1.5 text-white hover:bg-black/70"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
              className="rounded bg-black/50 p-1.5 text-white hover:bg-black/70"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <span className="rounded bg-black/50 px-2 py-1.5 text-xs text-white">
              {Math.round(zoom * 100)}%
            </span>
          </div>
          {imgSrc && (
            <div
              className="inline-block transition-transform origin-top-left p-4"
              style={{ transform: `scale(${zoom})` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgSrc}
                alt="Relevé d'heures"
                className="max-w-none shadow-lg"
              />
            </div>
          )}
        </div>

        {/* Formulaire */}
        <div className="w-96 overflow-y-auto border-l border-gray-200 bg-white">
          <div className="space-y-5 p-4">
            {/* En-tête */}
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Identification
              </h2>
              <div className="space-y-2.5">
                <Input
                  ref={firstFieldRef}
                  label="Intérimaire"
                  value={fields.interim_name}
                  onChange={(e) => { setFields((f) => ({ ...f, interim_name: e.target.value })); setDirty(true) }}
                  warning={isLow(timesheet.interim_name_confidence)}
                />
                <Input
                  label="Qualification"
                  value={fields.qualification}
                  onChange={(e) => { setFields((f) => ({ ...f, qualification: e.target.value })); setDirty(true) }}
                  warning={isLow(timesheet.qualification_confidence)}
                />
                <Input
                  label="Entreprise utilisatrice"
                  value={fields.client_company}
                  onChange={(e) => { setFields((f) => ({ ...f, client_company: e.target.value })); setDirty(true) }}
                  warning={isLow(timesheet.client_company_confidence)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="Début"
                    type="date"
                    value={fields.period_start}
                    onChange={(e) => { setFields((f) => ({ ...f, period_start: e.target.value })); setDirty(true) }}
                    warning={isLow(timesheet.period_start_confidence)}
                  />
                  <Input
                    label="Fin"
                    type="date"
                    value={fields.period_end}
                    onChange={(e) => { setFields((f) => ({ ...f, period_end: e.target.value })); setDirty(true) }}
                    warning={isLow(timesheet.period_end_confidence)}
                  />
                </div>
              </div>
            </section>

            {/* Tableau des jours */}
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Jours travaillés
              </h2>
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium text-gray-500">Date</th>
                      <th className="px-2 py-1.5 text-left font-medium text-gray-500">Arrivée</th>
                      <th className="px-2 py-1.5 text-left font-medium text-gray-500">Départ</th>
                      <th className="px-2 py-1.5 text-right font-medium text-gray-500">Heures</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lines.map((line) => (
                      <tr key={line.id} className="group">
                        <td className="px-1 py-1">
                          <input
                            type="date"
                            value={line.line_date ?? ''}
                            onChange={(e) => updateLine(line.id, 'line_date', e.target.value)}
                            className={cn(
                              'w-full rounded border px-1 py-0.5 text-xs focus:border-blue-400 focus:outline-none',
                              confidenceColor(line.line_date_confidence),
                              !isLow(line.line_date_confidence) && 'border-transparent'
                            )}
                          />
                        </td>
                        <td className="px-1 py-1">
                          <input
                            type="time"
                            value={line.arrival_time ?? ''}
                            onChange={(e) => updateLine(line.id, 'arrival_time', e.target.value)}
                            className={cn(
                              'w-full rounded border px-1 py-0.5 text-xs focus:border-blue-400 focus:outline-none',
                              confidenceColor(line.arrival_time_confidence),
                              !isLow(line.arrival_time_confidence) && 'border-transparent'
                            )}
                          />
                        </td>
                        <td className="px-1 py-1">
                          <input
                            type="time"
                            value={line.departure_time ?? ''}
                            onChange={(e) => updateLine(line.id, 'departure_time', e.target.value)}
                            className={cn(
                              'w-full rounded border px-1 py-0.5 text-xs focus:border-blue-400 focus:outline-none',
                              confidenceColor(line.departure_time_confidence),
                              !isLow(line.departure_time_confidence) && 'border-transparent'
                            )}
                          />
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums font-medium text-gray-700">
                          {formatHours(line.calculated_hours)}
                        </td>
                      </tr>
                    ))}
                    {lines.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-2 py-3 text-center text-gray-400">
                          Aucune ligne extraite
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Bandeau totaux — le plus critique */}
            <section
              className={cn(
                'rounded-lg border-2 p-3',
                hasGap ? 'border-red-400 bg-red-50' : 'border-green-300 bg-green-50'
              )}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-gray-700">Totaux</span>
                {hasGap && (
                  <span className="rounded bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                    ÉCART {gap! > 0 ? '+' : ''}{formatHours(gap)}
                  </span>
                )}
                {!hasGap && handwrittenTotal !== null && (
                  <span className="rounded bg-green-500 px-2 py-0.5 text-xs font-bold text-white">
                    OK
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Total écrit à la main</p>
                  <input
                    type="number"
                    step="0.01"
                    value={fields.handwritten_total_hours}
                    onChange={(e) => { setFields((f) => ({ ...f, handwritten_total_hours: e.target.value })); setDirty(true) }}
                    className={cn(
                      'w-full rounded border px-2 py-1 text-sm font-bold tabular-nums focus:border-blue-400 focus:outline-none',
                      isLow(timesheet.handwritten_total_confidence)
                        ? 'border-amber-400 bg-amber-50'
                        : 'border-gray-300 bg-white'
                    )}
                  />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Total calculé</p>
                  <p className="rounded border border-gray-200 bg-white px-2 py-1 text-sm font-bold tabular-nums text-gray-700">
                    {formatHours(calculatedTotal)}
                  </p>
                </div>
              </div>
            </section>

            {/* Indemnités */}
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Indemnités
              </h2>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  label="Paniers"
                  type="number"
                  step="1"
                  value={fields.baskets}
                  onChange={(e) => { setFields((f) => ({ ...f, baskets: e.target.value })); setDirty(true) }}
                  warning={isLow(timesheet.baskets_confidence)}
                />
                <Input
                  label="Déplacements"
                  type="number"
                  step="0.01"
                  value={fields.transport}
                  onChange={(e) => { setFields((f) => ({ ...f, transport: e.target.value })); setDirty(true) }}
                  warning={isLow(timesheet.transport_confidence)}
                />
                <Input
                  label="Primes"
                  type="number"
                  step="0.01"
                  value={fields.bonuses}
                  onChange={(e) => { setFields((f) => ({ ...f, bonuses: e.target.value })); setDirty(true) }}
                  warning={isLow(timesheet.bonuses_confidence)}
                />
              </div>
            </section>

            {/* Légende */}
            <div className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-700">
              <p className="font-medium mb-0.5">⚠ Champs à confirmer</p>
              <p>Les champs en fond orange ont été lus avec une confiance faible. Vérifiez-les sur le document original avant de valider.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
