'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function addComment(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Pro přidání komentáře se musíte přihlásit.' }

  const pageId = (formData.get('page_id') as string | null)?.trim()
  const sectionSlug = (formData.get('section_slug') as string | null)?.trim()
  const articleSlug = (formData.get('article_slug') as string | null)?.trim()
  const content = (formData.get('content') as string | null)?.trim() ?? ''

  if (!pageId || !sectionSlug || !articleSlug) return { error: 'Neplatný požadavek.' }
  if (content.length < 2) return { error: 'Komentář je příliš krátký.' }
  if (content.length > 2000) return { error: 'Komentář je příliš dlouhý (max. 2000 znaků).' }

  const { error } = await supabase.from('page_comments').insert({
    page_id: pageId,
    user_id: user.id,
    content,
  })

  if (error) {
    // RLS violation = comments not enabled or user not a member
    if (error.code === '42501') return { error: 'Komentáře nejsou pro tento článek povoleny.' }
    return { error: error.message }
  }

  revalidatePath(`/${sectionSlug}/${articleSlug}`)
  return {}
}

export async function deleteComment(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Nejste přihlášeni.' }

  const commentId = (formData.get('comment_id') as string | null)?.trim()
  const sectionSlug = (formData.get('section_slug') as string | null)?.trim()
  const articleSlug = (formData.get('article_slug') as string | null)?.trim()
  if (!commentId || !sectionSlug || !articleSlug) return { error: 'Neplatný požadavek.' }

  // Verify ownership server-side before using admin client
  const { data: comment } = await supabase
    .from('page_comments')
    .select('user_id')
    .eq('id', commentId)
    .single()
  if (!comment) return { error: 'Komentář nenalezen.' }

  // Check role
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const isPrivileged = profile?.role === 'admin' || profile?.role === 'manager'

  if (comment.user_id !== user.id && !isPrivileged) {
    return { error: 'Nemáte oprávnění smazat tento komentář.' }
  }

  // Use admin client to bypass RLS for the delete
  const admin = createAdminClient()
  const { error } = await admin.from('page_comments').delete().eq('id', commentId)
  if (error) return { error: error.message }

  revalidatePath(`/${sectionSlug}/${articleSlug}`)
  return {}
}

export async function updateComment(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Nejste přihlášeni.' }

  const commentId = (formData.get('comment_id') as string | null)?.trim()
  const sectionSlug = (formData.get('section_slug') as string | null)?.trim()
  const articleSlug = (formData.get('article_slug') as string | null)?.trim()
  const content = (formData.get('content') as string | null)?.trim() ?? ''
  if (!commentId || !sectionSlug || !articleSlug) return { error: 'Neplatný požadavek.' }
  if (content.length < 2) return { error: 'Komentář je příliš krátký.' }
  if (content.length > 2000) return { error: 'Komentář je příliš dlouhý (max. 2000 znaků).' }

  // Verify ownership server-side
  const { data: comment } = await supabase
    .from('page_comments')
    .select('user_id')
    .eq('id', commentId)
    .single()
  if (!comment) return { error: 'Komentář nenalezen.' }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const isPrivileged = profile?.role === 'admin' || profile?.role === 'manager'

  if (comment.user_id !== user.id && !isPrivileged) {
    return { error: 'Nemáte oprávnění upravit tento komentář.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('page_comments')
    .update({ content })
    .eq('id', commentId)
  if (error) return { error: error.message }

  revalidatePath(`/${sectionSlug}/${articleSlug}`)
  return {}
}

export async function castPollVote(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Pro hlasování se musíte přihlásit.' }

  const pageId        = (formData.get('page_id')     as string | null)?.trim()
  const optionId      = (formData.get('option_id')    as string | null)?.trim()
  const sectionSlug   = (formData.get('section_slug') as string | null)?.trim()
  const articleSlug   = (formData.get('article_slug') as string | null)?.trim()
  const allowMultiple = formData.get('allow_multiple') === '1'
  const unvote        = formData.get('unvote') === '1'

  if (!pageId || !optionId || !sectionSlug || !articleSlug) return { error: 'Neplatný požadavek.' }

  if (unvote) {
    await supabase
      .from('page_poll_votes')
      .delete()
      .eq('option_id', optionId)
      .eq('user_id', user.id)
  } else {
    if (!allowMultiple) {
      // Jednoduchá volba: smazat předchozí hlasy uživatele v této anketě
      const { data: pageOptions } = await supabase
        .from('page_poll_options')
        .select('id')
        .eq('page_id', pageId)

      if (pageOptions && pageOptions.length > 0) {
        await supabase
          .from('page_poll_votes')
          .delete()
          .in('option_id', pageOptions.map(o => o.id))
          .eq('user_id', user.id)
      }
    }
    const { error } = await supabase
      .from('page_poll_votes')
      .upsert({ option_id: optionId, user_id: user.id })
    if (error) return { error: error.message }
  }

  revalidatePath(`/${sectionSlug}/${articleSlug}`)
  return {}
}
