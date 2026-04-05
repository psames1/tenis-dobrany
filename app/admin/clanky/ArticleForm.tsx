'use client'

import { useState, useRef, useEffect } from 'react'
import { saveArticle } from '../actions'
import { RichTextEditor } from '@/components/editor/RichTextEditor'
import { createClient } from '@/lib/supabase/client'
import { ImageIcon, ImagePlus, X, FileUp, FileDown } from 'lucide-react'
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
  is_news: boolean
  show_in_menu: boolean
  sort_order: number
  allow_comments: boolean
  allow_poll: boolean
  poll_question: string | null
  poll_allow_multiple: boolean
  visibility: string
  published_at: string
}

type GalleryImage = {
  id: string
  public_url: string
  alt_text: string | null
  sort_order: number
}

type DocumentItem = {
  title: string
  description: string
  file_url: string
  document_date: string  // YYYY-MM-DD
  display_url?: string   // podepsaná URL pro zobrazení/stažení (není ukládána do DB)
}

type LocalGalleryImg = { url: string }

type PollOptionInput = { label: string }

type Props = {
  sections: Section[]
  article?: Article
  galleryImages?: GalleryImage[]
  contributors?: ContributorRecord[]
  savedDocuments?: DocumentItem[]
  defaultSectionId?: string
  pollOptions?: PollOptionInput[]
}

async function uploadDocumentFile(file: File): Promise<string> {
  const supabase = createClient()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `docs/${Date.now()}-${safeName}`
  const { error } = await supabase.storage
    .from('documents')
    .upload(path, file, { cacheControl: '31536000', upsert: false })
  if (error) throw new Error(error.message)
  return supabase.storage.from('documents').getPublicUrl(path).data.publicUrl
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
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

export function ArticleForm({ sections, article, galleryImages, contributors, savedDocuments, defaultSectionId, pollOptions: initialPollOptions }: Props) {
  const isEdit = !!article
  const publishedDate = article?.published_at
    ? new Date(article.published_at).toISOString().slice(0, 16)
    : new Date().toISOString().slice(0, 16)

  const [coverUrl, setCoverUrl] = useState(article?.image_url ?? '')
  const [coverUploading, setCoverUploading] = useState(false)
  const [coverError, setCoverError] = useState<string | null>(null)
  const coverFileRef = useRef<HTMLInputElement>(null)

  // Vložení obrázku ze schránky (Ctrl+V) — sledujeme globálně
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? [])
      const imageItem = items.find(i => i.type.startsWith('image/'))
      if (!imageItem) return
      const file = imageItem.getAsFile()
      if (!file) return
      setCoverUploading(true)
      setCoverError(null)
      try {
        const url = await uploadCoverImage(file)
        setCoverUrl(url)
      } catch {
        setCoverError('Nepodařilo se nahrát obrázek ze schránky.')
      } finally {
        setCoverUploading(false)
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [])

  const [gallery, setGallery] = useState<LocalGalleryImg[]>(
    (galleryImages ?? []).map(g => ({ url: g.public_url }))
  )
  const [galleryUploading, setGalleryUploading] = useState(false)
  const [galleryError, setGalleryError] = useState<string | null>(null)
  const galleryFileRef = useRef<HTMLInputElement>(null)

  const [documents, setDocuments] = useState<DocumentItem[]>(
    (savedDocuments ?? []).map(d => ({
      ...d,
      document_date: (d as DocumentItem).document_date ?? todayIso(),
    }))
  )
  const [docUploading, setDocUploading] = useState(false)
  const [docError, setDocError] = useState<string | null>(null)
  const docFileRef = useRef<HTMLInputElement>(null)
  const replaceDocFileRef = useRef<HTMLInputElement>(null)
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null)

  // Anketa
  const [pollEnabled, setPollEnabled] = useState(article?.allow_poll ?? false)
  const [pollOptions, setPollOptions] = useState<PollOptionInput[]>(initialPollOptions ?? [])
  const [newOptionLabel, setNewOptionLabel] = useState('')

  function addPollOption() {
    const label = newOptionLabel.trim()
    if (!label) return
    setPollOptions(prev => [...prev, { label }])
    setNewOptionLabel('')
  }

  function removePollOption(index: number) {
    setPollOptions(prev => prev.filter((_, i) => i !== index))
  }

  function updateDoc(index: number, field: keyof DocumentItem, value: string) {
    setDocuments(prev => prev.map((d, i) => i === index ? { ...d, [field]: value } : d))
  }

  // Hromadný upload nových souborů
  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setDocUploading(true)
    setDocError(null)
    try {
      const today = todayIso()
      const uploaded: DocumentItem[] = []
      for (const file of files) {
        const url = await uploadDocumentFile(file)
        uploaded.push({
          title: file.name.replace(/\.[^.]+$/, ''),
          description: '',
          file_url: url,
          document_date: today,
        })
      }
      setDocuments(prev => [...prev, ...uploaded])
    } catch (err: unknown) {
      setDocError(err instanceof Error ? err.message : 'Chyba při nahrávání souboru.')
    } finally {
      setDocUploading(false)
      e.target.value = ''
    }
  }

  // Nahradit soubor u konkrétního záznamu
  const handleReplaceDocClick = (i: number) => {
    setReplaceIndex(i)
    replaceDocFileRef.current?.click()
  }

  const handleReplaceDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || replaceIndex === null) return
    setDocUploading(true)
    setDocError(null)
    try {
      const url = await uploadDocumentFile(file)
      setDocuments(prev => prev.map((d, i) => i === replaceIndex ? { ...d, file_url: url } : d))
    } catch (err: unknown) {
      setDocError(err instanceof Error ? err.message : 'Chyba při nahrávání souboru.')
    } finally {
      setDocUploading(false)
      e.target.value = ''
      setReplaceIndex(null)
    }
  }

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
          defaultValue={article?.section_id ?? defaultSectionId ?? ''}
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
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Perex (krátký popis pro výpis)
        </label>
        <RichTextEditor
          name="excerpt"
          defaultValue={article?.excerpt}
          minHeight="min-h-28"
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
              placeholder="https://... nebo nahrajte soubor"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <div className="flex items-center gap-3 flex-wrap">
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
              <span className="text-xs text-gray-400">nebo vložte ze schránky <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs border border-gray-200">Ctrl+V</kbd></span>
              {coverError && <span className="text-xs text-red-600">{coverError}</span>}
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

      {/* Galerie */}
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

      {/* Přílohy (dokumenty) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-gray-700">
            Přílohy (dokumenty ke stažení)
          </label>
          <div className="flex gap-2">
            {/* Hromadný upload nových souborů */}
            <input ref={docFileRef} type="file" multiple className="hidden" onChange={handleDocUpload} />
            {/* Input pro nahrazení konkrétního souboru (single) */}
            <input ref={replaceDocFileRef} type="file" className="hidden" onChange={handleReplaceDoc} />
            <button
              type="button"
              onClick={() => docFileRef.current?.click()}
              disabled={docUploading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <FileUp size={13} />
              {docUploading ? 'Nahrávám…' : 'Nahrát soubory'}
            </button>
          </div>
        </div>

        <input type="hidden" name="documents_json" value={JSON.stringify(
          documents.map(({ display_url: _omit, ...d }) => d)
        )} />

        {docError && <p className="text-xs text-red-600 mb-2">{docError}</p>}

        {documents.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
            Žádné přílohy. Klikněte na „Nahrát soubory" pro přidání.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-3 py-2 text-left font-medium">Název *</th>
                  <th className="px-3 py-2 text-left font-medium w-36">Datum</th>
                  <th className="px-3 py-2 text-left font-medium">Popis</th>
                  <th className="px-3 py-2 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {documents.map((doc, i) => (
                  <tr key={i} className="hover:bg-gray-50/50">
                    <td className="px-3 py-2">
                      <input
                        value={doc.title}
                        onChange={e => updateDoc(i, 'title', e.target.value)}
                        placeholder="Název *"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={doc.document_date}
                        onChange={e => updateDoc(i, 'document_date', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={doc.description}
                        onChange={e => updateDoc(i, 'description', e.target.value)}
                        placeholder="Popis (volitelný)"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {doc.file_url && (
                          <a
                            href={doc.display_url ?? doc.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-green-600 hover:text-green-800 transition-colors"
                            title="Stáhnout / otevřít"
                          >
                            <FileDown size={15} />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handleReplaceDocClick(i)}
                          disabled={docUploading}
                          className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-40"
                          title="Nahradit soubor"
                        >
                          <FileUp size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDocuments(prev => prev.filter((_, idx) => idx !== i))}
                          className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                          title="Odebrat přílohu"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
        {/* Viditelnost */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="visibility">
            Viditelnost článku
          </label>
          <select
            id="visibility"
            name="visibility"
            defaultValue={article?.visibility ?? 'public'}
            className="w-full sm:w-72 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
          >
            <option value="public">Veřejný — vidí všichni</option>
            <option value="member">Přihlášení členové</option>
            <option value="editor">Manager a administrátor</option>
            <option value="admin">Pouze administrátor</option>
          </select>
          <p className="text-xs text-gray-400 mt-1">
            Určuje, kdo může článek a jeho přílohy zobrazit.
          </p>
        </div>

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
              name="is_news"
              value="1"
              defaultChecked={article?.is_news ?? false}
              className="w-4 h-4 accent-green-600"
            />
            <span className="text-sm text-gray-700">Aktualita (zobrazit na úvodní stránce)</span>
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
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="allow_comments"
              value="1"
              defaultChecked={article?.allow_comments ?? false}
              className="w-4 h-4 accent-green-600"
            />
            <span className="text-sm text-gray-700">Povolit komentáře</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="allow_poll"
              value="1"
              checked={pollEnabled}
              onChange={e => setPollEnabled(e.target.checked)}
              className="w-4 h-4 accent-green-600"
            />
            <span className="text-sm text-gray-700">Povolit anketu</span>
          </label>
        </div>

        {/* Nastavení ankety — zobrazí se jen když je povolena */}
        {pollEnabled && (
          <div className="border border-green-200 bg-green-50/40 rounded-xl p-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Nastavení ankety</h3>

            {/* Skrytá pole pro serializaci stavu */}
            <input type="hidden" name="poll_options_json" value={JSON.stringify(pollOptions)} />

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Otázka ankety</label>
              <input
                name="poll_question"
                type="text"
                defaultValue={article?.poll_question ?? ''}
                placeholder="Např. Kdy se vám hodí přijít na brigádu?"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="poll_allow_multiple"
                value="1"
                defaultChecked={article?.poll_allow_multiple ?? false}
                className="w-4 h-4 accent-green-600"
              />
              <span className="text-sm text-gray-700">Umožnit zaškrtnout více možností</span>
            </label>

            {/* Seznam možností */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Možnosti ({pollOptions.length})</label>
              {pollOptions.length === 0 && (
                <p className="text-xs text-gray-400 mb-2">Zatím žádné možnosti. Přidejte je níže.</p>
              )}
              <div className="space-y-1 mb-3">
                {pollOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2">
                    <span className="flex-1 text-sm text-gray-800">{opt.label}</span>
                    <button
                      type="button"
                      onClick={() => removePollOption(i)}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newOptionLabel}
                  onChange={e => setNewOptionLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPollOption() } }}
                  placeholder="Nová možnost…"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  type="button"
                  onClick={addPollOption}
                  className="px-3 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
                >
                  + Přidat
                </button>
              </div>
              <p className="mt-1 text-[11px] text-gray-400">Stiskněte Enter nebo klikněte + Přidat.</p>
            </div>
          </div>
        )}

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

      {/* Tlačítka + notifikace */}
      <div className="border border-blue-100 bg-blue-50 rounded-xl p-4 space-y-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="send_notification"
            value="1"
            defaultChecked={false}
            className="w-4 h-4 mt-0.5 accent-blue-600 shrink-0"
          />
          <div>
            <span className="text-sm font-medium text-gray-800">Odeslat e-mailovou notifikaci členům</span>
            <p className="text-xs text-gray-500 mt-0.5">
              Po uložení se odešle e-mail s náhledem článku a odkazem členům, kteří mohou tento článek zobrazit.
            </p>
          </div>
        </label>

        <div className="flex gap-3 pt-1">
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
      </div>
    </form>
  )
}

