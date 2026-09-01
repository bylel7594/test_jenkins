import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { TimesheetStatus } from '@/types'

// GET /api/timesheets/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data, error } = await supabase
    .from('timesheets')
    .select('*, timesheet_lines(*)')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ timesheet: data })
}

// PATCH /api/timesheets/[id] — correction des données
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await request.json()

  // Sépare les champs de header, les lignes, et l'action de validation
  const { lines, validate, ...headerFields } = body

  // Récupère la version actuelle pour le journal des corrections
  const { data: current } = await supabase
    .from('timesheets')
    .select('*')
    .eq('id', id)
    .single()

  if (!current) return NextResponse.json({ error: 'Relevé introuvable' }, { status: 404 })

  // Enregistre les corrections dans le journal d'audit
  const corrections: Array<{
    timesheet_id: string
    agency_id: string
    field_path: string
    old_value: string | null
    new_value: string | null
    corrected_by: string
  }> = []

  for (const [key, value] of Object.entries(headerFields)) {
    const oldValue = current[key as keyof typeof current]
    if (oldValue !== value) {
      corrections.push({
        timesheet_id: id,
        agency_id: current.agency_id,
        field_path: key,
        old_value: oldValue !== null && oldValue !== undefined ? String(oldValue) : null,
        new_value: value !== null && value !== undefined ? String(value) : null,
        corrected_by: user.id,
      })
    }
  }

  if (corrections.length > 0) {
    await supabase.from('corrections').insert(corrections)
  }

  // Met à jour les champs header
  const updateData: Record<string, unknown> = { ...headerFields }

  // Si des lignes sont fournies, les met à jour
  if (lines) {
    for (const line of lines) {
      const { id: lineId, ...lineFields } = line
      await supabase
        .from('timesheet_lines')
        .update(lineFields)
        .eq('id', lineId)
        .eq('timesheet_id', id)
    }
  }

  // Recalcule le total calculé
  const { data: updatedLines } = await supabase
    .from('timesheet_lines')
    .select('calculated_hours')
    .eq('timesheet_id', id)

  const newCalculatedTotal = updatedLines?.reduce(
    (sum, l) => sum + (l.calculated_hours ?? 0),
    0
  ) ?? 0

  updateData.calculated_total_hours = Math.round(newCalculatedTotal * 100) / 100

  // Validation : l'humain valide explicitement
  if (validate === true) {
    updateData.status = 'valide' as TimesheetStatus
    updateData.validated_by = user.id
    updateData.validated_at = new Date().toISOString()
  } else {
    // Recalcule le statut automatiquement après correction
    const handwritten = (headerFields.handwritten_total_hours as number | undefined) ?? current.handwritten_total_hours
    if (handwritten !== null && Math.abs(handwritten - newCalculatedTotal) > 0.01) {
      updateData.status = 'ecart'
    } else {
      updateData.status = 'conforme'
    }
  }

  const { data, error } = await supabase
    .from('timesheets')
    .update(updateData)
    .eq('id', id)
    .select('*, timesheet_lines(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ timesheet: data })
}

// POST /api/timesheets/[id]/validate — validation en masse via URL différente
// La validation unitaire passe par PATCH avec { validate: true }
