'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { User, Settings, LogOut } from 'lucide-react'

export type AvatarUser = {
  email: string
  fullName?: string | null
  avatarUrl?: string | null
  role: string
}

function getInitials(name?: string | null, email?: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }
  return (email ?? '?').slice(0, 2).toUpperCase()
}

export function AvatarMenu({ email, fullName, avatarUrl, role }: AvatarUser) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const isPrivileged = role === 'admin' || role === 'manager'
  const initials = getInitials(fullName, email)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label="Uživatelské menu"
        aria-expanded={open}
        className="flex items-center justify-center w-9 h-9 rounded-full overflow-hidden ring-2 ring-transparent hover:ring-green-400 focus:outline-none focus:ring-green-500 transition-all"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-green-600 flex items-center justify-center text-white text-xs font-bold select-none">
            {initials}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden">
          {/* Identity */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="font-semibold text-gray-900 text-sm truncate">{fullName ?? email}</div>
            {fullName && <div className="text-xs text-gray-400 truncate mt-0.5">{email}</div>}
          </div>

          {/* Links */}
          <div className="py-1">
            <Link
              href="/clenove/profil"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:text-green-700 hover:bg-green-50 transition-colors"
            >
              <User size={15} />
              Profil
            </Link>
            {isPrivileged && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:text-green-700 hover:bg-green-50 transition-colors"
              >
                <Settings size={15} />
                Administrace
              </Link>
            )}
          </div>

          {/* Logout */}
          <div className="border-t border-gray-100 py-1">
            <form action="/logout" method="POST">
              <button
                type="submit"
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut size={15} />
                Odhlásit
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
