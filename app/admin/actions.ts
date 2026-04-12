'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, getMailConfig } from '@/lib/email/mailer'
import { buildArticleEmailHtml, stripHtml } from '@/lib/email/templates'
import { getOrganization } from '@/lib/organization'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

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
  const sendNotification = formData.get('send_notification') === '1'
  const isActive   = formData.get('is_active') === '1'
  const isNews     = formData.get('is_news') === '1'
  const visibility = (formData.get('visibility') as string | null) || 'public'
  const isMembersOnly = visibility !== 'public'
  const showInMenu = formData.get('show_in_menu') === '1'
  const allowComments = formData.get('allow_comments') === '1'
  const allowPoll      = formData.get('allow_poll') === '1'
  const pollQuestion   = (formData.get('poll_question') as string | null)?.trim() || null
  const pollAllowMulti = formData.get('poll_allow_multiple') === '1'
  const sortOrder  = parseInt((formData.get('sort_order') as string | null) ?? '0', 10) || 0
  const publishedAt = (formData.get('published_at') as string | null) || new Date().toISOString()

  if (!title || !sectionId) {
    redirect('/admin/clanky?error=missing_fields')
  }

  const slug = toSlug(title)

  let targetId: string

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
        is_news: isNews,
        visibility,
        show_in_menu: showInMenu,
        allow_comments: allowComments,
        allow_poll: allowPoll,
        poll_question: pollQuestion,
        poll_allow_multiple: pollAllowMulti,
        sort_order: sortOrder,
        published_at: publishedAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      redirect(`/admin/clanky/${id}/upravit?error=${encodeURIComponent(error.message)}`)
    }
    targetId = id
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
        is_news: isNews,
        visibility,
        show_in_menu: showInMenu,
        allow_comments: allowComments,
        allow_poll: allowPoll,
        poll_question: pollQuestion,
        poll_allow_multiple: pollAllowMulti,
        sort_order: sortOrder,
        published_at: publishedAt,
        created_by: user.id,
      })
      .select('id')
      .single()

    if (error) {
      redirect(`/admin/clanky/novy?error=${encodeURIComponent(error.message)}`)
    }
    targetId = inserted.id
  }

  // ── Uložit fotogalerii ────────────────────────────────────────────────────
  const galleryUrlsRaw = formData.get('gallery_urls') as string | null
  if (galleryUrlsRaw !== null) {
    try {
      const urls = JSON.parse(galleryUrlsRaw) as string[]
      await supabase.from('page_gallery').delete().eq('page_id', targetId)
      if (urls.length > 0) {
        await supabase.from('page_gallery').insert(
          urls.map((url, i) => ({
            page_id: targetId,
            public_url: url,
            sort_order: i,
          }))
        )
      }
    } catch {
      // Chyba galerie je nekritická — článek byl uložen
    }
  }

  // ── Uložit přílohy (dokumenty) ────────────────────────────────────────────
  const docsJson = formData.get('documents_json') as string | null
  if (docsJson !== null) {
    try {
      type DocInput = { title: string; description: string; file_url: string; document_date?: string }
      const docs = JSON.parse(docsJson) as DocInput[]
      await supabase.from('page_documents').delete().eq('page_id', targetId)
      const validDocs = docs.filter(d => d.title?.trim() && d.file_url?.trim())
      if (validDocs.length > 0) {
        await supabase.from('page_documents').insert(
          validDocs.map((d, i) => ({
            page_id: targetId,
            title: d.title.trim(),
            description: d.description?.trim() || null,
            file_url: d.file_url.trim(),
            document_date: d.document_date || new Date().toISOString().slice(0, 10),
            sort_order: i,
          }))
        )
      }
    } catch {
      // Chyba příloh je nekritická — článek byl uložen
    }
  }

  // ── Uložit možnosti ankety ────────────────────────────────────────────────
  const pollOptionsJson = formData.get('poll_options_json') as string | null
  if (pollOptionsJson !== null) {
    try {
      type PollOptInput = { label: string }
      const opts = JSON.parse(pollOptionsJson) as PollOptInput[]
      await supabase.from('page_poll_options').delete().eq('page_id', targetId)
      const validOpts = opts.filter(o => o.label?.trim())
      if (validOpts.length > 0 && allowPoll) {
        await supabase.from('page_poll_options').insert(
          validOpts.map((o, i) => ({
            page_id: targetId,
            label: o.label.trim(),
            sort_order: i,
          }))
        )
      }
    } catch {
      // Chyba ankety je nekritická — článek byl uložen
    }
  }

  // ── Odeslat e-mailové notifikace ─────────────────────────────────────────
  let notifiedCount = 0
  if (sendNotification) {
    try {
      const adminClient = await createAdminClient()

      // Zjistit slug článku a sekce
      const { data: pageRow } = await adminClient
        .from('pages')
        .select('slug, sections!section_id ( slug )')
        .eq('id', targetId)
        .single()

      const sectionSlug =
        pageRow && !Array.isArray(pageRow.sections) && pageRow.sections
          ? (pageRow.sections as { slug: string }).slug
          : ''
      const articleSlug = pageRow?.slug ?? ''
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tenis-dobrany.cz'
      const articleUrl = `${siteUrl}/${sectionSlug}/${articleSlug}`

      // Určit příjemce podle viditelnosti článku
      const adminQ = adminClient
        .from('user_profiles')
        .select('email')
        .eq('is_active', true)
        .not('email', 'is', null)

      const { data: recipients } = visibility === 'admin'
        ? await adminQ.eq('role', 'admin')
        : visibility === 'editor'
          ? await adminQ.in('role', ['manager', 'admin'])
          : await adminQ.in('role', ['member', 'manager', 'admin'])

      const emails = (recipients ?? []).map(r => r.email as string).filter(Boolean)

      if (emails.length > 0) {
        const isNewArticle = !id
        const subject = isNewArticle ? `Nový článek: ${title}` : `Aktualizace článku: ${title}`
        const previewText = excerpt ?? (content ? stripHtml(content) : null)
        const org = await getOrganization()
        const siteName = org?.name ?? 'SportKalendář'
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sportkalendar.cz'
        const html = buildArticleEmailHtml({
          siteName,
          siteUrl,
          title,
          excerpt: previewText,
          imageUrl,
          articleUrl,
          isNew: isNewArticle,
        })
        const config = await getMailConfig(org?.id)
        await sendEmail({ to: config.from, bcc: emails, subject, html, orgId: org?.id })
        notifiedCount = emails.length
      }
    } catch {
      // Selhání notifikace je nekritické — článek byl uložen
    }
  }

  const notifiedParam = notifiedCount > 0 ? `&notified=${notifiedCount}` : ''
  redirect(`/admin/clanky/${targetId}/upravit?success=1${notifiedParam}`)
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
  const parentIdRaw = (formData.get('parent_id') as string | null)?.trim() || null
  const parentId    = parentIdRaw || null
  const visibility  = (formData.get('visibility') as string | null) ?? 'public'

  const { error } = await supabase
    .from('sections')
    .update({ title, menu_title: menuTitle, description, menu_order: menuOrder, show_in_menu: showInMenu, is_active: isActive, menu_parent_id: parentId, visibility })
    .eq('id', id)

  if (error) {
    redirect(`/admin/sekce?error=${encodeURIComponent(error.message)}`)
  }
  redirect('/admin/sekce?success=1')
}

// ─── Vytvořit novou sekci ────────────────────────────────────────────────────

export async function createSection(formData: FormData) {
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

  const title = (formData.get('title') as string).trim()
  if (!title) redirect('/admin/sekce?error=missing_title')

  const parentIdRaw  = (formData.get('parent_id') as string | null)?.trim() || null
  const parentId     = parentIdRaw || null
  const visibility   = (formData.get('visibility') as string | null) ?? 'public'
  const showInMenu   = formData.get('show_in_menu') === '1'
  const isActive     = formData.get('is_active') === '1'

  const slug = toSlug(title)
  const { error } = await supabase.from('sections').insert({
    title, slug, menu_parent_id: parentId, visibility,
    show_in_menu: showInMenu, is_active: isActive,
  })

  if (error) {
    redirect(`/admin/sekce?error=${encodeURIComponent(error.message)}`)
  }
  redirect('/admin/sekce?success=1')
}

// ─── Smazat sekci ────────────────────────────────────────────────────────────

export async function deleteSection(formData: FormData) {
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
  if (!id) redirect('/admin/sekce')

  // Ověření, že sekce nemá články
  const { count } = await supabase
    .from('pages')
    .select('id', { count: 'exact', head: true })
    .eq('section_id', id)

  if (count && count > 0) {
    redirect(`/admin/sekce?error=${encodeURIComponent('Sekci nelze smazat — obsahuje ' + count + ' článků. Nejprve přesuňte nebo smažte články.')}`)
  }

  await supabase.from('sections').delete().eq('id', id)
  redirect('/admin/sekce?success=1')
}

// ─── Uložit oprávnění skupiny na sekci (ze stránky sekce) ───────────────────

export async function saveSectionGroupPermissions(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') redirect('/admin/sekce?error=forbidden')

  const groupId   = formData.get('group_id')   as string
  const sectionId = formData.get('section_id') as string
  const canView       = formData.get('can_view')               === '1'
  const canCreate     = formData.get('can_create_articles')    === '1'
  const canEdit       = formData.get('can_edit_articles')      === '1'
  const canDelete     = formData.get('can_delete_articles')    === '1'
  const canSubsection = formData.get('can_create_subsections') === '1'

  if (!groupId || !sectionId) redirect('/admin/sekce?error=missing_data')

  if (!canView && !canCreate && !canEdit && !canDelete && !canSubsection) {
    await supabase.from('section_group_permissions')
      .delete().eq('group_id', groupId).eq('section_id', sectionId)
  } else {
    const { error } = await supabase.from('section_group_permissions').upsert({
      group_id: groupId, section_id: sectionId,
      can_view: canView,
      can_create_articles: canCreate, can_edit_articles: canEdit,
      can_delete_articles: canDelete, can_create_subsections: canSubsection,
    }, { onConflict: 'group_id,section_id' })
    if (error) redirect(`/admin/sekce?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/admin/sekce')
  redirect('/admin/sekce?success=1')
}

// ─── Design: uložit page_component ──────────────────────────────────────────

export async function savePageComponent(formData: FormData) {
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
  const title = (formData.get('title') as string | null)?.trim() || null
  const subtitle = (formData.get('subtitle') as string | null)?.trim() || null
  const content = (formData.get('content') as string | null)?.trim() || null
  const sortOrder = parseInt(formData.get('sort_order') as string, 10) || 0
  const isActive = formData.get('is_active') === '1'

  // JSON data (pokud je vyplněno)
  let data: Record<string, unknown> = {}
  const dataRaw = (formData.get('data_json') as string | null)?.trim()
  if (dataRaw) {
    try { data = JSON.parse(dataRaw) } catch { /* ponechat {} */ }
  }

  const { error } = await supabase
    .from('page_components')
    .update({ title, subtitle, content, data, sort_order: sortOrder, is_active: isActive })
    .eq('id', id)

  if (error) {
    redirect(`/admin/design?tab=components&error=${encodeURIComponent(error.message)}`)
  }
  redirect('/admin/design?tab=components&success=1')
}

// ─── Design: uložit footer_content položku ──────────────────────────────────

export async function saveFooterItem(formData: FormData) {
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
  const content = (formData.get('content') as string | null)?.trim() || null
  const isActive = formData.get('is_active') === '1'

  let data: unknown = null
  const dataRaw = (formData.get('data_json') as string | null)?.trim()
  if (dataRaw) {
    try { data = JSON.parse(dataRaw) } catch { /* ponechat null */ }
  }

  const { error } = await supabase
    .from('footer_content')
    .update({ content, data, is_active: isActive })
    .eq('id', id)

  if (error) {
    redirect(`/admin/design?tab=footer&error=${encodeURIComponent(error.message)}`)
  }
  redirect('/admin/design?tab=footer&success=1')
}

// ─── Design: uložit site_setting ────────────────────────────────────────────

export async function saveSiteSetting(formData: FormData) {
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

  const key = formData.get('key') as string
  const value = (formData.get('value') as string)?.trim() ?? ''

  const { error } = await supabase
    .from('site_settings')
    .update({ value })
    .eq('key', key)

  if (error) {
    redirect(`/admin/design?tab=settings&error=${encodeURIComponent(error.message)}`)
  }
  redirect('/admin/design?tab=settings&success=1')
}

// ─── Design: vytvořit nový page_component ───────────────────────────────────

export async function createPageComponent(formData: FormData) {
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

  const pageKey = (formData.get('page_key') as string)?.trim() || 'home'
  const component = (formData.get('component') as string)?.trim()
  const title = (formData.get('title') as string | null)?.trim() || null

  if (!component) {
    redirect('/admin/design?tab=components&error=missing_component_type')
  }

  // Zjisti nejvyšší sort_order
  const { data: last } = await supabase
    .from('page_components')
    .select('sort_order')
    .eq('page_key', pageKey)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()

  const sortOrder = (last?.sort_order ?? 0) + 10

  const { error } = await supabase
    .from('page_components')
    .insert({ page_key: pageKey, component, title, sort_order: sortOrder, is_active: false })

  if (error) {
    redirect(`/admin/design?tab=components&error=${encodeURIComponent(error.message)}`)
  }
  redirect('/admin/design?tab=components&success=1')
}

// ─── Design: smazat page_component ──────────────────────────────────────────

export async function deletePageComponent(formData: FormData) {
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
  if (!id) redirect('/admin/design?tab=components')

  const { error } = await supabase.from('page_components').delete().eq('id', id)
  if (error) {
    redirect(`/admin/design?tab=components&error=${encodeURIComponent(error.message)}`)
  }
  redirect('/admin/design?tab=components&success=1')
}
