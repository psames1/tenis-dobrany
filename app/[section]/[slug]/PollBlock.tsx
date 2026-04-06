'use client'

import { useTransition, useState } from 'react'
import { BarChart2, ChevronDown, ChevronUp, User } from 'lucide-react'
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

function getInitials(name: string | null): string {
  if (!name?.trim()) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Kolečko s iniciálami a tooltip při najetí */
function VoterAvatar({ voter }: { voter: Voter }) {
  const initials = getInitials(voter.name)
  const hasNote = !!voter.note?.trim()
  return (
    <div className="relative group">
      <div className="w-8 h-8 rounded-full bg-green-100 border border-green-200 flex items-center justify-center text-xs font-semibold text-green-800 cursor-default select-none shrink-0">
        {voter.name ? initials : <User size={14} className="text-green-600" />}
      </div>
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 pointer-events-none">
        <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl w-max max-w-[200px]">
          <p className="font-medium leading-snug">{voter.name ?? 'Anonym'}</p>
          {hasNote && (
            <p className="text-gray-300 mt-1 leading-snug italic">„{voter.note}"</p>
          )}
          {/* Šipka dolů */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      </div>
    </div>
  )
}

export function PollBlock({ pageId, question, options, allowMultiple, userId, sectionSlug, articleSlug }: Props) {
  const [isPending, startTransition] = useTransition()
  const [localError, setLocalError] = useState<string | null>(null)
  const [pendingVoteId, setPendingVoteId] = useState<string | null>(null)
  const [pendingNote, setPendingNote] = useState('')
  const [showVoters, setShowVoters] = useState(false)

  const totalVotes = options.reduce((sum, o) => sum + o.voters.length, 0)
  const myVoteIds = new Set(
    options.filter(o => o.voters.some(v => v.user_id === userId)).map(o => o.id)
  )

  function handleOptionClick(optionId: string) {
    if (!userId || isPending) return
    if (myVoteIds.has(optionId)) {
      submitVote(optionId, '', true)
      return
    }
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

  return (
    <div className={`mt-10 pt-6 border-t border-gray-100 ${isPending ? 'opacity-70 pointer-events-none' : ''}`}>
      <h2 className="flex items-center gap-2 text-base font-semibold text-gray-800 mb-1">
        <BarChart2 size={16} className="text-gray-400" />
        Anketa
      </h2>

      {question && <p className="text-sm text-gray-700 mb-4">{question}</p>}
      {allowMultiple && <p className="text-xs text-gray-400 mb-3">Lze zaškrtnout více možností.</p>}

      <div className="space-y-2">
        {options.map(opt => {
          const isVoted = myVoteIds.has(opt.id)
          const count = opt.voters.length
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
                {/* Progress bar na pozadí */}
                {totalVotes > 0 && (
                  <div
                    className={`absolute inset-y-0 left-0 transition-all duration-500 rounded-xl ${isVoted ? 'bg-green-100' : 'bg-gray-100'}`}
                    style={{ width: `${Math.round((count / totalVotes) * 100)}%` }}
                  />
                )}

                <div className="relative px-4 py-3 flex items-center gap-3">
                  {/* Checkbox indikátor */}
                  <div className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors
                    ${isVoted ? 'border-green-500 bg-green-500' : isPendingThis ? 'border-green-300' : 'border-gray-300'}
                  `}>
                    {isVoted && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                    )}
                  </div>

                  {/* Název volby */}
                  <span className={`flex-1 text-sm font-medium ${isVoted ? 'text-green-800' : 'text-gray-800'}`}>
                    {opt.label}
                  </span>

                  {/* Počet — jen číslo */}
                  <span className={`shrink-0 text-sm font-semibold tabular-nums ${isVoted ? 'text-green-700' : 'text-gray-500'}`}>
                    {count}
                  </span>
                </div>
              </button>

              {/* Inline formulář pro poznámku */}
              {isPendingThis && (
                <div className="mt-1 ml-1 p-3 bg-green-50 border border-green-200 rounded-xl">
                  <p className="text-xs text-green-700 font-medium mb-2">Volitelně přidejte poznámku:</p>
                  <textarea
                    value={pendingNote}
                    onChange={e => setPendingNote(e.target.value)}
                    placeholder="Váš komentář… (nepovinné)"
                    maxLength={500}
                    rows={2}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
                  />
                  <div className="flex gap-2 mt-2">
                    <button type="button" onClick={() => submitVote(opt.id, pendingNote, false)}
                      className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">
                      Potvrdit hlas
                    </button>
                    <button type="button" onClick={() => { setPendingVoteId(null); setPendingNote('') }}
                      className="px-4 py-1.5 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">
                      Zrušit
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Celkový součet */}
      {totalVotes > 0 && (
        <p className="mt-3 text-xs text-gray-400">Celkem: {totalVotes}</p>
      )}

      {!userId && (
        <p className="mt-4 text-sm text-gray-400">
          Pro hlasování se{' '}
          <a href="/login" className="text-green-600 hover:underline">přihlaste</a>.
        </p>
      )}

      {localError && <p className="mt-3 text-sm text-red-500">{localError}</p>}

      {/* Panel hlasujících — avatary s iniciálami */}
      {totalVotes > 0 && (
        <div className="mt-5 border border-gray-100 rounded-xl overflow-visible">
          <button
            type="button"
            onClick={() => setShowVoters(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors rounded-xl"
          >
            <span>Kdo hlasoval ({totalVotes})</span>
            {showVoters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showVoters && (
            <div className="border-t border-gray-100 px-4 py-3 space-y-3">
              {options.filter(o => o.voters.length > 0).map(opt => (
                <div key={opt.id}>
                  <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                    {opt.label}
                    <span className="ml-1.5 font-normal normal-case">({opt.voters.length})</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {opt.voters.map((v, i) => (
                      <VoterAvatar key={`${opt.id}-${i}`} voter={v} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
