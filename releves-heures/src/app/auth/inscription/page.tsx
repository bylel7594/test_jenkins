'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function toSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

export default function InscriptionPage() {
  const router = useRouter()

  const [agencyName, setAgencyName] = useState('')
  const [agencySlug, setAgencySlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState<'gestionnaire' | 'responsable'>('gestionnaire')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAgencyNameChange = (value: string) => {
    setAgencyName(value)
    if (!slugEdited) {
      setAgencySlug(toSlug(value))
    }
  }

  const handleSlugChange = (value: string) => {
    setSlugEdited(true)
    setAgencySlug(value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (!agencySlug) {
      setError('Le slug de l\'agence est requis.')
      return
    }

    setLoading(true)
    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agency_name: agencyName,
        agency_slug: agencySlug,
        full_name: fullName,
        email,
        password,
        role,
      }),
    })

    const json = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(json.error ?? 'Une erreur est survenue.')
      return
    }

    router.push('/auth/connexion?inscrit=1')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Créer votre agence</h1>
          <p className="mt-1 text-sm text-gray-500">Commencez gratuitement — aucune carte requise</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <form onSubmit={submit} className="space-y-4">

            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold uppercase tracking-wide text-gray-400">Votre agence</legend>

              <Input
                label="Nom de l'agence"
                type="text"
                value={agencyName}
                onChange={(e) => handleAgencyNameChange(e.target.value)}
                placeholder="Agence Dupont Intérim"
                required
                autoFocus
              />

              <div>
                <Input
                  label="Identifiant unique (slug)"
                  type="text"
                  value={agencySlug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="agence-dupont"
                  required
                  pattern="[a-z0-9-]+"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Lettres minuscules, chiffres et tirets uniquement.
                </p>
              </div>
            </fieldset>

            <fieldset className="space-y-3 border-t border-gray-100 pt-4">
              <legend className="text-xs font-semibold uppercase tracking-wide text-gray-400">Votre compte</legend>

              <Input
                label="Nom complet"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jean Dupont"
                required
              />

              <Input
                label="Adresse e-mail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />

              <Input
                label="Mot de passe"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />

              <Input
                label="Confirmer le mot de passe"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Rôle</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'gestionnaire' | 'responsable')}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                >
                  <option value="gestionnaire">Gestionnaire de paie</option>
                  <option value="responsable">Responsable d'agence</option>
                </select>
              </div>
            </fieldset>

            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <Button type="submit" loading={loading} className="w-full" size="lg">
              Créer mon agence
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm text-gray-500">
          Déjà un compte ?{' '}
          <Link href="/auth/connexion" className="font-medium text-blue-600 hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}
