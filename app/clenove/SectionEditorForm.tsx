'use client'

import { useState, useRef } from 'react'
import { RichTextEditor } from '@/components/editor/RichTextEditor'
import { createSectionArticle } from './actions'

type Props = {
  sectionId: string
  sectionSlug: string
  sectionTitle: string
}

export function SectionEditorForm({ sectionId, sectionSlug, sectionTitle }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <form
      ref={formRef}
      action={createSectionArticle}
      onSubmit={() => setSubmitting(true)}
      className="space-y-6 bg-white rounded-xl border border-gray-200 p-6"
    >
      <input type="hidden" name="section_id"   value={sectionId} />
      <input type="hidden" name="section_slug" value={sectionSlug} />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Název článku <span className="text-red-500">*</span>
        </label>
        <input
          name="title" type="text" required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder={`Článek v sekci ${sectionTitle}…`}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Perex (krátký úvod)</label>
        <textarea
          name="excerpt" rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          placeholder="Stručné shrnutí článku…"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Obsah článku</label>
        <RichTextEditor name="content" defaultValue="" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Viditelnost</label>
        <select
          name="visibility"
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
        >
          <option value="public">Veřejný — vidí všichni</option>
          <option value="member">Přihlášení členové</option>
        </select>
      </div>

      <div className="flex gap-3 pt-2 border-t border-gray-100">
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60"
        >
          {submitting ? 'Ukládám…' : 'Publikovat článek'}
        </button>
        <a
          href={`/${sectionSlug}`}
          className="px-4 py-2 text-gray-500 text-sm rounded-lg hover:bg-gray-100 transition-colors"
        >
          Zrušit
        </a>
      </div>
    </form>
  )
}
