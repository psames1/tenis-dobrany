'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

// ─── Uložit profil ────────────────────────────────────────────────────────────

export async function saveProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const fullName = (formData.get('full_name') as string | null)?.trim() || null
  const phone    = (formData.get('phone') as string | null)?.trim() || null

  const { error } = await supabase
    .from('user_profiles')
    .update({ full_name: fullName, phone })
    .eq('id', user.id)

  if (error) redirect(`/clenove/profil?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/clenove')
  revalidatePath('/clenove/profil')
  redirect('/clenove/profil?success=1')
}

// ─── Uložit obsah článku + galerii (contributor) ──────────────────────────────

export async function saveContributorArticle(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const pageId  = formData.get('page_id') as string
  const content = (formData.get('content') as string | null)?.trim() || null

  if (!pageId) redirect('/clenove?error=missing_page')

  // Ověř, že je uživatel spoluautor nebo manager/admin
  const [{ data: contributor }, { data: profile }] = await Promise.all([
    supabase
      .from('article_contributors')
      .select('id')
      .eq('page_id', pageId)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single(),
  ])

  const isManagerOrAbove = profile && ['admin', 'manager'].includes(profile.role)
  if (!contributor && !isManagerOrAbove) {
    redirect('/clenove?error=forbidden')
  }

  // Uprav obsah
  const { error: pageError } = await supabase
    .from('pages')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', pageId)

  if (pageError) {
    redirect(`/clenove/clanky/${pageId}/upravit?error=${encodeURIComponent(pageError.message)}`)
  }

  // Uprav galerii
  const galleryUrlsRaw = formData.get('gallery_urls') as string | null
  if (galleryUrlsRaw !== null) {
    try {
      const urls = JSON.parse(galleryUrlsRaw) as string[]
      await supabase.from('page_gallery').delete().eq('page_id', pageId)
      if (urls.length > 0) {
        await supabase.from('page_gallery').insert(
          urls.map((url, i) => ({ page_id: pageId, public_url: url, sort_order: i }))
        )
      }
    } catch {
      // Nekritická chyba galerie
    }
  }

  revalidatePath('/clenove')
  redirect(`/clenove/clanky/${pageId}/upravit?success=1`)
}

// ─── Vytvořit článek v sekci (pro sekční editory) ─────────────────────────────

export async function createSectionArticle(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const sectionId   = formData.get('section_id')   as string
  const sectionSlug = formData.get('section_slug')  as string
  const title       = (formData.get('title')   as string)?.trim()
  const excerpt     = (formData.get('excerpt') as string)?.trim() || null
  const content     = (formData.get('content') as string)?.trim() || null
  const visibility  = (formData.get('visibility') as string) === 'member' ? 'member' : 'public'

  if (!title || !sectionId) redirect('/clenove?error=missing_data')

  // Ověř oprávnění na sekci
  const { data: memberships } = await supabase
    .from('user_group_members').select('group_id').eq('user_id', user.id)
  const groupIds = (memberships ?? []).map(m => m.group_id)
  if (groupIds.length === 0) redirect('/clenove?error=forbidden')

  const { data: perms } = await supabase
    .from('section_group_permissions')
    .select('can_create_articles')
    .eq('section_id', sectionId)
    .in('group_id', groupIds)
    .eq('can_create_articles', true)
    .limit(1)
  if (!perms || perms.length === 0) redirect('/clenove?error=forbidden')

  // Vygeneruj unikátní slug z názvu
  const slugBase = title
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  let slug = slugBase
  let suffix = 1
  while (true) {
    const { data: existing } = await supabase
      .from('pages').select('id').eq('section_id', sectionId).eq('slug', slug).maybeSingle()
    if (!existing) break
    slug = `${slugBase}-${suffix++}`
  }

  const { data: page, error } = await supabase
    .from('pages')
    .insert({ section_id: sectionId, slug, title, excerpt, content, visibility, created_by: user.id, is_active: true })
    .select('slug')
    .single()

  if (error || !page) {
    redirect(`/clenove/sekce/${sectionSlug}/novy?error=${encodeURIComponent(error?.message ?? 'Neznámá chyba')}`)
  }

  revalidatePath(`/${sectionSlug}`)
  redirect(`/${sectionSlug}/${page.slug}`)
}
