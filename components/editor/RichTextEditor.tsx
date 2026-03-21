'use client'

import { useEditor, EditorContent, ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { mergeAttributes } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import ImageExt from '@tiptap/extension-image'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { useRef, useState, useCallback, useEffect } from 'react'
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

// ── Resizable image NodeView ──────────────────────────────────────────────────
type ImgAlign = 'none' | 'left' | 'center' | 'right'

function ImageNodeView({ node, updateAttributes, selected }: NodeViewProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const startX = useRef(0)
  const startW = useRef(0)

  const src    = node.attrs.src  as string
  const alt    = (node.attrs.alt as string) ?? ''
  const width  = node.attrs['data-width'] as number | null
  const align  = ((node.attrs['data-align'] as string) ?? 'none') as ImgAlign
  const href   = node.attrs['data-href']  as string | null

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    startX.current = e.clientX
    startW.current = imgRef.current?.offsetWidth ?? 300
    const onMove = (ev: MouseEvent) => {
      const w = Math.max(40, Math.round(startW.current + ev.clientX - startX.current))
      updateAttributes({ 'data-width': w })
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const wrapStyle: React.CSSProperties = {
    display:     'inline-block',
    position:    'relative',
    maxWidth:    '100%',
    float:       align === 'left' ? 'left' : align === 'right' ? 'right' : 'none',
    marginRight: align === 'left'   ? '1em'   : undefined,
    marginLeft:  align === 'right'  ? '1em'   : align === 'center' ? 'auto' : undefined,
    marginBottom:(align === 'left' || align === 'right') ? '0.5em' : undefined,
    clear:       (align === 'none' || align === 'center') ? 'both' : 'none',
  }

  const imgStyle: React.CSSProperties = {
    width:    width ? `${width}px` : 'auto',
    maxWidth: '100%',
    display:  'block',
    outline:  selected ? '2px solid #3b82f6' : undefined,
    outlineOffset: selected ? '2px' : undefined,
  }

  const ALIGNS: { key: ImgAlign; label: string }[] = [
    { key: 'none',   label: '■ blok'    },
    { key: 'left',   label: '← vlevo'   },
    { key: 'center', label: '↔ střed'   },
    { key: 'right',  label: 'vpravo →'  },
  ]

  const imgEl = (
    <img ref={imgRef} src={src} alt={alt} style={imgStyle} draggable={false} />
  )

  return (
    <NodeViewWrapper style={{ display: 'block', overflow: 'hidden' }}>
      <div style={wrapStyle}>
        {href
          ? <a href={href} target="_blank" rel="noopener noreferrer">{imgEl}</a>
          : imgEl
        }
        {selected && (
          <>
            {/* Floating toolbar */}
            <div
              className="absolute -top-8 left-0 z-50 flex items-center gap-0.5 bg-white border border-gray-200 rounded-md shadow-xl px-1 py-0.5 whitespace-nowrap"
              onMouseDown={e => e.preventDefault()}
            >
              {ALIGNS.map(({ key, label }) => (
                <button
                  key={key} type="button"
                  onMouseDown={e => { e.preventDefault(); updateAttributes({ 'data-align': key }) }}
                  className={`px-1.5 py-0.5 rounded text-xs font-medium ${align === key ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  {label}
                </button>
              ))}
              <span className="w-px h-3 bg-gray-200 mx-0.5" />
              <button
                type="button"
                onMouseDown={e => {
                  e.preventDefault()
                  const url = window.prompt('URL odkazu obrázku (prázdné = odebrat nebo ponechat):', href ?? '')
                  if (url === null) return
                  updateAttributes({ 'data-href': url.trim() || null })
                }}
                className="px-1.5 py-0.5 rounded text-xs text-gray-500 hover:bg-gray-100"
                title={href ? 'Upravit odkaz obrázku' : 'Přidat odkaz obrázku'}
              >
                {href ? '🔗 odkaz' : '+ odkaz'}
              </button>
              {href && (
                <button
                  type="button"
                  onMouseDown={e => { e.preventDefault(); updateAttributes({ 'data-href': null }) }}
                  className="px-1.5 py-0.5 rounded text-xs text-red-500 hover:bg-red-50"
                  title="Odebrat odkaz z obrázku"
                >
                  × odkaz
                </button>
              )}
              <button
                type="button"
                onMouseDown={e => {
                  e.preventDefault()
                  const newAlt = window.prompt('Popis obrázku (alt text):', alt)
                  if (newAlt !== null) updateAttributes({ alt: newAlt })
                }}
                className="px-1.5 py-0.5 rounded text-xs text-gray-500 hover:bg-gray-100"
                title="Popis (alt text)"
              >
                alt
              </button>
              {width && (
                <button
                  type="button"
                  onMouseDown={e => { e.preventDefault(); updateAttributes({ 'data-width': null }) }}
                  className="px-1.5 py-0.5 rounded text-xs text-gray-500 hover:bg-gray-100"
                  title="Obnovit původní šířku"
                >
                  ↺ šířka
                </button>
              )}
            </div>
            {/* SE resize handle */}
            <div
              className="absolute bottom-0 right-0 w-5 h-5 bg-blue-500 cursor-se-resize rounded-tl flex items-center justify-center"
              onMouseDown={startResize}
              title="Taháním změňte šířku"
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="white">
                <path d="M1 7 L7 1 M4 7 L7 4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          </>
        )}
      </div>
    </NodeViewWrapper>
  )
}

// ── Custom image extension (resizable, alignable, linkable) ───────────────────
const ResizableImageExtension = ImageExt.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      'data-width': {
        default: null,
        parseHTML: el => {
          const w = el.getAttribute('data-width') ?? el.getAttribute('width')
          return w ? parseInt(w, 10) : null
        },
        renderHTML: attrs => (attrs['data-width'] != null ? { 'data-width': String(attrs['data-width']) } : {}),
      },
      'data-align': {
        default: 'none',
        parseHTML: el => el.getAttribute('data-align') ?? 'none',
        renderHTML: attrs => ({ 'data-align': attrs['data-align'] ?? 'none' }),
      },
      'data-href': {
        default: null,
        // Read from the img's own data-href attribute (stored there for reliable round-trip)
        parseHTML: el => el.getAttribute('data-href') ?? el.parentElement?.getAttribute('href') ?? null,
        renderHTML: () => ({}), // included manually in the node renderHTML override below
      },
    }
  },

  renderHTML({ HTMLAttributes }) {
    const href  = HTMLAttributes['data-href']  as string | null | undefined
    const width = HTMLAttributes['data-width'] as number | null | undefined
    const align = (HTMLAttributes['data-align'] ?? 'none') as ImgAlign
    // Strip from rest so we don't duplicate them via mergeAttributes
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { 'data-href': _h, 'data-width': _w, 'data-align': _a, ...rest } = HTMLAttributes

    const style = [
      width  ? `width:${width}px`                             : '',
      align === 'left'   ? 'float:left;margin:0 1em 0.5em 0' : '',
      align === 'right'  ? 'float:right;margin:0 0 0.5em 1em': '',
      align === 'center' ? 'display:block;margin:0 auto'      : '',
    ].filter(Boolean).join(';')

    // Store data-* attrs directly on <img> so they round-trip correctly on reload
    const imgAttrs = mergeAttributes(
      { class: 'article-img' },
      rest,
      style ? { style } : {},
      width  != null         ? { 'data-width': String(width) } : {},
      align !== 'none'       ? { 'data-align': align }         : {},
      href                   ? { 'data-href':  href  }         : {},
    )

    if (href) {
      return ['a', { href, target: '_blank', rel: 'noopener noreferrer' }, ['img', imgAttrs]]
    }
    return ['img', imgAttrs]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView)
  },
})

// ── Table extension with optional plain style ─────────────────────────────────
const StyledTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      'data-style': {
        default: 'bordered',
        parseHTML: el => el.getAttribute('data-style') ?? 'bordered',
        renderHTML: attrs => ({ 'data-style': attrs['data-style'] ?? 'bordered' }),
      },
    }
  },
})

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
  const hiddenRef      = useRef<HTMLInputElement>(null)
  const inlineFileRef  = useRef<HTMLInputElement>(null)
  const galleryFileRef = useRef<HTMLInputElement>(null)
  const [gallery, setGallery]           = useState<GalleryImage[]>([])
  const [uploading, setUploading]       = useState(false)
  const [uploadError, setUploadError]   = useState<string | null>(null)
  const [showTablePicker, setShowTablePicker] = useState(false)
  const [hoverCell, setHoverCell]       = useState<[number, number]>([0, 0])
  const [tableWithHeader, setTableWithHeader] = useState(false)
  const [tableStyle, setTableStyle]     = useState<'bordered' | 'plain'>('bordered')

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        code: false,
        codeBlock: false,
      }),
      ResizableImageExtension.configure({ allowBase64: false }),
      StyledTable.configure({ resizable: false }),
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

  // Safety net: sync editor → hidden input right before form submit
  useEffect(() => {
    if (!editor) return
    const form = hiddenRef.current?.closest('form')
    if (!form) return
    const sync = () => {
      if (hiddenRef.current) hiddenRef.current.value = editor.getHTML()
    }
    form.addEventListener('submit', sync)
    return () => form.removeEventListener('submit', sync)
  }, [editor])

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
        // Force-sync hidden input after async insert (safety net for slow saves)
        if (hiddenRef.current) hiddenRef.current.value = editor.getHTML()
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

  const handleLinkEdit = () => {
    const current = editor.getAttributes('link').href as string ?? ''
    const url = window.prompt('URL odkazu (prázdné = odebrat):', current)
    if (url === null) return // cancelled
    if (url.trim() === '') {
      editor.chain().focus().unsetLink().run()
    } else {
      editor.chain().focus().setLink({ href: url.trim() }).run()
    }
  }

  const insertTable = (rows: number, cols: number) => {
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: tableWithHeader }).run()
    if (tableStyle === 'plain') {
      editor.chain().focus().updateAttributes('table', { 'data-style': 'plain' }).run()
    }
    setShowTablePicker(false)
    setHoverCell([0, 0])
  }

  const currentTableStyle = inTable
    ? ((editor.getAttributes('table')['data-style'] ?? 'bordered') as string)
    : 'bordered'

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

        {/* Text */}
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

        {/* Tabulka – picker */}
        <div className="relative">
          <Btn
            onClick={() => setShowTablePicker(v => !v)}
            active={showTablePicker}
            title="Vložit tabulku"
          >
            <Table2 size={16} />
          </Btn>
          {showTablePicker && (
            <div
              className="absolute left-0 top-8 z-50 bg-white border border-gray-200 rounded-lg shadow-xl p-3 min-w-max"
              onMouseLeave={() => setHoverCell([0, 0])}
            >
              {/* Možnosti tabulky */}
              <div className="flex flex-col gap-2 mb-3 pb-2 border-b border-gray-100">
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={tableWithHeader}
                    onChange={e => setTableWithHeader(e.target.checked)}
                    className="w-3.5 h-3.5 accent-green-600"
                  />
                  S hlavičkovou řádkou
                </label>
                <div className="flex gap-1">
                  {(['bordered', 'plain'] as const).map(s => (
                    <button key={s} type="button"
                      onMouseDown={e => { e.preventDefault(); setTableStyle(s) }}
                      className={`px-2 py-0.5 rounded text-xs border transition-colors ${tableStyle === s ? 'bg-green-100 border-green-400 text-green-700 font-semibold' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                      {s === 'bordered' ? '⬛ S čárami' : '— Bez čar'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-xs text-gray-400 mb-1.5 text-center">
                {hoverCell[0] > 0 ? `${hoverCell[1]} sl. × ${hoverCell[0]} řád.` : 'Nadešte myší pro výběr'}
              </div>
              <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(8, 1.25rem)' }}>
                {Array.from({ length: 8 }, (_, row) =>
                  Array.from({ length: 8 }, (_, col) => (
                    <button
                      key={`${row}-${col}`} type="button"
                      className={`w-5 h-5 border rounded-sm transition-colors ${
                        row < hoverCell[0] && col < hoverCell[1]
                          ? 'bg-green-200 border-green-400'
                          : 'bg-gray-100 border-gray-200 hover:bg-green-100'
                      }`}
                      onMouseEnter={() => setHoverCell([row + 1, col + 1])}
                      onMouseDown={e => { e.preventDefault(); insertTable(row + 1, col + 1) }}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Kontextové operace s tabulkou (viditelné jen v tabulce) */}
        {inTable && (
          <>
            <Sep />
            <Btn onClick={() => editor.chain().focus().addRowBefore().run()} title="Přidat řádek nad">
              <Plus size={14} /><span className="text-xs ml-0.5">↑ řád</span>
            </Btn>
            <Btn onClick={() => editor.chain().focus().addRowAfter().run()} title="Přidat řádek pod">
              <Plus size={14} /><span className="text-xs ml-0.5">↓ řád</span>
            </Btn>
            <Btn onClick={() => editor.chain().focus().addColumnBefore().run()} title="Přidat sloupec vlevo">
              <Plus size={14} /><span className="text-xs ml-0.5">←sl</span>
            </Btn>
            <Btn onClick={() => editor.chain().focus().addColumnAfter().run()} title="Přidat sloupec vpravo">
              <Plus size={14} /><span className="text-xs ml-0.5">sl→</span>
            </Btn>
            <Sep />
            <Btn onClick={() => editor.chain().focus().deleteRow().run()} title="Smazat řádek">
              <Trash2 size={14} /><span className="text-xs ml-0.5">řád</span>
            </Btn>
            <Btn onClick={() => editor.chain().focus().deleteColumn().run()} title="Smazat sloupec">
              <Trash2 size={14} /><span className="text-xs ml-0.5">sl</span>
            </Btn>
            <Btn onClick={() => editor.chain().focus().deleteTable().run()} title="Smazat celou tabulku">
              <Trash2 size={14} className="text-red-500" /><span className="text-xs ml-0.5 text-red-500">tab</span>
            </Btn>
            <Sep />
            <Btn
              onClick={() => {
                editor.chain().focus().updateAttributes('table', {
                  'data-style': currentTableStyle === 'bordered' ? 'plain' : 'bordered',
                }).run()
              }}
              title="Přepnout styl tabulky (s čárami / bez)"
            >
              <span className="text-xs">{currentTableStyle === 'bordered' ? '— bez čar' : '⬛ s čárami'}</span>
            </Btn>
            <Btn
              onClick={() => editor.chain().focus().toggleHeaderRow().run()}
              active={editor.isActive('tableHeader')}
              title="Zapnout/vypnout hlavičkovou řádku"
            >
              <span className="text-xs">th</span>
            </Btn>
          </>
        )}

        <Sep />

        {/* Odkaz */}
        <Btn
          onClick={handleLinkEdit}
          active={editor.isActive('link')}
          title={editor.isActive('link') ? 'Upravit odkaz' : 'Vložit odkaz'}
        >
          <Link2 size={16} />
        </Btn>
        {editor.isActive('link') && (
          <Btn
            onClick={() => editor.chain().focus().unsetLink().run()}
            title="Odebrat odkaz"
          >
            <Link2Off size={16} />
          </Btn>
        )}

        <Sep />

        {/* Vložit obrázek */}
        <input ref={inlineFileRef} type="file" accept="image/*" className="hidden" onChange={handleInlineUpload} />
        <Btn
          onClick={() => inlineFileRef.current?.click()}
          disabled={uploading}
          title="Vložit obrázek na pozici kurzoru"
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
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Obrázky článku</span>
              <span className="ml-2 text-xs text-gray-400">— nahrajte a vložete na požadované místo v textu</span>
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
              Obrázky nahrané zde vložete kliknutím na „Vložit“ na aktuální pozici kurzoru v textu.
              Po vložení klikněte na obrázek pro změnu zarovnání, šířky nebo přidání odkazu.
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {gallery.map((img) => (
                <div key={img.url} className="relative group w-24 shrink-0">
                  <img src={img.url} alt={img.name} className="w-24 h-16 object-cover rounded-lg border border-gray-200" />
                  <div className="absolute inset-0 bg-black/60 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-1">
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        editor.chain().focus().setImage({ src: img.url, alt: img.name }).run()
                        if (hiddenRef.current) hiddenRef.current.value = editor.getHTML()
                      }}
                      className="w-full text-white text-xs bg-green-600 rounded px-1 py-0.5 hover:bg-green-700 transition-colors"
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
                    >
                      🗑 Odebrat
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

