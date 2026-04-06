'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      // Po kliknutí na odkaz v emailu Supabase přesměruje na /callback?type=recovery
      // Callback vymění kód za session a přesměruje na /clenove/profil kde si uživatel
      // nastaví nové heslo přes formulář "Nastavit heslo".
      redirectTo: `${window.location.origin}/callback?type=recovery`,
    })

    setLoading(false)

    if (resetError) {
      setError(resetError.message)
      return
    }

    setSent(true)
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-lg px-8 py-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-600 mb-4">
            <svg viewBox="0 0 24 24" className="h-8 w-8 text-white" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Zapomenuté heslo</h1>
          <p className="text-sm text-gray-500 mt-1">Pošleme vám odkaz pro nastavení nového hesla.</p>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-gray-700 font-medium mb-2">Email odeslán</p>
            <p className="text-sm text-gray-500">
              Pokud je e-mail <strong>{email}</strong> registrován, do chvilky přijde odkaz pro nastavení hesla.
              Zkontrolujte také složku nevyžádané pošty (spam).
            </p>
            <a
              href="/login"
              className="mt-6 inline-block text-sm text-green-600 hover:underline"
            >
              ← Zpět na přihlášení
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={loading}
                placeholder="vas@email.cz"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-50 transition"
              />
            </div>

            {error && (
              <div role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-2.5 px-4 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Odesílám…' : 'Odeslat odkaz'}
            </button>

            <p className="text-center text-sm text-gray-400">
              <a href="/login" className="text-green-600 hover:underline">
                ← Zpět na přihlášení
              </a>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
