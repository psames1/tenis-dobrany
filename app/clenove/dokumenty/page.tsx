import { createClient } from '@/lib/supabase/server'
import { FileDown } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Členská sekce – Dokumenty' }

const CATEGORY_LABELS: Record<string, string> = {
  minutes: 'Zápisy ze schůzí',
  rules:   'Stanovy a předpisy',
  forms:   'Formuláře',
  other:   'Ostatní',
}

export default async function MemberDocumentsPage() {
  const supabase = await createClient()

  const { data: documents } = await supabase
    .from('documents')
    .select('id, title, description, file_url, category, published_at')
    .eq('is_active', true)
    .order('published_at', { ascending: false })

  // Seskup podle kategorie
  const grouped = (documents ?? []).reduce<Record<string, typeof documents>>((acc, doc) => {
    const cat = doc.category ?? 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat]!.push(doc)
    return acc
  }, {})

  const categories = Object.keys(grouped)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dokumenty</h1>

      {categories.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-xl border border-gray-200">
          <p className="text-sm text-gray-400">Žádné dokumenty nejsou k dispozici.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {categories.map(cat => (
            <section key={cat}>
              <h2 className="text-base font-semibold text-gray-700 mb-3">
                {CATEGORY_LABELS[cat] ?? cat}
              </h2>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {(grouped[cat] ?? []).map(doc => (
                  <DocumentRow key={doc.id} doc={doc} supabase={supabase} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

// Subkomponent pro řádek dokumentu (synchronní — signed URL se generuje server-side)
async function DocumentRow({
  doc,
  supabase,
}: {
  doc: { id: string; title: string; description: string | null; file_url: string; published_at: string }
  supabase: Awaited<ReturnType<typeof createClient>>
}) {
  // Vygeneruj podepsanou URL (platná 1 hodinu)
  const { data: signed } = await supabase.storage
    .from('documents')
    .createSignedUrl(doc.file_url, 3600)

  return (
    <div className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
      <div className="min-w-0">
        <div className="font-medium text-gray-900 truncate">{doc.title}</div>
        {doc.description && (
          <div className="text-xs text-gray-400 mt-0.5 truncate">{doc.description}</div>
        )}
        <div className="text-xs text-gray-400 mt-0.5">
          {new Date(doc.published_at).toLocaleDateString('cs-CZ')}
        </div>
      </div>
      {signed?.signedUrl ? (
        <a
          href={signed.signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-4 shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
        >
          <FileDown size={14} />
          Stáhnout
        </a>
      ) : (
        <span className="ml-4 shrink-0 text-xs text-gray-400">Nedostupné</span>
      )}
    </div>
  )
}
