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

  if (code) {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
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
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(new URL(safeNext, origin))
    }
  }

  // Something went wrong — back to login with an error flag
  return NextResponse.redirect(new URL('/login?error=auth', origin))
}
