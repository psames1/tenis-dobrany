'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import ImageExt from '@tiptap/extension-image'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Bold, Italic, Strikethrough, Heading2, Heading3, Heading4,
  List, ListOrdered, Quote, Minus, Table2, Image as ImageIcon,
  Undo2, Redo2, Plus, Trash2, Link2, Link2Off,
} from 'lucide-react'

// ── Upload helper ─────────────────────────────────────────────────────────────
async function uploadToStorage(file: File): Promise<string> {
  const supabase = createClient()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `articles/${new Date().getFullYear()}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage
    .from('images')
    .upload(path, file, { cacheControl: '31536000', upsert: false })
  if (error) throw new Error(error.message)
  return supabase.storage.from('images').getPublicUrl(path).data.publicUrl
}

// ── Types ─────────────────────────────────────────────────────────────────────
type GalleryImage = { url: string; name: string }

type Props = {
  defaultValue?: string | null
  name?: string
  showImagePanel?: boolean
  minHeight?: string
}

// ── Toolbar button ────────────────────────────────────────────────────────────
function Btn({
  onClick, active, disabled, title, children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-green-600 text-white'
          : disabled
            ? 'text-gray-300 cursor-not-allowed'
            : 'text-gray-600 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  )
}

const Sep = () => <div className="w-px h-5 bg-gray-300 mx-0.5 self-center shrink-0" />

// ── Main component ────────────────────────────────────────────────────────────
export function RichTextEditor({ defaultValue, name = 'content', showImagePanel = false, minHeight = 'min-h-64' }: Props) {
  const hiddenRef = useRef<HTMLInputElement>(null)
  const inlineFileRef = useRef<HTMLInputElement>(null)
  const galleryFileRef = useRef<HTMLInputElement>(null)
  const [gallery, setGallery] = useState<GalleryImage[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  // Table size picker state
  const [showTablePicker, setShowTablePicker] = useState(false)
  const [hoverCell, setHoverCell] = useState<[number, number]>([0, 0])

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        code: false,
        codeBlock: false,
      }),
      ImageExt.configure({
        HTMLAttributes: { class: 'article-img' },
        allowBase64: false,
      }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', class: 'underline text-green-700 hover:text-green-900' },
      }),
      Placeholder.configure({ placeholder: 'Začněte psát obsah článku…' }),
    ],
    content: defaultValue ?? '',
    onUpdate({ editor }) {
      if (hiddenRef.current) hiddenRef.current.value = editor.getHTML()
    },
    editorProps: {
      attributes: {
        class: `tiptap-editor ${minHeight} px-4 py-3 focus:outline-none text-gray-800`,
      },
    },
  })

  // Inline upload (insert at cursor)
  const handleInlineUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !editor) return
      setUploading(true)
      setUploadError(null)
      try {
        const url = await uploadToStorage(file)
        editor.chain().focus().setImage({ src: url, alt: file.name }).run()
      } catch {
        setUploadError('Nepodařilo se nahrát obrázek. Zkontrolujte Storage permissions.')
      } finally {
        setUploading(false)
        e.target.value = ''
      }
    },
    [editor],
  )

  // Gallery upload (panel below editor)
  const handleGalleryUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? [])
      if (!files.length) return
      setUploading(true)
      setUploadError(null)
      try {
        const results = await Promise.all(
          files.map(async (file) => ({ url: await uploadToStorage(file), name: file.name })),
        )
        setGallery((prev) => [...prev, ...results])
      } catch {
        setUploadError('Nepodařilo se nahrát jeden nebo více obrázků.')
      } finally {
        setUploading(false)
        e.target.value = ''
      }
    },
    [],
  )

  if (!editor) {
    return (
      <div className="border border-gray-300 rounded-lg h-48 flex items-center justify-center text-gray-400 text-sm">
        Načítám editor…
      </div>
    )
  }

  const inTable = editor.isActive('table')

  const handleLinkToggle = () => {
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run()
    } else {
      const url = window.prompt('URL odkazu (např. https://example.com):')
      if (!url) return
      editor.chain().focus().setLink({ href: url }).run()
    }
  }

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-green-500 focus-within:border-transparent">

      {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-gray-50 border-b border-gray-200">

        {/* Nadpisy */}
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })} title="Nadpis H2">
          <Heading2 size={16} />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })} title="Nadpis H3">
          <Heading3 size={16} />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
          active={editor.isActive('heading', { level: 4 })} title="Nadpis H4">
          <Heading4 size={16} />
        </Btn>

        <Sep />

        {/* Text formátování */}
        <Btn onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')} title="Tučné (Ctrl+B)">
          <Bold size={16} />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')} title="Kurzíva (Ctrl+I)">
          <Italic size={16} />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')} title="Přeškrtnout">
          <Strikethrough size={16} />
        </Btn>

        <Sep />

        {/* Seznamy */}
        <Btn onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')} title="Odrážkový seznam">
          <List size={16} />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')} title="Číslovaný seznam">
          <ListOrdered size={16} />
        </Btn>

        <Sep />

        {/* Citace + HR */}
        <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')} title="Citace">
          <Quote size={16} />
        </Btn>
        <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontální čára">
          <Minus size={16} />
        </Btn>

        <Sep />

        {/* Tabulka */}
        <div className="relative">
          <Btn
            onClick={() => setShowTablePicker(v => !v)}
            active={showTablePicker}
            title="Vložit tabulku (vyberte velikost)"
          >
            <Table2 size={16} />
          </Btn>
          {showTablePicker && (
            <div
              className="absolute left-0 top-8 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-2"
              onMouseLeave={() => setHoverCell([0, 0])}
            >
              <div className="text-xs text-gray-500 mb-1 text-center">
                {hoverCell[0] > 0 ? `${hoverCell[1]}×${hoverCell[0]}` : 'Vyberte velikost'}
              </div>
              <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(8, 1fr)' }}>
                {Array.from({ length: 6 }, (_, row) =>
                  Array.from({ length: 8 }, (_, col) => (
                    <button
                      key={`${row}-${col}`}
                      type="button"
                      className={`w-5 h-5 border rounded-sm transition-colors ${
                        row < hoverCell[0] && col < hoverCell[1]
                          ? 'bg-green-200 border-green-400'
                          : 'bg-gray-100 border-gray-200 hover:bg-green-100'
                      }`}
                      onMouseEnter={() => setHoverCell([row + 1, col + 1])}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        editor.chain().focus().insertTable({
                          rows: row + 1,
                          cols: col + 1,
                          withHeaderRow: true,
                        }).run()
                        setShowTablePicker(false)
                        setHoverCell([0, 0])
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Tabulka – kontextové operace (zobrazí se jen v tabulce) */}
        {inTable && (
          <>
            <Sep />
            <Btn onClick={() => editor.chain().focus().addRowAfter().run()} title="Přidat řádek pod">
              <Plus size={14} />
              <span className="text-xs ml-0.5">řádek</span>
            </Btn>
            <Btn onClick={() => editor.chain().focus().addColumnAfter().run()} title="Přidat sloupec vpravo">
              <Plus size={14} />
              <span className="text-xs ml-0.5">sloupec</span>
            </Btn>
            <Btn onClick={() => editor.chain().focus().deleteRow().run()} title="Smazat řádek">
              <Trash2 size={14} />
              <span className="text-xs ml-0.5">řádek</span>
            </Btn>
            <Btn onClick={() => editor.chain().focus().deleteColumn().run()} title="Smazat sloupec">
              <Trash2 size={14} />
              <span className="text-xs ml-0.5">sloupec</span>
            </Btn>
            <Btn onClick={() => editor.chain().focus().deleteTable().run()} title="Smazat celou tabulku">
              <Trash2 size={14} className="text-red-500" />
              <span className="text-xs ml-0.5 text-red-500">tabulku</span>
            </Btn>
          </>
        )}

        <Sep />

        {/* Odkaz */}
        <Btn
          onClick={handleLinkToggle}
          active={editor.isActive('link')}
          title={editor.isActive('link') ? 'Odebrat odkaz' : 'Vložit odkaz (URL)'}
        >
          {editor.isActive('link') ? <Link2Off size={16} /> : <Link2 size={16} />}
        </Btn>

        <Sep />
        <input ref={inlineFileRef} type="file" accept="image/*" className="hidden" onChange={handleInlineUpload} />
        <Btn
          onClick={() => inlineFileRef.current?.click()}
          disabled={uploading}
          title="Vložit obrázek na pozici kurzoru v textu"
        >
          <ImageIcon size={16} className={uploading ? 'animate-pulse' : ''} />
        </Btn>

        <Sep />

        {/* Undo / Redo */}
        <Btn onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()} title="Zpět (Ctrl+Z)">
          <Undo2 size={16} />
        </Btn>
        <Btn onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()} title="Znovu (Ctrl+Y)">
          <Redo2 size={16} />
        </Btn>
      </div>

      {/* ── Editor obsah ─────────────────────────────────────────────────────── */}
      <EditorContent editor={editor} />

      {/* Sync hidden input pro Server Action FormData */}
      <input
        ref={hiddenRef}
        type="hidden"
        name={name}
        defaultValue={defaultValue ?? ''}
      />

      {uploadError && (
        <div className="mx-4 mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg">
          {uploadError}
        </div>
      )}

      {/* ── Panel obrázků článku ─────────────────────────────────────────────── */}
      {showImagePanel && (
      <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Obrázky článku
            </span>
            <span className="ml-2 text-xs text-gray-400">
              — nahrajte a vložte na požadované místo v textu
            </span>
          </div>
          <label className={`cursor-pointer inline-flex items-center gap-1 text-xs font-medium transition-colors ${uploading ? 'text-gray-400 cursor-wait' : 'text-green-600 hover:text-green-800'}`}>
            <Plus size={12} />
            {uploading ? 'Nahrávám…' : 'Nahrát obrázky'}
            <input
              ref={galleryFileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleGalleryUpload}
              disabled={uploading}
            />
          </label>
        </div>

        {gallery.length === 0 ? (
          <p className="text-xs text-gray-400">
            Obrázky nahrané zde budou zobrazeny ve standardizované velikosti.
            Kliknutím na „Vložit" je umístíte na aktuální pozici kurzoru v textu.
            Lze také vložit obrázek přímo do textu přes tlačítko{' '}
            <ImageIcon size={11} className="inline" /> v toolbaru (nižší kontrola nad formátováním).
          </p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {gallery.map((img) => (
              <div key={img.url} className="relative group w-24 shrink-0">
                <img
                  src={img.url}
                  alt={img.name}
                  className="w-24 h-16 object-cover rounded-lg border border-gray-200"
                />
                <div className="absolute inset-0 bg-black/60 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-1">
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      editor.chain().focus().setImage({ src: img.url, alt: img.name }).run()
                    }}
                    className="w-full text-white text-xs bg-green-600 rounded px-1 py-0.5 hover:bg-green-700 transition-colors"
                    title="Vložit na pozici kurzoru"
                  >
                    ↑ Vložit
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setGallery((prev) => prev.filter((i) => i.url !== img.url))
                    }}
                    className="w-full text-white text-xs bg-red-500 rounded px-1 py-0.5 hover:bg-red-600 transition-colors"
                    title="Odebrat z panelu"
                  >
                    ✕ Odebrat
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-0.5 truncate" title={img.name}>{img.name}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  )
}
