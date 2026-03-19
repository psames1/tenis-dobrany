import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

/**
 * GET /callback
 *
 * Handles the OAuth code exchange after Google (or any other provider)
 * redirects back to the app. Supabase appends `?code=<one-time-code>`.
 *
 * The optional `next` query param carries the original destination
 * so the user lands where they intended after login.
 *
 * Configure in Supabase Dashboard → Authentication → URL Configuration:
 *   Site URL:      https://tenis-dobrany.sportkalendar.cz
 *   Redirect URL:  https://tenis-dobrany.sportkalendar.cz/callback
 *   + localhost:   http://localhost:3000/callback (for local dev)
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)

  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'
  // Guard against open-redirect: only allow relative paths
  const safeNext = next.startsWith('/') ? next : '/'

  console.log('[callback] code present:', !!code, '| next:', safeNext, '| origin:', origin)

  if (!code) {
    console.warn('[callback] no code param in URL')
    return NextResponse.redirect(new URL('/login?error=auth', origin))
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Detect the common misconfiguration where the anon key is set to the
  // project reference ID instead of the full JWT (eyJ...).
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[callback] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing')
    return NextResponse.redirect(new URL('/login?error=config', origin))
  }
  if (!supabaseAnonKey.startsWith('eyJ')) {
    console.error(
      '[callback] NEXT_PUBLIC_SUPABASE_ANON_KEY looks invalid — expected a JWT starting with "eyJ", got:',
      supabaseAnonKey.slice(0, 20)
    )
    return NextResponse.redirect(new URL('/login?error=config', origin))
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        )
      },
    },
  })

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  console.log('[callback] exchangeCodeForSession error:', error?.message ?? 'none')

  if (!error) {
    // Guard: block unknown / not-yet-approved OAuth users.
    // We check user_profiles.is_active instead of inspecting identities,
    // which means:
    //   - Existing admin/member (any provider, active) → allowed through
    //   - Invited user (email, active by trigger) → allowed through
    //   - Brand-new Google user (trigger sets is_active=false) → blocked
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('is_active')
        .eq('id', user.id)
        .maybeSingle()

      if (!profile || !profile.is_active) {
        console.warn('[callback] user blocked (no profile or inactive):', user.email)
        await supabase.auth.signOut()
        return NextResponse.redirect(new URL('/login?error=uninvited', origin))
      }
    }

    return NextResponse.redirect(new URL(safeNext, origin))
  }

  return NextResponse.redirect(
    new URL(`/login?error=auth&detail=${encodeURIComponent(error.message)}`, origin)
  )
}
