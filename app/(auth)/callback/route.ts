import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
  const type = searchParams.get('type') // 'recovery' | 'invite' | null
  const next = searchParams.get('next') ?? '/'
  // Guard against open-redirect: only allow relative paths
  const safeNext = next.startsWith('/') ? next : '/'

  // Po resetu hesla → profil (kde si uživatel nastaví nové heslo přes ChangePasswordForm)
  // Po pozvánce → profil (první přihlášení, doporučíme nastavit heslo)
  const resolvedNext =
    type === 'recovery' ? '/clenove/profil?setup=heslo' :
    type === 'invite'   ? '/clenove/profil?welcome=1' :
    safeNext

  console.log('[callback] code present:', !!code, '| type:', type, '| next:', resolvedNext, '| origin:', origin)

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

      // Auto-enroll uživatele do organizace podle subdomény nebo vlastní domény (pokud ještě není členem)
      try {
        const headersList = await headers()
        const orgSlug = headersList.get('x-org-slug')
        const hostname = headersList.get('x-hostname') ?? ''
        const isCustomDomain = headersList.get('x-org-custom-domain') === '1'

        const adminClient = createAdminClient()
        let orgId: string | null = null

        if (orgSlug) {
          const { data: org } = await adminClient
            .from('app_organizations')
            .select('id')
            .eq('slug', orgSlug)
            .eq('is_active', true)
            .single()
          orgId = org?.id ?? null
        } else if (isCustomDomain && hostname) {
          // Vlastní doména: tenis-dobrany.cz nebo www.tenis-dobrany.cz
          const baseDomain = hostname.replace(/^www\./, '')
          const { data: org } = await adminClient
            .from('app_organizations')
            .select('id')
            .eq('custom_domain', baseDomain)
            .eq('is_active', true)
            .single()
          orgId = org?.id ?? null
        }

        if (orgId) {
          // ignoreDuplicates: true = při konfliktu (user_id, org) nic nezmění (zachová vyšší roli)
          await adminClient
            .from('app_organization_members')
            .upsert(
              { organization_id: orgId, user_id: user.id, role: 'player', is_active: true },
              { onConflict: 'organization_id,user_id', ignoreDuplicates: true }
            )
          // Nastav default_organization_id, pokud ještě není
          await adminClient
            .from('user_profiles')
            .update({ default_organization_id: orgId })
            .eq('id', user.id)
            .is('default_organization_id', null)
        }
      } catch (enrollError) {
        // Logovat ale nepřerušit — přihlášení proběhne i bez auto-enrollu
        console.warn('[callback] auto-enroll error:', enrollError)
      }
    }

    return NextResponse.redirect(new URL(resolvedNext, origin))
  }

  return NextResponse.redirect(
    new URL(`/login?error=auth&detail=${encodeURIComponent(error.message)}`, origin)
  )
}
