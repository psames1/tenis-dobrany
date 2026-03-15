import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { MobileMenu } from './MobileMenu'

export type NavItem = {
  id: string
  label: string
  href: string
}

export async function Navigation() {
  const supabase = await createClient()

  const [{ data: sections }, { data: { user } }] = await Promise.all([
    supabase
      .from('sections')
      .select('id, slug, title, menu_title, menu_url, menu_parent_id')
      .eq('is_active', true)
      .eq('show_in_menu', true)
      .order('menu_order'),
    supabase.auth.getUser(),
  ])

  // Top-level items only (podmenu v budoucnu)
  const navItems: NavItem[] = (sections ?? [])
    .filter(s => !s.menu_parent_id)
    .map(s => ({
      id: s.id,
      label: s.menu_title ?? s.title,
      href: s.menu_url ?? `/${s.slug}`,
    }))

  const authUser = user ? { email: user.email ?? '' } : null

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <nav className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 text-green-700 font-bold text-lg hover:text-green-800 transition-colors flex-shrink-0"
          >
            <span className="text-xl" aria-hidden="true">🎾</span>
            <span>TJ Dobřany</span>
          </Link>

          {/* Desktopové menu */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map(item => (
              <Link
                key={item.id}
                href={item.href}
                className="px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-green-700 hover:bg-green-50 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Pravá strana: auth + mobilní menu */}
          <div className="flex items-center gap-2">
            {/* Desktop: přihlášení tlačítko */}
            {authUser ? (
              <form action="/logout" method="POST" className="hidden md:block">
                <button
                  type="submit"
                  className="px-4 py-1.5 text-sm font-medium text-gray-500 hover:text-red-600 transition-colors"
                >
                  Odhlásit
                </button>
              </form>
            ) : (
              <Link
                href="/login"
                className="hidden md:block px-4 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Přihlásit se
              </Link>
            )}

            {/* Mobilní menu — Client Component pro interaktivitu */}
            <MobileMenu items={navItems} user={authUser} />
          </div>

        </div>
      </nav>
    </header>
  )
}
