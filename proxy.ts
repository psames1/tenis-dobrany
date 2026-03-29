import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Resolves the cookie domain based on request hostname.
 * - *.sportkalendar.cz → '.sportkalendar.cz' (shared across subdomains)
 * - Custom domain with subdomain (app.tenis-dobrany.cz) → '.tenis-dobrany.cz'
 * - Bare custom domain or localhost → undefined (browser default)
 */
function getCookieDomain(hostname: string): string | undefined {
  if (hostname === 'localhost' || hostname.startsWith('127.') || hostname.endsWith('.local')) {
    return undefined
  }
  if (hostname.endsWith('.sportkalendar.cz') || hostname === 'sportkalendar.cz') {
    return '.sportkalendar.cz'
  }
  const parts = hostname.split('.')
  if (parts.length > 2) {
    return '.' + parts.slice(-2).join('.')
  }
  return undefined
}

/**
 * Extracts organization context from the request hostname.
 */
function resolveOrgContext(hostname: string): {
  mode: 'app' | 'cms' | 'unknown'
  slug: string | null
  isCustomDomain: boolean
} {
  if (hostname === 'localhost' || hostname.startsWith('127.') || hostname.endsWith('.local')) {
    return { mode: 'cms', slug: null, isCustomDomain: false }
  }
  if (hostname === 'app.sportkalendar.cz' || hostname === 'sportkalendar.cz') {
    return { mode: 'app', slug: null, isCustomDomain: false }
  }
  if (hostname.endsWith('.sportkalendar.cz')) {
    const slug = hostname.replace('.sportkalendar.cz', '')
    return { mode: 'cms', slug, isCustomDomain: false }
  }
  const parts = hostname.split('.')
  if (parts[0] === 'app' && parts.length > 2) {
    return { mode: 'app', slug: null, isCustomDomain: true }
  }
  return { mode: 'cms', slug: null, isCustomDomain: true }
}

// Routes requiring an authenticated session
const PROTECTED_PREFIXES = ['/clenove', '/admin', '/dashboard', '/rezervace', '/moje-rezervace', '/tymy', '/udalosti', '/platby', '/ankety', '/nastaveni']
// Routes only for unauthenticated users (redirect away if already logged in)
const AUTH_ONLY_PATHS = ['/login']

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const hostname = request.headers.get('host')?.split(':')[0] ?? 'localhost'
  const cookieDomain = getCookieDomain(hostname)
  const orgContext = resolveOrgContext(hostname)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              ...(cookieDomain ? { domain: cookieDomain } : {}),
            })
          )
        },
      },
    }
  )

  // IMPORTANT: Always call getUser() — refreshes the session token.
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Set organization context headers for server components
  supabaseResponse.headers.set('x-org-mode', orgContext.mode)
  if (orgContext.slug) {
    supabaseResponse.headers.set('x-org-slug', orgContext.slug)
  }
  supabaseResponse.headers.set('x-org-custom-domain', orgContext.isCustomDomain ? '1' : '0')
  supabaseResponse.headers.set('x-hostname', hostname)
  if (cookieDomain) {
    supabaseResponse.headers.set('x-cookie-domain', cookieDomain)
  }

  // Unauthenticated user tries to access a protected route
  if (!user && PROTECTED_PREFIXES.some(p => pathname.startsWith(p))) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Authenticated user tries to access /login — send them home
  if (user && AUTH_ONLY_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
