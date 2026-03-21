'use client'

import { useState, useTransition } from 'react'
import { deleteComment, updateComment } from './actions'

type Author = {
  full_name: string | null
  email: string
  avatar_url: string | null
} | null

export type CommentRow = {
  id: string
  content: string
  created_at: string
  user_id: string | null
  user_profiles: Author | Author[]
}

type Props = {
  comment: CommentRow
  sectionSlug: string
  articleSlug: string
  userId: string | undefined
  isAdmin: boolean
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return words[0].charAt(0).toUpperCase()
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase()
}

export function CommentItem({ comment, sectionSlug, articleSlug, userId, isAdmin }: Props) {
  const profileRaw = comment.user_profiles
  const author: Author = Array.isArray(profileRaw)
    ? (profileRaw[0] as Author) ?? null
    : (profileRaw as Author)

  const displayName = author?.full_name ?? author?.email ?? 'Anonym'
  const avatarUrl = author?.avatar_url ?? null
  const initials = getInitials(displayName)

  const canModify = !!(userId && (comment.user_id === userId || isAdmin))

  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(comment.content)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    if (!confirm('Opravdu smazat tento komentář?')) return
    const fd = new FormData()
    fd.set('comment_id', comment.id)
    fd.set('section_slug', sectionSlug)
    fd.set('article_slug', articleSlug)
    startTransition(async () => {
      const res = await deleteComment(fd)
      if (res?.error) setError(res.error)
    })
  }

  function handleUpdate() {
    if (editContent.trim().length < 2) { setError('Komentář je příliš krátký.'); return }
    const fd = new FormData()
    fd.set('comment_id', comment.id)
    fd.set('section_slug', sectionSlug)
    fd.set('article_slug', articleSlug)
    fd.set('content', editContent.trim())
    startTransition(async () => {
      const res = await updateComment(fd)
      if (res?.error) { setError(res.error); return }
      setEditing(false)
      setError(null)
    })
  }

  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div className="shrink-0 w-9 h-9 rounded-full overflow-hidden bg-green-700 flex items-center justify-center text-xs font-bold text-white select-none uppercase">
        {avatarUrl
          ? <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
          : initials
        }
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-sm font-medium text-gray-900">{displayName}</span>
          <time className="text-xs text-gray-400">
            {new Date(comment.created_at).toLocaleDateString('cs-CZ', {
              day: 'numeric', month: 'long', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </time>
          {canModify && !editing && (
            <span className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => { setEditing(true); setEditContent(comment.content) }}
                className="text-xs text-gray-400 hover:text-green-600 transition-colors"
              >
                Upravit
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                Smazat
              </button>
            </span>
          )}
        </div>

        {editing ? (
          <div className="space-y-2">
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-y"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleUpdate}
                disabled={isPending}
                className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {isPending ? 'Ukládám…' : 'Uložit'}
              </button>
              <button
                type="button"
                onClick={() => { setEditing(false); setError(null) }}
                className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
              >
                Zrušit
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{comment.content}</p>
        )}

        {!editing && error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    </div>
  )
}
