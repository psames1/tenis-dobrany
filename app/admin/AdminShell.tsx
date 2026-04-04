'use client'

import { useState } from 'react'
import { AdminSidebar } from './AdminSidebar'

type Props = {
  children: React.ReactNode
  role: string
  name: string
}

export function AdminShell({ children, role, name }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Overlay pro mobilní menu */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — fixní drawer na mobilu, sticky sloupec na desktopu */}
      <div
        className={[
          'fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:z-auto lg:shrink-0',
        ].join(' ')}
      >
        <AdminSidebar role={role} name={name} onClose={() => setMobileOpen(false)} />
      </div>

      {/* Hlavní obsah */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Hamburger — pouze na mobilu */}
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
              aria-label="Otevřít menu"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
              Administrace
            </h1>
          </div>
          <form action="/logout" method="POST">
            <button
              type="submit"
              className="text-sm text-gray-500 transition-colors hover:text-red-600"
            >
              Odhlásit
            </button>
          </form>
        </header>

        <main className="flex-1 p-4 lg:p-6 xl:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
