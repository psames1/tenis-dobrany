import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { User, BookOpen, Settings } from 'lucide-react'

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?redirectTo=/clenove')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, email, role, is_active')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_active) redirect('/?error=account_inactive')

  const displayName = profile.full_name ?? profile.email ?? user.email ?? 'Člen'
  const isPrivileged = profile.role === 'admin' || profile.role === 'manager'

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Hlavička sekce */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <span className="text-green-700 font-semibold text-sm">Členská sekce</span>
              <span className="text-gray-300">|</span>
              <span className="text-sm text-gray-500 truncate max-w-xs">{displayName}</span>
            </div>

            {/* Sub-navigace */}
            <nav className="hidden sm:flex items-center gap-1 text-sm">
              <Link
                href="/clenove"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-gray-600 hover:text-green-700 hover:bg-green-50 transition-colors"
              >
                <BookOpen size={14} />
                Přehled
              </Link>
              <Link
                href="/clenove/profil"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-gray-600 hover:text-green-700 hover:bg-green-50 transition-colors"
              >
                <User size={14} />
                Profil
              </Link>
              {isPrivileged && (
                <Link
                  href="/admin"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-gray-600 hover:text-green-700 hover:bg-green-50 transition-colors"
                >
                  <Settings size={14} />
                  Administrace
                </Link>
              )}
            </nav>
          </div>
        </div>
      </div>

      {/* Obsah */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
