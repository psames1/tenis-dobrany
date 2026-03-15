'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, X, Clock } from 'lucide-react'
import { addArticleContributor, removeArticleContributor } from './contributors-actions'

export type ContributorRecord = {
  id: string
  email: string
  user_id: string | null
  user_profiles: { full_name: string | null } | null
}

type Props = {
  articleId: string
  contributors: ContributorRecord[]
}

export function ArticleContributors({ articleId, contributors }: Props) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleAdd = () => {
    if (!email.trim()) return
    setError(null)
    startTransition(async () => {
      const result = await addArticleContributor(articleId, email.trim())
      if (result.error) {
        setError(result.error)
      } else {
        setEmail('')
        router.refresh()
      }
    })
  }

  const handleRemove = (id: string) => {
    startTransition(async () => {
      await removeArticleContributor(id)
      router.refresh()
    })
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <UserPlus size={15} className="text-gray-500" />
        <span className="text-sm font-medium text-gray-700">Spoluautoři</span>
      </div>

      {/* Přidat spoluautora */}
      <div className="flex gap-2 mb-3">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
          placeholder="email@example.com"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          disabled={isPending}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={isPending || !email.trim()}
          className="px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-40 whitespace-nowrap"
        >
          {isPending ? 'Přidávám…' : 'Přidat'}
        </button>
      </div>

      {error && (
        <p className="mb-2 text-xs text-red-600">{error}</p>
      )}

      {/* Seznam spoluautorů */}
      {contributors.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">Žádní spoluautoři. Přidejte email výše.</p>
      ) : (
        <ul className="space-y-1.5">
          {contributors.map(c => (
            <li key={c.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
              <div className="min-w-0">
                {c.user_profiles?.full_name ? (
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {c.user_profiles.full_name}
                  </div>
                ) : null}
                <div className="text-xs text-gray-500 truncate">{c.email}</div>
                {!c.user_id && (
                  <div className="flex items-center gap-1 mt-0.5 text-xs text-amber-600">
                    <Clock size={10} />
                    Čeká na registraci
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleRemove(c.id)}
                disabled={isPending}
                className="ml-2 shrink-0 p-1 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-40"
                title="Odebrat spoluautora"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 text-xs text-gray-400">
        Spoluautor může upravit obsah a galerii tohoto článku z členské sekce.
        Pokud nemá účet, dostane pozvánku emailem.
      </p>
    </div>
  )
}
