import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/timesheets/bulk-validate — valide en masse les relevés conformes
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { ids } = await request.json()
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'Aucun identifiant fourni' }, { status: 400 })
  }

  // Seuls les relevés au statut "conforme" peuvent être validés en masse
  const { data, error } = await supabase
    .from('timesheets')
    .update({
      status: 'valide',
      validated_by: user.id,
      validated_at: new Date().toISOString(),
    })
    .in('id', ids)
    .eq('status', 'conforme')
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ validated_count: data?.length ?? 0 })
}
