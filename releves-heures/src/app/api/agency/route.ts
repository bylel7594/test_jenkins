import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: userProfile } = await supabase
    .from('users')
    .select('agency_id')
    .eq('id', user.id)
    .single()
  if (!userProfile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

  const { data: agency } = await supabase
    .from('agencies')
    .select('*')
    .eq('id', userProfile.agency_id)
    .single()

  return NextResponse.json({ agency })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: userProfile } = await supabase
    .from('users')
    .select('agency_id, role')
    .eq('id', user.id)
    .single()
  if (!userProfile || userProfile.role !== 'responsable') {
    return NextResponse.json({ error: 'Droits insuffisants' }, { status: 403 })
  }

  const { settings, export_config } = await request.json()

  const { data, error } = await supabase
    .from('agencies')
    .update({ settings, export_config })
    .eq('id', userProfile.agency_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ agency: data })
}
