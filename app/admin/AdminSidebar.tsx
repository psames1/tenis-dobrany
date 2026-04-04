'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/admin', label: 'Přehled', icon: '📊', exact: true },
  { href: '/admin/clanky', label: 'Články', icon: '📝' },
  { href: '/admin/sekce', label: 'Sekce', icon: '🗂️' },
  { href: '/admin/design', label: 'Design', icon: '🎨' },
  { href: '/admin/kurty', label: 'Kurty', icon: '🎾' },
  { href: '/admin/rezervace', label: 'Nastavení rezervací', icon: '⚙️' },
]

const ADMIN_ONLY = [
  { href: '/admin/uzivatele', label: 'Uživatelé', icon: '👥' },
]

type Props = {
  role: string
  name: string
}

export function AdminSidebar({ role, name }: Props) {
  const pathname = usePathname()

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname.startsWith(href)

  return (
    <aside className="w-56 bg-green-900 text-white flex flex-col min-h-screen sticky top-0 shrink-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-green-800">
        <Link href="/" className="text-sm font-bold text-white hover:text-green-200 transition-colors">
          🎾 TJ Dobřany
        </Link>
        <div className="mt-1 text-xs text-green-400 truncate">{name}</div>
        <div className="mt-0.5 text-xs text-green-500 capitalize">{role}</div>
      </div>

      {/* Navigace */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {NAV.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive(item.href, item.exact)
                ? 'bg-green-700 text-white'
                : 'text-green-300 hover:bg-green-800 hover:text-white'
            }`}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </Link>
        ))}

        {role === 'admin' && (
          <>
            <div className="pt-3 pb-1 px-3 text-xs text-green-500 uppercase tracking-wider">
              Admin
            </div>
            {ADMIN_ONLY.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? 'bg-green-700 text-white'
                    : 'text-green-300 hover:bg-green-800 hover:text-white'
                }`}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* Zpět na web */}
      <div className="px-2 py-4 border-t border-green-800">
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-green-400 hover:bg-green-800 hover:text-white transition-colors"
        >
          <span aria-hidden="true">🌐</span>
          Zpět na web
        </Link>
      </div>
    </aside>
  )
}
