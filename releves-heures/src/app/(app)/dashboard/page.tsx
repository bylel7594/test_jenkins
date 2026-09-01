import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { CheckCircle, AlertTriangle, AlertCircle, Clock, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { statusLabel } from '@/lib/utils'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: counts } = await supabase
    .from('timesheets')
    .select('status')
    .neq('status', 'processing')

  const grouped = (counts ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1
    return acc
  }, {})

  const { data: activeBatches } = await supabase
    .from('batches')
    .select('id, original_filename, total_pages, processed_pages, status, created_at')
    .eq('status', 'processing')
    .order('created_at', { ascending: false })
    .limit(5)

  const stats = [
    {
      label: 'À confirmer',
      value: grouped['a_confirmer'] ?? 0,
      icon: AlertCircle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      href: '/file-attente?status=a_confirmer',
    },
    {
      label: 'Écart',
      value: grouped['ecart'] ?? 0,
      icon: AlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-50',
      href: '/file-attente?status=ecart',
    },
    {
      label: 'Conformes',
      value: grouped['conforme'] ?? 0,
      icon: CheckCircle,
      color: 'text-green-600',
      bg: 'bg-green-50',
      href: '/file-attente?status=conforme',
    },
    {
      label: 'Validés',
      value: grouped['valide'] ?? 0,
      icon: CheckCircle,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      href: '/file-attente?status=valide',
    },
  ]

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Tableau de bord</h1>
        <Link href="/depot">
          <Button>
            <Upload className="h-4 w-4" />
            Déposer des relevés
          </Button>
        </Link>
      </div>

      {/* Compteurs */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Link key={stat.label} href={stat.href}>
              <div className={`rounded-lg border border-gray-200 ${stat.bg} p-4 hover:shadow-sm transition-shadow`}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                  <span className="text-xs font-medium text-gray-600">{stat.label}</span>
                </div>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Traitements en cours */}
      {activeBatches && activeBatches.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Traitements en cours</h2>
          <div className="space-y-2">
            {activeBatches.map((batch) => {
              const progress = batch.total_pages
                ? Math.round((batch.processed_pages / batch.total_pages) * 100)
                : 0
              return (
                <div key={batch.id} className="rounded-lg border border-gray-200 bg-white p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-gray-400 animate-spin" />
                      <span className="text-sm text-gray-700">{batch.original_filename}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {batch.processed_pages}/{batch.total_pages ?? '?'} pages
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-gray-100">
                    <div
                      className="h-1.5 rounded-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Raccourcis */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Accès rapides</h2>
        <div className="flex gap-3">
          <Link href="/file-attente">
            <Button variant="secondary" size="sm">
              Traiter la file d'attente
            </Button>
          </Link>
          <Link href="/file-attente?status=conforme">
            <Button variant="secondary" size="sm">
              Valider les conformes
            </Button>
          </Link>
          <Link href="/export">
            <Button variant="secondary" size="sm">
              Exporter vers la paie
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
