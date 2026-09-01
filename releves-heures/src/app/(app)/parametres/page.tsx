'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Agency, AgencySettings, ExportConfig } from '@/types'

export default function ParametresPage() {
  const [agency, setAgency] = useState<Agency | null>(null)
  const [settings, setSettings] = useState<AgencySettings>({
    lunch_break_enabled: false,
    lunch_break_duration_minutes: 60,
    confidence_threshold: 0.85,
  })
  const [exportConfig, setExportConfig] = useState<ExportConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/agency')
      .then((r) => r.json())
      .then((j) => {
        if (j.agency) {
          setAgency(j.agency)
          setSettings(j.agency.settings)
          setExportConfig(j.agency.export_config)
        }
      })
  }, [])

  const save = async () => {
    setSaving(true)
    await fetch('/api/agency', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings, export_config: exportConfig }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-6 max-w-xl space-y-8">
      <h1 className="text-xl font-semibold text-gray-900">Paramètres agence</h1>

      {/* Extraction */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Extraction automatique</h2>
        <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Pause déjeuner automatique</p>
              <p className="text-xs text-gray-500">Déduit une pause de la durée de travail de chaque jour</p>
            </div>
            <button
              role="switch"
              aria-checked={settings.lunch_break_enabled}
              onClick={() =>
                setSettings((s) => ({ ...s, lunch_break_enabled: !s.lunch_break_enabled }))
              }
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                settings.lunch_break_enabled ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                  settings.lunch_break_enabled ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
          {settings.lunch_break_enabled && (
            <Input
              label="Durée de la pause (minutes)"
              type="number"
              min={0}
              max={120}
              value={settings.lunch_break_duration_minutes}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  lunch_break_duration_minutes: parseInt(e.target.value) || 0,
                }))
              }
            />
          )}
          <div>
            <label className="text-xs font-medium text-gray-600">
              Seuil de confiance ({Math.round(settings.confidence_threshold * 100)}%)
            </label>
            <p className="text-xs text-gray-400 mb-1">
              En dessous de ce seuil, un champ est marqué « à confirmer »
            </p>
            <input
              type="range"
              min={50}
              max={99}
              value={Math.round(settings.confidence_threshold * 100)}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  confidence_threshold: parseInt(e.target.value) / 100,
                }))
              }
              className="w-full"
            />
          </div>
        </div>
      </section>

      {/* Export CSV */}
      {exportConfig && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Format d'export CSV</h2>
          <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
            <div>
              <label className="text-xs font-medium text-gray-600">Séparateur</label>
              <select
                value={exportConfig.separator}
                onChange={(e) =>
                  setExportConfig((c) =>
                    c ? { ...c, separator: e.target.value as ExportConfig['separator'] } : c
                  )
                }
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
              >
                <option value=";">Point-virgule (;)</option>
                <option value=",">Virgule (,)</option>
                <option value={'\t'}>Tabulation</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Format des dates</label>
              <select
                value={exportConfig.date_format}
                onChange={(e) =>
                  setExportConfig((c) =>
                    c ? { ...c, date_format: e.target.value as ExportConfig['date_format'] } : c
                  )
                }
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
              >
                <option value="DD/MM/YYYY">JJ/MM/AAAA (31/12/2024)</option>
                <option value="YYYY-MM-DD">AAAA-MM-JJ (2024-12-31)</option>
                <option value="MM/DD/YYYY">MM/JJ/AAAA (12/31/2024)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Format des durées</label>
              <select
                value={exportConfig.duration_format}
                onChange={(e) =>
                  setExportConfig((c) =>
                    c
                      ? { ...c, duration_format: e.target.value as ExportConfig['duration_format'] }
                      : c
                  )
                }
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
              >
                <option value="decimal">Décimal (8,50)</option>
                <option value="HH:MM">Heures:Minutes (08:30)</option>
              </select>
            </div>
          </div>
        </section>
      )}

      <Button onClick={save} loading={saving}>
        {saved ? '✓ Enregistré' : 'Enregistrer les paramètres'}
      </Button>
    </div>
  )
}
