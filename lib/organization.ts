import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type OrgMode = 'app' | 'cms' | 'unknown'

export interface OrgContext {
  mode: OrgMode
  slug: string | null
  isCustomDomain: boolean
  hostname: string
}

/**
 * Get organization context from middleware headers (set in middleware.ts).
 * Use in Server Components and Server Actions.
 */
export async function getOrgContext(): Promise<OrgContext> {
  const headersList = await headers()
  return {
    mode: (headersList.get('x-org-mode') as OrgMode) ?? 'cms',
    slug: headersList.get('x-org-slug'),
    isCustomDomain: headersList.get('x-org-custom-domain') === '1',
    hostname: headersList.get('x-hostname') ?? 'localhost',
  }
}

/**
 * Resolve full organization from DB based on slug or custom domain.
 * On localhost/dev: falls back to user's default_organization_id or first membership.
 * Returns null if not found.
 */
export async function getOrganization() {
  const ctx = await getOrgContext()
  // Use admin client for org lookup — bypasses RLS (org resolution is routing
  // context, not sensitive data) and avoids issues with unauthenticated pages
  // or cross-domain session cookies.
  const admin = createAdminClient()

  if (ctx.slug) {
    // Lookup by slug (subdomain)
    const { data } = await admin
      .from('app_organizations')
      .select('*')
      .eq('slug', ctx.slug)
      .eq('is_active', true)
      .single()
    return data
  }

  if (ctx.isCustomDomain) {
    // Lookup by custom domain — strip leading app. or www.
    const baseDomain = ctx.hostname
      .replace(/^app\./, '')
      .replace(/^www\./, '')
    const { data } = await admin
      .from('app_organizations')
      .select('*')
      .eq('custom_domain', baseDomain)
      .eq('is_active', true)
      .single()
    if (data) return data
    // Fallback: if custom domain not yet set in DB, try env slug
  }

  // Fallback pro localhost / dev prostředí:
  // 1. Pokud je v env nastavený NEXT_PUBLIC_ORG_SLUG, použij ho
  const envSlug = process.env.NEXT_PUBLIC_ORG_SLUG
  if (envSlug) {
    const { data } = await admin
      .from('app_organizations')
      .select('*')
      .eq('slug', envSlug)
      .eq('is_active', true)
      .single()
    if (data) return data
  }

  // 2. Použij default_organization_id z profilu přihlášeného uživatele
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('default_organization_id')
      .eq('id', user.id)
      .single()

    if (profile?.default_organization_id) {
      const { data } = await admin
        .from('app_organizations')
        .select('*')
        .eq('id', profile.default_organization_id)
        .eq('is_active', true)
        .single()
      if (data) return data
    }

    // 3. Poslední záchrana — první aktivní organizace uživatele
    const { data: membership } = await admin
      .from('app_organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .single()

    if (membership?.organization_id) {
      const { data } = await admin
        .from('app_organizations')
        .select('*')
        .eq('id', membership.organization_id)
        .eq('is_active', true)
        .single()
      if (data) return data
    }
  }

  return null
}

/**
 * Get the current user's role in a specific organization.
 * Returns null if user is not a member.
 */
export async function getUserOrgRole(organizationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('app_organization_members')
    .select('role, is_active')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .single()

  if (!data || !data.is_active) return null
  return data.role as 'admin' | 'manager' | 'player'
}

/**
 * Get all organizations the current user belongs to.
 */
export async function getUserOrganizations() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('app_organization_members')
    .select('role, organization_id, app_organizations(*)')
    .eq('user_id', user.id)
    .eq('is_active', true)

  return (data ?? []).map(m => ({
    role: m.role,
    organization: m.app_organizations as unknown as {
      id: string
      name: string
      slug: string
      sport_types: string[]
      active_modules: string[]
      custom_domain: string | null
      settings: Record<string, unknown>
    },
  }))
}

/**
 * Get the user's default organization (from user_profiles.default_organization_id)
 * or the first organization they belong to.
 */
export async function getDefaultOrganization() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Check user_profiles.default_organization_id
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('default_organization_id')
    .eq('id', user.id)
    .single()

  if (profile?.default_organization_id) {
    const { data: org } = await supabase
      .from('app_organizations')
      .select('*')
      .eq('id', profile.default_organization_id)
      .eq('is_active', true)
      .single()
    if (org) return org
  }

  // Fallback: first organization the user belongs to
  const orgs = await getUserOrganizations()
  return orgs[0]?.organization ?? null
}
