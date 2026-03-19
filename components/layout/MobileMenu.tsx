'use client'

import { useState, Fragment } from 'react'
import Link from 'next/link'
import type { NavItem } from './Navigation'

type Props = {
  items: NavItem[]
  user: { email: string; fullName?: string | null; avatarUrl?: string | null; role?: string } | null
}

export function MobileMenu({ items, user }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="md:hidden">
      {/* Tlačítko hamburgeru */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="p-2 rounded-md text-gray-600 hover:text-green-700 hover:bg-green-50 transition-colors"
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Zavřít menu' : 'Otevřít menu'}
      >
        {isOpen ? (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Rozbalené menu */}
      {isOpen && (
        <div className="absolute top-16 left-0 right-0 bg-white border-t border-gray-100 shadow-lg z-50">
          <div className="max-w-6xl mx-auto px-4 py-3 space-y-0.5">
            {items.map(item => (
              <Fragment key={item.id}>
                <Link
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className="block px-3 py-2.5 rounded-md text-sm font-medium text-gray-700 hover:text-green-700 hover:bg-green-50 transition-colors"
                >
                  {item.label}
                </Link>
                {/* Podmenu — odsazené děti */}
                {item.children?.map(child => (
                  <Link
                    key={child.id}
                    href={child.href}
                    onClick={() => setIsOpen(false)}
                    className="block pl-7 pr-3 py-2 rounded-md text-sm text-gray-500 hover:text-green-700 hover:bg-green-50 transition-colors"
                  >
                    <span className="text-gray-300 mr-1.5" aria-hidden="true">└</span>
                    {child.label}
                  </Link>
                ))}
              </Fragment>
            ))}
            <div className="border-t border-gray-100 pt-2 mt-2">
              {user ? (
                <>
                  <div className="px-3 py-2 text-xs text-gray-400 font-medium truncate">
                    {user.fullName ?? user.email}
                  </div>
                  <Link
                    href="/clenove/profil"
                    onClick={() => setIsOpen(false)}
                    className="block px-3 py-2.5 rounded-md text-sm font-medium text-gray-600 hover:text-green-700 hover:bg-green-50 transition-colors"
                  >
                    Profil
                  </Link>
                  {(user.role === 'admin' || user.role === 'manager') && (
                    <Link
                      href="/admin"
                      onClick={() => setIsOpen(false)}
                      className="block px-3 py-2.5 rounded-md text-sm font-medium text-gray-600 hover:text-green-700 hover:bg-green-50 transition-colors"
                    >
                      Administrace
                    </Link>
                  )}
                  <form action="/logout" method="POST">
                    <button
                      type="submit"
                      className="w-full text-left px-3 py-2.5 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Odhlásit
                    </button>
                  </form>
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setIsOpen(false)}
                  className="block px-3 py-2.5 rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition-colors text-center"
                >
                  Přihlásit se
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
