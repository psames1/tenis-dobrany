'use client'

import { useState, useRef } from 'react'
import { saveContributorArticle } from './actions'
import { RichTextEditor } from '@/components/editor/RichTextEditor'
import { createClient } from '@/lib/supabase/client'
import { ImagePlus, X } from 'lucide-react'

type GalleryImage = {
  id: string
  public_url: string
  alt_text: string | null
  sort_order: number
}

type LocalImg = { url: string }

type Props = {
  pageId: string
  title: string
  content: string | null
  galleryImages: GalleryImage[]
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

export function ContributorArticleForm({ pageId, title, content, galleryImages }: Props) {
  const [gallery, setGallery] = useState<LocalImg[]>(
    galleryImages.map(g => ({ url: g.public_url }))
  )
  const [galleryUploading, setGalleryUploading] = useState(false)
  const [galleryError, setGalleryError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

  return (
    <form action={saveContributorArticle} className="space-y-6">
      <input type="hidden" name="page_id" value={pageId} />

      {/* Název — pouze pro čtení */}
      <div>
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Název článku</div>
        <div className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 font-medium">
          {title}
        </div>
      </div>

      {/* Editor obsahu */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Obsah článku
        </label>
        <RichTextEditor
          name="content"
          defaultValue={content ?? undefined}
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
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleUpload}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
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
                  onMouseDown={e => {
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
      </div>

      {/* Tlačítka */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          className="px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
        >
          Uložit změny
        </button>
        <a
          href="/clenove"
          className="px-5 py-2 bg-white border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          Zpět na přehled
        </a>
      </div>
    </form>
  )
}
