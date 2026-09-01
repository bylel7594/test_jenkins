import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/timesheets — liste les relevés avec filtres
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const week = searchParams.get('week') // YYYY-Www
  const search = searchParams.get('search')
  const limit = parseInt(searchParams.get('limit') ?? '100')
  const offset = parseInt(searchParams.get('offset') ?? '0')

  let query = supabase
    .from('timesheets')
    .select('*, timesheet_lines(*)', { count: 'exact' })
    .order('status', { ascending: true }) // a_confirmer avant ecart avant conforme avant valide
    .range(offset, offset + limit - 1)

  if (status) {
    query = query.eq('status', status)
  }
  if (search) {
    query = query.or(
      `interim_name.ilike.%${search}%,client_company.ilike.%${search}%`
    )
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ timesheets: data, total: count })
}
