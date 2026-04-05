'use client'

import { useTransition, useState } from 'react'
import { BarChart2 } from 'lucide-react'
import { castPollVote } from './actions'

type Voter = { user_id: string; name: string | null }

type PollOption = {
  id: string
  label: string
  voters: Voter[]
}

type Props = {
  pageId: string
  question: string | null
  options: PollOption[]
  allowMultiple: boolean
  userId: string | null
  sectionSlug: string
  articleSlug: string
}

export function PollBlock({ pageId, question, options, allowMultiple, userId, sectionSlug, articleSlug }: Props) {
  const [isPending, startTransition] = useTransition()
  const [localError, setLocalError] = useState<string | null>(null)

  const totalVotes = options.reduce((sum, o) => sum + o.voters.length, 0)
  const myVoteIds = new Set(
    options.filter(o => o.voters.some(v => v.user_id === userId)).map(o => o.id)
  )

  function vote(optionId: string) {
    if (!userId || isPending) return
    setLocalError(null)
    const isVoted = myVoteIds.has(optionId)

    const fd = new FormData()
    fd.set('page_id', pageId)
    fd.set('option_id', optionId)
    fd.set('section_slug', sectionSlug)
    fd.set('article_slug', articleSlug)
    fd.set('allow_multiple', allowMultiple ? '1' : '0')
    // Single-choice: klik na již zvolenou = odvolat; multi: server rozhodne
    if (!allowMultiple && isVoted) fd.set('unvote', '1')

    startTransition(async () => {
      const result = await castPollVote(fd)
      if (result?.error) setLocalError(result.error)
    })
  }

  return (
    <div className={`mt-10 pt-6 border-t border-gray-100 ${isPending ? 'opacity-70' : ''}`}>
      <h2 className="flex items-center gap-2 text-base font-semibold text-gray-800 mb-1">
        <BarChart2 size={16} className="text-gray-400" />
        Anketa
      </h2>

      {question && (
        <p className="text-sm text-gray-700 mb-4">{question}</p>
      )}

      {allowMultiple && (
        <p className="text-xs text-gray-400 mb-3">Lze zaškrtnout více možností.</p>
      )}

      <div className="space-y-2">
        {options.map(opt => {
          const isVoted = myVoteIds.has(opt.id)
          const pct = totalVotes > 0 ? Math.round((opt.voters.length / totalVotes) * 100) : 0
          const voterNames = opt.voters.map(v => v.name ?? 'Anonym')

          return (
            <button
              key={opt.id}
              type="button"
              disabled={!userId || isPending}
              onClick={() => vote(opt.id)}
              className={`w-full text-left relative rounded-xl border overflow-hidden transition-all
                ${userId ? 'cursor-pointer hover:border-green-400' : 'cursor-default'}
                ${isVoted
                  ? 'border-green-400 bg-green-50'
                  : 'border-gray-200 bg-white hover:bg-gray-50'}
              `}
            >
              {/* Progress bar */}
              <div
                className={`absolute inset-y-0 left-0 transition-all duration-500 rounded-xl ${isVoted ? 'bg-green-100' : 'bg-gray-100'}`}
                style={{ width: `${pct}%` }}
              />

              <div className="relative px-4 py-3 flex items-center gap-3">
                {/* Checkbox / radio indicator */}
                <div className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors
                  ${isVoted ? 'border-green-500 bg-green-500' : 'border-gray-300'}
                `}>
                  {isVoted && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                  )}
                </div>

                {/* Label + voters */}
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-medium ${isVoted ? 'text-green-800' : 'text-gray-800'}`}>
                    {opt.label}
                  </span>
                  {voterNames.length > 0 && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {voterNames.join(', ')}
                    </p>
                  )}
                </div>

                {/* Počet hlasů + % */}
                <div className="shrink-0 text-right">
                  <span className={`text-sm font-semibold ${isVoted ? 'text-green-700' : 'text-gray-600'}`}>
                    {opt.voters.length > 0 ? `${pct} %` : '—'}
                  </span>
                  <p className="text-xs text-gray-400">
                    {opt.voters.length === 0 ? 'žádný hlas' : opt.voters.length === 1 ? '1 hlas' : `${opt.voters.length} hlasy`}
                  </p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {totalVotes > 0 && (
        <p className="mt-3 text-xs text-gray-400">
          Celkem {totalVotes === 1 ? '1 hlas' : `${totalVotes} hlasů`}
        </p>
      )}

      {!userId && (
        <p className="mt-4 text-sm text-gray-400">
          Pro hlasování se{' '}
          <a href="/login" className="text-green-600 hover:underline">přihlaste</a>.
        </p>
      )}

      {localError && (
        <p className="mt-3 text-sm text-red-500">{localError}</p>
      )}
    </div>
  )
}
