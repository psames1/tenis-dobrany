'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase
    .from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/admin?error=forbidden')
  return supabase
}

// ─── Vytvořit skupinu ─────────────────────────────────────────────────────────

export async function createGroup(formData: FormData) {
  const supabase = await requireAdmin()
  const name        = (formData.get('name') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null
  if (!name) redirect('/admin/skupiny?error=missing_name')
  const { error } = await supabase.from('user_groups').insert({ name, description })
  if (error) redirect(`/admin/skupiny?error=${encodeURIComponent(error.message)}`)
  revalidatePath('/admin/skupiny')
  redirect('/admin/skupiny?success=created')
}

// ─── Smazat skupinu ───────────────────────────────────────────────────────────

export async function deleteGroup(formData: FormData) {
  const supabase = await requireAdmin()
  const id = formData.get('id') as string
  const { error } = await supabase.from('user_groups').delete().eq('id', id)
  if (error) redirect(`/admin/skupiny?error=${encodeURIComponent(error.message)}`)
  revalidatePath('/admin/skupiny')
  redirect('/admin/skupiny?success=deleted')
}

// ─── Přidat člena do skupiny ──────────────────────────────────────────────────

export async function addGroupMember(formData: FormData) {
  const supabase = await requireAdmin()
  const groupId = formData.get('group_id') as string
  const userId  = formData.get('user_id')  as string
  if (!groupId || !userId) redirect(`/admin/skupiny/${groupId}?error=missing_data`)
  const { error } = await supabase
    .from('user_group_members')
    .insert({ group_id: groupId, user_id: userId })
  if (error) redirect(`/admin/skupiny/${groupId}?error=${encodeURIComponent(error.message)}`)
  revalidatePath('/admin/skupiny')
  redirect(`/admin/skupiny/${groupId}?success=1`)
}

// ─── Odebrat člena ze skupiny ─────────────────────────────────────────────────

export async function removeGroupMember(formData: FormData) {
  const supabase = await requireAdmin()
  const groupId = formData.get('group_id') as string
  const userId  = formData.get('user_id')  as string
  await supabase
    .from('user_group_members')
    .delete().eq('group_id', groupId).eq('user_id', userId)
  revalidatePath('/admin/skupiny')
  redirect(`/admin/skupiny/${groupId}?success=1`)
}

// ─── Uložit oprávnění skupiny na sekci ──────────────────────────────────────

export async function saveGroupPermissions(formData: FormData) {
  const supabase = await requireAdmin()
  const groupId   = formData.get('group_id')   as string
  const sectionId = formData.get('section_id') as string
  const canView       = formData.get('can_view')               === '1'
  const canCreate     = formData.get('can_create_articles')    === '1'
  const canEdit       = formData.get('can_edit_articles')      === '1'
  const canDelete     = formData.get('can_delete_articles')    === '1'
  const canSubsection = formData.get('can_create_subsections') === '1'

  if (!canView && !canCreate && !canEdit && !canDelete && !canSubsection) {
    // Žádné oprávnění → smaž záznam
    await supabase.from('section_group_permissions')
      .delete().eq('group_id', groupId).eq('section_id', sectionId)
  } else {
    const { error } = await supabase.from('section_group_permissions').upsert({
      group_id:               groupId,
      section_id:             sectionId,
      can_view:               canView,
      can_create_articles:    canCreate,
      can_edit_articles:      canEdit,
      can_delete_articles:    canDelete,
      can_create_subsections: canSubsection,
    }, { onConflict: 'group_id,section_id' })
    if (error) redirect(`/admin/skupiny/${groupId}?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/admin/skupiny')
  redirect(`/admin/skupiny/${groupId}?success=1`)
}
