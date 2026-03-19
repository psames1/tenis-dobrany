'use client'

import { useState } from 'react'
import { addComment } from './actions'
import { Send } from 'lucide-react'

type Props = {
  pageId: string
  sectionSlug: string
  articleSlug: string
}

export function CommentForm({ pageId, sectionSlug, articleSlug }: Props) {
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (content.trim().length < 2) return
    setSubmitting(true)
    setError(null)
    setSuccess(false)

    const fd = new FormData()
    fd.append('page_id', pageId)
    fd.append('section_slug', sectionSlug)
    fd.append('article_slug', articleSlug)
    fd.append('content', content)

    const result = await addComment(fd)
    setSubmitting(false)

    if (result.error) {
      setError(result.error)
    } else {
      setContent('')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 4000)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
      <textarea
        value={content}
        onChange={e => { setContent(e.target.value); setSuccess(false) }}
        rows={3}
        maxLength={2000}
        placeholder="Napište komentář…"
        disabled={submitting}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-50"
      />
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-gray-400">{content.length}/2000</div>
        <div className="flex items-center gap-3">
          {error && <span className="text-xs text-red-600">{error}</span>}
          {success && <span className="text-xs text-green-600">✓ Komentář byl přidán.</span>}
          <button
            type="submit"
            disabled={submitting || content.trim().length < 2}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={14} />
            {submitting ? 'Odesílám…' : 'Přidat komentář'}
          </button>
        </div>
      </div>
    </form>
  )
}
