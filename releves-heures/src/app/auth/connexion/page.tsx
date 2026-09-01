'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

function ConnexionInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const justRegistered = searchParams.get('inscrit') === '1'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      setError('Identifiant ou mot de passe incorrect.')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Relevés d'heures</h1>
          <p className="mt-1 text-sm text-gray-500">Connectez-vous à votre agence</p>
        </div>

        {justRegistered && (
          <div className="mb-4 rounded-md bg-green-50 px-4 py-3 text-sm text-green-700 border border-green-200">
            Agence créée avec succès. Connectez-vous pour commencer.
          </div>
        )}

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <form onSubmit={signIn} className="space-y-4">
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
              autoComplete="current-password"
              required
            />
            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}
            <Button type="submit" loading={loading} className="w-full" size="lg">
              Se connecter
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm text-gray-500">
          Pas encore d'agence ?{' '}
          <Link href="/auth/inscription" className="font-medium text-blue-600 hover:underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function ConnexionPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-400">Chargement…</div>
    }>
      <ConnexionInner />
    </Suspense>
  )
}
