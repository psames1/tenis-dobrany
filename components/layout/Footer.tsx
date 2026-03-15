import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

type FooterItem = {
  id: string
  column_key: string
  item_type: string
  label: string | null
  content: string | null
  data: unknown
  sort_order: number
}

type LinkEntry = { label: string; url: string }
type SocialEntry = { platform: string; url: string; label: string }
type AddressData = { street?: string; city?: string; postal?: string }

function RenderItem({ item }: { item: FooterItem }) {
  switch (item.item_type) {
    case 'heading':
      return (
        <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-1">
          {item.content}
        </h3>
      )
    case 'text':
      return <p className="text-green-300 text-sm leading-relaxed">{item.content}</p>
    case 'email':
      return (
        <a href={`mailto:${item.content}`} className="block text-green-300 text-sm hover:text-white transition-colors">
          {item.content}
        </a>
      )
    case 'phone':
      return (
        <a href={`tel:${String(item.content).replace(/\s/g, '')}`} className="block text-green-300 text-sm hover:text-white transition-colors">
          {item.content}
        </a>
      )
    case 'address': {
      const d = item.data as AddressData | null
      if (!d || typeof d !== 'object') return null
      return (
        <address className="text-green-300 text-sm not-italic leading-relaxed">
          {d.street && <div>{d.street}</div>}
          {(d.postal || d.city) && <div>{[d.postal, d.city].filter(Boolean).join(' ')}</div>}
        </address>
      )
    }
    case 'links_list': {
      const links = Array.isArray(item.data) ? (item.data as LinkEntry[]) : null
      if (!links?.length) return null
      return (
        <ul className="space-y-2">
          {links.map((link, i) => (
            <li key={i}>
              <Link href={link.url} className="text-green-300 text-sm hover:text-white transition-colors">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      )
    }
    case 'social_links': {
      const socials = Array.isArray(item.data) ? (item.data as SocialEntry[]) : null
      if (!socials?.length) return null
      return (
        <div className="flex flex-wrap gap-3">
          {socials.map((social, i) => (
            <a
              key={i}
              href={social.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-300 text-sm hover:text-white transition-colors"
              aria-label={social.label}
            >
              {social.label}
            </a>
          ))}
        </div>
      )
    }
    default:
      return item.content ? <p className="text-green-300 text-sm">{item.content}</p> : null
  }
}

export async function Footer() {
  const supabase = await createClient()

  const { data: items } = await supabase
    .from('footer_content')
    .select('id, column_key, item_type, label, content, data, sort_order')
    .eq('is_active', true)
    .order('sort_order')

  const all = (items ?? []) as FooterItem[]
  const col = (key: string) => all.filter(i => i.column_key === key)

  const columns = [
    col('contact'),
    col('links'),
    col('social'),
    col('about'),
  ]

  return (
    <footer className="bg-green-900 text-green-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {columns.map((colItems, ci) => (
            <div key={ci} className="space-y-2">
              {colItems.map(item => (
                <RenderItem key={item.id} item={item} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-green-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-green-500">
          <span>© {new Date().getFullYear()} Tenisový oddíl TJ Dobřany, z.s.</span>
          <span>tenis-dobrany.sportkalendar.cz</span>
        </div>
      </div>
    </footer>
  )
}
