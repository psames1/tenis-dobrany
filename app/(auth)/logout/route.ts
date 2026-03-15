import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

/**
 * POST /logout
 *
 * Signs the user out and redirects to the homepage.
 * Use POST (not GET) to prevent accidental logout via prefetch or link crawl.
 *
 * Usage — add to any layout/component:
 *
 *   <form action="/logout" method="POST">
 *     <button type="submit">Odhlásit se</button>
 *   </form>
 *
 * Or via fetch in a Client Component:
 *
 *   await fetch('/logout', { method: 'POST' })
 *   router.push('/')
 *   router.refresh()
 */
export async function POST(request: Request) {
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

  await supabase.auth.signOut()

  return NextResponse.redirect(new URL('/', request.url))
}
