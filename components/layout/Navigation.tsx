import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { MobileMenu } from './MobileMenu'
import { AvatarMenu } from './AvatarMenu'
import { ChevronDown } from 'lucide-react'

export type NavItem = {
  id: string
  label: string
  href: string
  children?: NavItem[]
}

export async function Navigation() {
  const supabase = await createClient()

  const [{ data: sections }, { data: menuPages }, { data: { user } }] = await Promise.all([
    supabase
      .from('sections')
      .select('id, slug, title, menu_title, menu_url, menu_parent_id')
      .eq('is_active', true)
      .eq('show_in_menu', true)
      .order('menu_order'),
    supabase
      .from('pages')
      .select('id, title, slug, section_id')
      .eq('is_active', true)
      .eq('show_in_menu', true)
      .order('sort_order', { ascending: false }),
    supabase.auth.getUser(),
  ])

  // Fetch profile for avatar + role-based links
  let profile: { full_name: string | null; avatar_url: string | null; role: string } | null = null
  if (user) {
    const { data } = await supabase
      .from('user_profiles')
      .select('full_name, avatar_url, role')
      .eq('id', user.id)
      .single()
    profile = data
  }

  // Seskup stránky podle section_id
  const pagesBySection = new Map<string, { id: string; title: string; slug: string; section_id: string }[]>()
  for (const page of menuPages ?? []) {
    if (!page.section_id) continue
    if (!pagesBySection.has(page.section_id)) pagesBySection.set(page.section_id, [])
    pagesBySection.get(page.section_id)!.push(page as { id: string; title: string; slug: string; section_id: string })
  }

  // Top-level sekce s volitelnými dětmi (stránky v podmenu)
  const navItems: NavItem[] = (sections ?? [])
    .filter(s => !s.menu_parent_id)
    .map(s => {
      const sectionSlug = s.slug
      const children: NavItem[] = (pagesBySection.get(s.id) ?? []).map(p => ({
        id: p.id,
        label: p.title,
        href: `/${sectionSlug}/${p.slug}`,
      }))
      return {
        id: s.id,
        label: s.menu_title ?? s.title,
        href: s.menu_url ?? `/${s.slug}`,
        ...(children.length ? { children } : {}),
      }
    })

  const authUser = user
    ? {
        email: user.email ?? '',
        fullName: profile?.full_name ?? null,
        avatarUrl: profile?.avatar_url ?? null,
        role: profile?.role ?? 'member',
      }
    : null

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
            {navItems.map(item =>
              item.children?.length ? (
                // Položka s podmenu — CSS hover dropdown
                <div key={item.id} className="relative group">
                  <Link
                    href={item.href}
                    className="flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-green-700 hover:bg-green-50 transition-colors"
                  >
                    {item.label}
                    <ChevronDown
                      size={13}
                      className="transition-transform duration-200 group-hover:rotate-180 text-gray-400"
                    />
                  </Link>
                  {/* Dropdown */}
                  <div className="absolute top-full left-0 pt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
                    <div className="bg-white rounded-lg shadow-lg border border-gray-100 py-1 min-w-[200px]">
                      {item.children.map(child => (
                        <Link
                          key={child.id}
                          href={child.href}
                          className="block px-4 py-2 text-sm text-gray-700 hover:text-green-700 hover:bg-green-50 transition-colors whitespace-nowrap"
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                // Položka bez podmenu
                <Link
                  key={item.id}
                  href={item.href}
                  className="px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-green-700 hover:bg-green-50 transition-colors"
                >
                  {item.label}
                </Link>
              )
            )}
          </div>

          {/* Pravá strana: avatar/přihlášení + mobilní menu */}
          <div className="flex items-center gap-2">
            {authUser ? (
              <div className="hidden md:block">
                <AvatarMenu
                  email={authUser.email}
                  fullName={authUser.fullName}
                  avatarUrl={authUser.avatarUrl}
                  role={authUser.role}
                />
              </div>
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
