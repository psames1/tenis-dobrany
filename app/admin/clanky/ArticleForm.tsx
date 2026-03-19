'use client'

import { useState, useRef } from 'react'
import { saveArticle } from '../actions'
import { RichTextEditor } from '@/components/editor/RichTextEditor'
import { createClient } from '@/lib/supabase/client'
import { ImageIcon, ImagePlus, X } from 'lucide-react'
import { ArticleContributors, type ContributorRecord } from './ArticleContributors'

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
  show_in_menu: boolean
  sort_order: number
  published_at: string
}

type GalleryImage = {
  id: string
  public_url: string
  alt_text: string | null
  sort_order: number
}

type LocalGalleryImg = { url: string }

type Props = {
  sections: Section[]
  article?: Article
  galleryImages?: GalleryImage[]
  contributors?: ContributorRecord[]
}

async function uploadGalleryImage(file: File): Promise<string> {
  const supabase = createClient()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `galleries/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage
    .from('images')
    .upload(path, file, { cacheControl: '31536000', upsert: false })
  if (error) throw new Error(error.message)
  return supabase.storage.from('images').getPublicUrl(path).data.publicUrl
}

async function uploadCoverImage(file: File): Promise<string> {
  const supabase = createClient()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `covers/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage
    .from('images')
    .upload(path, file, { cacheControl: '31536000', upsert: false })
  if (error) throw new Error(error.message)
  return supabase.storage.from('images').getPublicUrl(path).data.publicUrl
}

export function ArticleForm({ sections, article, galleryImages, contributors }: Props) {
  const isEdit = !!article
  const publishedDate = article?.published_at
    ? new Date(article.published_at).toISOString().slice(0, 16)
    : new Date().toISOString().slice(0, 16)

  const [coverUrl, setCoverUrl] = useState(article?.image_url ?? '')
  const [coverUploading, setCoverUploading] = useState(false)
  const [coverError, setCoverError] = useState<string | null>(null)
  const coverFileRef = useRef<HTMLInputElement>(null)

  const [gallery, setGallery] = useState<LocalGalleryImg[]>(
    (galleryImages ?? []).map(g => ({ url: g.public_url }))
  )
  const [galleryUploading, setGalleryUploading] = useState(false)
  const [galleryError, setGalleryError] = useState<string | null>(null)
  const galleryFileRef = useRef<HTMLInputElement>(null)

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setGalleryUploading(true)
    setGalleryError(null)
    try {
      const uploaded: string[] = []
      for (const file of files) {
        uploaded.push(await uploadGalleryImage(file))
      }
      setGallery(prev => [...prev, ...uploaded.map(url => ({ url }))])
    } catch (err: unknown) {
      setGalleryError(err instanceof Error ? err.message : 'Chyba při nahrávání fotek.')
    } finally {
      setGalleryUploading(false)
      e.target.value = ''
    }
  }

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverUploading(true)
    setCoverError(null)
    try {
      const url = await uploadCoverImage(file)
      setCoverUrl(url)
    } catch {
      setCoverError('Nepodařilo se nahrát obrázek.')
    } finally {
      setCoverUploading(false)
      e.target.value = ''
    }
  }

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
          Perex (krátký popis pro výpis)
        </label>
        <textarea
          id="excerpt"
          name="excerpt"
          rows={3}
          defaultValue={article?.excerpt ?? ''}
          placeholder="Krátký popis zobrazený ve výpisu článků…"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
        />
      </div>

      {/* Náhledový obrázek */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Náhledový obrázek (cover)
        </label>
        <div className="flex gap-3 items-start">
          {/* Preview */}
          {coverUrl ? (
            <div className="relative shrink-0">
              <img
                src={coverUrl}
                alt="Náhled"
                className="w-32 h-20 object-cover rounded-lg border border-gray-200"
              />
              <button
                type="button"
                onClick={() => setCoverUrl('')}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                title="Odebrat obrázek"
              >
                <X size={11} />
              </button>
            </div>
          ) : (
            <div className="w-32 h-20 bg-gray-100 rounded-lg border border-dashed border-gray-300 flex items-center justify-center shrink-0">
              <ImageIcon size={20} className="text-gray-400" />
            </div>
          )}

          {/* URL + upload */}
          <div className="flex-1 space-y-2">
            <input
              name="image_url"
              type="text"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="https://... nebo nahrajte soubor →"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <div>
              <input ref={coverFileRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
              <button
                type="button"
                onClick={() => coverFileRef.current?.click()}
                disabled={coverUploading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <ImageIcon size={13} />
                {coverUploading ? 'Nahrávám…' : 'Nahrát ze souboru'}
              </button>
              {coverError && <span className="ml-2 text-xs text-red-600">{coverError}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Obsah — TipTap editor */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Obsah článku
        </label>
        <RichTextEditor
          name="content"
          defaultValue={article?.content}
        />
      </div>

      {/* Fotogalerie */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Fotogalerie
          </label>
          <div>
            <input
              ref={galleryFileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleGalleryUpload}
            />
            <button
              type="button"
              onClick={() => galleryFileRef.current?.click()}
              disabled={galleryUploading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <ImagePlus size={13} />
              {galleryUploading ? 'Nahrávám…' : 'Přidat fotky'}
            </button>
          </div>
        </div>

        <input
          type="hidden"
          name="gallery_urls"
          value={JSON.stringify(gallery.map(g => g.url))}
        />

        {galleryError && (
          <p className="text-xs text-red-600 mb-2">{galleryError}</p>
        )}

        {gallery.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
            Žádné fotky. Klikněte na „Přidat fotky" pro nahrání.
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {gallery.map((img, i) => (
              <div key={i} className="relative group aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={`Foto ${i + 1}`}
                  className="w-full h-full object-cover rounded-lg border border-gray-200"
                />
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setGallery(prev => prev.filter((_, idx) => idx !== i))
                  }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  title="Odebrat"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-1.5">
          Fotky se zobrazí pod článkem v mřížce. Po kliknutí se otevře lightbox.
        </p>
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

      {/* Přepínače + pořadí */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-6 py-1">
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
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="show_in_menu"
              value="1"
              defaultChecked={article?.show_in_menu ?? false}
              className="w-4 h-4 accent-green-600"
            />
            <span className="text-sm text-gray-700">Zobrazit v menu sekce</span>
          </label>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-700 shrink-0" htmlFor="sort_order">
            Pořadí
          </label>
          <input
            id="sort_order"
            name="sort_order"
            type="number"
            min="0"
            max="9999"
            defaultValue={article?.sort_order ?? 0}
            className="w-24 px-2 py-1.5 border border-gray-300 rounded-md text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          <span className="text-xs text-gray-400">vyšší číslo = výše ve výpisu i v menu sekce</span>
        </div>
      </div>

      {/* Spoluautoři — pouze v režimu úpravy */}
      {isEdit && article?.id && (
        <div className="border border-gray-200 rounded-xl p-4">
          <ArticleContributors
            articleId={article.id}
            contributors={contributors ?? []}
          />
        </div>
      )}

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

