'use client'

import { useTransition, useState } from 'react'
import { BarChart2, ChevronDown, ChevronUp } from 'lucide-react'
import { castPollVote } from './actions'

type Voter = {
  user_id: string
  name: string | null
  voted_at: string
  note: string | null
}

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

function formatVotedAt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function PollBlock({ pageId, question, options, allowMultiple, userId, sectionSlug, articleSlug }: Props) {
  const [isPending, startTransition] = useTransition()
  const [localError, setLocalError] = useState<string | null>(null)
  // pendingVoteId: option pro které čekáme potvrzení (s volitelnou poznámkou)
  const [pendingVoteId, setPendingVoteId] = useState<string | null>(null)
  const [pendingNote, setPendingNote] = useState('')
  // Sbalení/rozbalení panelu hlasujících
  const [showVoters, setShowVoters] = useState(false)

  const totalVotes = options.reduce((sum, o) => sum + o.voters.length, 0)
  const myVoteIds = new Set(
    options.filter(o => o.voters.some(v => v.user_id === userId)).map(o => o.id)
  )

  function handleOptionClick(optionId: string) {
    if (!userId || isPending) return
    const isVoted = myVoteIds.has(optionId)

    if (isVoted) {
      // Klik na již zvolenou = odvolání (bez poznámky, rovnou submit)
      submitVote(optionId, '', true)
      return
    }
    // Nový hlas: zobrazit inline formulář pro poznámku
    setPendingVoteId(optionId)
    setPendingNote('')
  }

  function submitVote(optionId: string, note: string, unvote: boolean) {
    setLocalError(null)
    const fd = new FormData()
    fd.set('page_id', pageId)
    fd.set('option_id', optionId)
    fd.set('section_slug', sectionSlug)
    fd.set('article_slug', articleSlug)
    fd.set('allow_multiple', allowMultiple ? '1' : '0')
    if (unvote) fd.set('unvote', '1')
    if (note.trim()) fd.set('note', note.trim())

    startTransition(async () => {
      const result = await castPollVote(fd)
      if (result?.error) setLocalError(result.error)
      setPendingVoteId(null)
      setPendingNote('')
    })
  }

  // Všichni hlasující (pro panel „Kdo hlasoval")
  const allVoters = options
    .flatMap(opt => opt.voters.map(v => ({ ...v, optionLabel: opt.label })))
    .sort((a, b) => new Date(a.voted_at).getTime() - new Date(b.voted_at).getTime())

  return (
    <div className={`mt-10 pt-6 border-t border-gray-100 ${isPending ? 'opacity-70 pointer-events-none' : ''}`}>
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
          const isPendingThis = pendingVoteId === opt.id

          return (
            <div key={opt.id}>
              <button
                type="button"
                disabled={!userId || isPending || (!!pendingVoteId && !isPendingThis)}
                onClick={() => handleOptionClick(opt.id)}
                className={`w-full text-left relative rounded-xl border overflow-hidden transition-all
                  ${userId && (!pendingVoteId || isPendingThis) ? 'cursor-pointer hover:border-green-400' : 'cursor-default'}
                  ${isVoted
                    ? 'border-green-400 bg-green-50'
                    : isPendingThis
                      ? 'border-green-300 bg-green-50/50'
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
                    ${isVoted ? 'border-green-500 bg-green-500' : isPendingThis ? 'border-green-300' : 'border-gray-300'}
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

              {/* Inline formulář pro poznámku */}
              {isPendingThis && (
                <div className="mt-1 ml-1 p-3 bg-green-50 border border-green-200 rounded-xl">
                  <p className="text-xs text-green-700 font-medium mb-2">
                    Volitelně přidejte poznámku k hlasu:
                  </p>
                  <textarea
                    value={pendingNote}
                    onChange={e => setPendingNote(e.target.value)}
                    placeholder="Váš komentář… (nepovinné)"
                    maxLength={500}
                    rows={2}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => submitVote(opt.id, pendingNote, false)}
                      className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                    >
                      Potvrdit hlas
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPendingVoteId(null); setPendingNote('') }}
                      className="px-4 py-1.5 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                    >
                      Zrušit
                    </button>
                  </div>
                </div>
              )}
            </div>
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

      {/* Panel „Kdo hlasoval" */}
      {totalVotes > 0 && (
        <div className="mt-5 border border-gray-100 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowVoters(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <span>Kdo hlasoval ({totalVotes})</span>
            {showVoters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showVoters && (
            <div className="divide-y divide-gray-100 border-t border-gray-100">
              {allVoters.map((v, i) => (
                <div key={i} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-gray-800">
                        {v.name ?? 'Anonym'}
                      </span>
                      <span className="ml-2 text-xs text-gray-400">
                        → {v.optionLabel}
                      </span>
                    </div>
                    <time className="shrink-0 text-xs text-gray-400">
                      {formatVotedAt(v.voted_at)}
                    </time>
                  </div>
                  {v.note && (
                    <p className="mt-1 text-xs text-gray-600 italic pl-0.5">
                      „{v.note}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
