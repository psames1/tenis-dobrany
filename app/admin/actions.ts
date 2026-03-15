'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

// Převod názvu na URL-friendly slug (s podporou češtiny)
function toSlug(text: string): string {
  const map: Record<string, string> = {
    á: 'a', č: 'c', ď: 'd', é: 'e', ě: 'e', í: 'i', ň: 'n',
    ó: 'o', ř: 'r', š: 's', ť: 't', ú: 'u', ů: 'u', ý: 'y', ž: 'z',
  }
  return text
    .toLowerCase()
    .replace(/[áčďéěíňóřšťúůýž]/g, c => map[c] ?? c)
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 100)
}

// ─── Uložit článek (vytvoření nebo úprava) ───────────────────────────────────

export async function saveArticle(formData: FormData) {
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

  const id         = formData.get('id') as string | null
  const title      = (formData.get('title') as string).trim()
  const sectionId  = formData.get('section_id') as string
  const excerpt    = (formData.get('excerpt') as string | null)?.trim() || null
  const content    = (formData.get('content') as string | null)?.trim() || null
  const imageUrl   = (formData.get('image_url') as string | null)?.trim() || null
  const isActive   = formData.get('is_active') === '1'
  const isMembersOnly = formData.get('is_members_only') === '1'
  const publishedAt = (formData.get('published_at') as string | null) || new Date().toISOString()

  if (!title || !sectionId) {
    redirect('/admin/clanky?error=missing_fields')
  }

  const slug = toSlug(title)

  if (id) {
    // ── Úprava existujícího článku ─────────────────────────────────────────
    const { error } = await supabase
      .from('pages')
      .update({
        title,
        section_id: sectionId,
        excerpt,
        content,
        image_url: imageUrl,
        is_active: isActive,
        is_members_only: isMembersOnly,
        published_at: publishedAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      redirect(`/admin/clanky/${id}/upravit?error=${encodeURIComponent(error.message)}`)
    }
    redirect(`/admin/clanky/${id}/upravit?success=1`)
  } else {
    // ── Nový článek ───────────────────────────────────────────────────────
    const { data: inserted, error } = await supabase
      .from('pages')
      .insert({
        title,
        slug,
        section_id: sectionId,
        excerpt,
        content,
        image_url: imageUrl,
        is_active: isActive,
        is_members_only: isMembersOnly,
        published_at: publishedAt,
        created_by: user.id,
      })
      .select('id')
      .single()

    if (error) {
      redirect(`/admin/clanky/novy?error=${encodeURIComponent(error.message)}`)
    }
    redirect(`/admin/clanky/${inserted.id}/upravit?success=1`)
  }
}

// ─── Smazat článek ───────────────────────────────────────────────────────────

export async function deleteArticle(formData: FormData) {
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

  const id = formData.get('id') as string
  if (!id) redirect('/admin/clanky')

  await supabase.from('pages').delete().eq('id', id)
  redirect('/admin/clanky')
}

// ─── Uložit sekci ────────────────────────────────────────────────────────────

export async function saveSection(formData: FormData) {
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

  const id          = formData.get('id') as string
  const title       = (formData.get('title') as string).trim()
  const menuTitle   = (formData.get('menu_title') as string | null)?.trim() || null
  const description = (formData.get('description') as string | null)?.trim() || null
  const menuOrder   = parseInt(formData.get('menu_order') as string, 10) || 0
  const showInMenu  = formData.get('show_in_menu') === '1'
  const isActive    = formData.get('is_active') === '1'

  const { error } = await supabase
    .from('sections')
    .update({ title, menu_title: menuTitle, description, menu_order: menuOrder, show_in_menu: showInMenu, is_active: isActive })
    .eq('id', id)

  if (error) {
    redirect(`/admin/sekce?error=${encodeURIComponent(error.message)}`)
  }
  redirect('/admin/sekce?success=1')
}
