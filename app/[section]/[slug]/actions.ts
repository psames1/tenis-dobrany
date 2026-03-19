'use server'

import { createClient } from '@/lib/supabase/server'
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
