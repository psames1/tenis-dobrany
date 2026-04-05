'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

const SIMPLE_NAV = [
  { href: '/admin', label: 'Přehled', icon: '📊', exact: true },
  { href: '/admin/clanky', label: 'Články', icon: '📝' },
  { href: '/admin/sekce', label: 'Sekce', icon: '🗂️' },
  { href: '/admin/design', label: 'Design', icon: '🎨' },
]

const REZERVACE_NAV = [
  { href: '/admin/rezervace', label: 'Nastavení' },
  { href: '/admin/kurty', label: 'Kurty' },
]

const ADMIN_ONLY = [
  { href: '/admin/uzivatele', label: 'Uživatelé', icon: '👥' },
  { href: '/admin/skupiny',   label: 'Skupiny',    icon: '🏷️' },
]

type Props = {
  role: string
  name: string
  onClose?: () => void
}

export function AdminSidebar({ role, name, onClose }: Props) {
  const pathname = usePathname()

  // Zavřít mobilní drawer po navigaci
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    onClose?.()
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname.startsWith(href)

  return (
    <aside className="flex h-full w-56 flex-col bg-green-900 text-white">
      {/* Logo + tlačítko zavřít (mobil) */}
      <div className="flex items-start justify-between border-b border-green-800 px-4 py-5">
        <div className="min-w-0">
          <Link href="/" className="text-sm font-bold text-white hover:text-green-200 transition-colors">
            🎾 TJ Dobřany
          </Link>
          <div className="mt-1 truncate text-xs text-green-400">{name}</div>
          <div className="mt-0.5 text-xs capitalize text-green-500">{role}</div>
        </div>
        <button
          onClick={onClose}
          className="ml-2 shrink-0 rounded-lg p-1.5 text-green-400 hover:bg-green-800 hover:text-white transition-colors lg:hidden"
          aria-label="Zavřít menu"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Navigace */}
      <nav className="flex-1 space-y-0.5 px-2 py-4">
        {SIMPLE_NAV.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive(item.href, item.exact)
                ? 'bg-green-700 text-white'
                : 'text-green-300 hover:bg-green-800 hover:text-white'
            }`}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </Link>
        ))}

        {/* Skupina: Rezervace */}
        <div className="pt-3">
          <div className="mb-1 flex items-center gap-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-green-500">
            <span aria-hidden="true">🎾</span>
            Rezervace
          </div>
          {REZERVACE_NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center rounded-lg py-2 pl-8 pr-3 text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? 'bg-green-700 text-white'
                  : 'text-green-300 hover:bg-green-800 hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* Admin-only sekce */}
        {role === 'admin' && (
          <div className="pt-3">
            <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-green-500">
              Admin
            </div>
            {ADMIN_ONLY.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? 'bg-green-700 text-white'
                    : 'text-green-300 hover:bg-green-800 hover:text-white'
                }`}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* Zpět na web */}
      <div className="border-t border-green-800 px-2 py-4">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-green-400 hover:bg-green-800 hover:text-white transition-colors"
        >
          <span aria-hidden="true">🌐</span>
          Zpět na web
        </Link>
      </div>
    </aside>
  )
}
