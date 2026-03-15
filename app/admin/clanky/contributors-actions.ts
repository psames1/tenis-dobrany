'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function requireManagerOrAbove() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    redirect('/?error=forbidden')
  }
  return { supabase, user }
}

// ─── Přidat spoluautora na článek ─────────────────────────────────────────────

export async function addArticleContributor(
  pageId: string,
  email: string
): Promise<{ error?: string }> {
  const { supabase, user } = await requireManagerOrAbove()

  const cleanEmail = email.trim().toLowerCase()
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { error: 'Neplatný email.' }
  }

  // Zkus najít existujícího uživatele
  const { data: existingProfile } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('email', cleanEmail)
    .maybeSingle()

  // Vlož záznam contributora
  const { error: insertError } = await supabase
    .from('article_contributors')
    .insert({
      page_id:    pageId,
      user_id:    existingProfile?.id ?? null,
      email:      cleanEmail,
      invited_by: user.id,
    })

  if (insertError) {
    if (insertError.code === '23505') return { error: 'Tento uživatel je již spoluautorem.' }
    return { error: insertError.message }
  }

  // Pokud uživatel neexistuje — pošli pozvánku Supabase emailem
  if (!existingProfile) {
    try {
      const admin = createAdminClient()
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
      await admin.auth.admin.inviteUserByEmail(cleanEmail, {
        redirectTo: `${siteUrl}/callback`,
      })
    } catch {
      // Invite je bonus — záznam byl přidán, selhání emailu není kritické
    }
  }

  revalidatePath(`/admin/clanky/${pageId}/upravit`)
  return {}
}

// ─── Odebrat spoluautora ──────────────────────────────────────────────────────

export async function removeArticleContributor(
  contributorId: string
): Promise<{ error?: string }> {
  const { supabase } = await requireManagerOrAbove()

  const { error } = await supabase
    .from('article_contributors')
    .delete()
    .eq('id', contributorId)

  if (error) return { error: error.message }
  return {}
}
