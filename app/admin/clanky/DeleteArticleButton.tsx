'use client'

import { deleteArticle } from '../actions'

export function DeleteArticleButton({ id, title }: { id: string; title: string }) {
  return (
    <form
      action={deleteArticle}
      onSubmit={(e) => {
        if (!confirm(`Smazat „${title}"?`)) e.preventDefault()
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors"
      >
        Smazat
      </button>
    </form>
  )
}
