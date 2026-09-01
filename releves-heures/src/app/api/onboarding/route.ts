import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const schema = z.object({
  agency_name: z.string().min(2).max(100),
  agency_slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Slug invalide (lettres minuscules, chiffres, tirets)'),
  full_name: z.string().min(2).max(100),
  email: z.string().email('Adresse e-mail invalide'),
  password: z.string().min(8, 'Mot de passe trop court (8 caractères min.)'),
  role: z.enum(['gestionnaire', 'responsable']),
})

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Données invalides.'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const { agency_name, agency_slug, full_name, email, password, role } = parsed.data
  const supabase = createAdminClient()

  // Vérification unicité du slug
  const { data: existing } = await supabase
    .from('agencies')
    .select('id')
    .eq('slug', agency_slug)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Ce slug est déjà utilisé. Choisissez-en un autre.' }, { status: 409 })
  }

  // Création de l'agence
  const { data: agency, error: agencyError } = await supabase
    .from('agencies')
    .insert({ name: agency_name, slug: agency_slug })
    .select()
    .single()

  if (agencyError || !agency) {
    return NextResponse.json({ error: 'Erreur lors de la création de l\'agence.' }, { status: 500 })
  }

  // Création du compte auth (e-mail confirmé automatiquement)
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    await supabase.from('agencies').delete().eq('id', agency.id)
    const msg = authError?.message?.includes('already registered')
      ? 'Cette adresse e-mail est déjà utilisée.'
      : 'Erreur lors de la création du compte.'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // Création du profil utilisateur
  const { error: profileError } = await supabase.from('users').insert({
    id: authData.user.id,
    agency_id: agency.id,
    role,
    full_name,
  })

  if (profileError) {
    await supabase.auth.admin.deleteUser(authData.user.id)
    await supabase.from('agencies').delete().eq('id', agency.id)
    return NextResponse.json({ error: 'Erreur lors de la création du profil.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
