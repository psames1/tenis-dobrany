'use client'

import { saveArticle } from '../actions'

type Section = { id: string; slug: string; title: string }

type Article = {
  id: string
  title: string
  slug: string
  section_id: string | null
  excerpt: string | null
  content: string | null
  image_url: string | null
  is_active: boolean
  is_members_only: boolean
  published_at: string
}

type Props = {
  sections: Section[]
  article?: Article
}

export function ArticleForm({ sections, article }: Props) {
  const isEdit = !!article
  const publishedDate = article?.published_at
    ? new Date(article.published_at).toISOString().slice(0, 16)
    : new Date().toISOString().slice(0, 16)

  return (
    <form action={saveArticle} className="space-y-5">
      {isEdit && <input type="hidden" name="id" value={article.id} />}

      {/* Název */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="title">
          Název *
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          defaultValue={article?.title ?? ''}
          placeholder="Název článku"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>

      {/* Sekce */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="section_id">
          Sekce *
        </label>
        <select
          id="section_id"
          name="section_id"
          required
          defaultValue={article?.section_id ?? ''}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
        >
          <option value="">— vyberte sekci —</option>
          {sections.map(s => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </select>
      </div>

      {/* Perex */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="excerpt">
          Perex (krátký popis)
        </label>
        <textarea
          id="excerpt"
          name="excerpt"
          rows={3}
          defaultValue={article?.excerpt ?? ''}
          placeholder="Krátký popis pro výpis článků…"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
        />
      </div>

      {/* Obsah */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="content">
          Obsah (HTML)
        </label>
        <textarea
          id="content"
          name="content"
          rows={14}
          defaultValue={article?.content ?? ''}
          placeholder="<p>Obsah článku…</p>"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-y"
        />
        <p className="mt-1 text-xs text-gray-400">Obsah se uloží jako HTML. V budoucnu bude přidán rich-text editor.</p>
      </div>

      {/* URL obrázku */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="image_url">
          URL náhledového obrázku
        </label>
        <input
          id="image_url"
          name="image_url"
          type="url"
          defaultValue={article?.image_url ?? ''}
          placeholder="https://..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>

      {/* Datum publikace */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="published_at">
          Datum publikace
        </label>
        <input
          id="published_at"
          name="published_at"
          type="datetime-local"
          defaultValue={publishedDate}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>

      {/* Přepínače */}
      <div className="flex flex-wrap gap-6 py-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            name="is_active"
            value="1"
            defaultChecked={article?.is_active ?? true}
            className="w-4 h-4 accent-green-600"
          />
          <span className="text-sm text-gray-700">Aktivní (zobrazit na webu)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            name="is_members_only"
            value="1"
            defaultChecked={article?.is_members_only ?? false}
            className="w-4 h-4 accent-green-600"
          />
          <span className="text-sm text-gray-700">Pouze pro přihlášené členy</span>
        </label>
      </div>

      {/* Tlačítka */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          className="px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
        >
          {isEdit ? 'Uložit změny' : 'Vytvořit článek'}
        </button>
        <a
          href="/admin/clanky"
          className="px-5 py-2 bg-white border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          Zrušit
        </a>
      </div>
    </form>
  )
}
