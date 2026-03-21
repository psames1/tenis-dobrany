'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

const VALID_ROLES = ['member', 'manager', 'admin'] as const
type AppRole = typeof VALID_ROLES[number]

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') redirect('/?error=forbidden')
  return supabase
}

// ─── Změnit roli uživatele ────────────────────────────────────────────────────

export async function changeUserRole(formData: FormData) {
  await requireAdmin()
  const adminClient = createAdminClient()
  const userId = formData.get('user_id') as string
  const role   = formData.get('role') as string

  if (!userId || !VALID_ROLES.includes(role as AppRole)) {
    redirect('/admin/uzivatele?error=invalid_role')
  }

  const { error } = await adminClient
    .from('user_profiles')
    .update({ role })
    .eq('id', userId)

  if (error) redirect(`/admin/uzivatele?error=${encodeURIComponent(error.message)}`)
  redirect('/admin/uzivatele?success=role_changed')
}

// ─── Deaktivovat / aktivovat účet ────────────────────────────────────────────

export async function toggleUserActive(formData: FormData) {
  await requireAdmin()
  const adminClient = createAdminClient()
  const userId   = formData.get('user_id') as string
  const isActive = formData.get('is_active') === '1'

  if (!userId) redirect('/admin/uzivatele?error=missing_id')

  const { error } = await adminClient
    .from('user_profiles')
    .update({ is_active: isActive })
    .eq('id', userId)

  if (error) redirect(`/admin/uzivatele?error=${encodeURIComponent(error.message)}`)
  redirect('/admin/uzivatele?success=status_changed')
}

// ─── Pozvat nového uživatele emailem ─────────────────────────────────────────

export async function inviteUser(formData: FormData) {
  await requireAdmin()

  const email = (formData.get('email') as string | null)?.trim().toLowerCase() ?? ''
  if (!email || !email.includes('@')) {
    redirect('/admin/uzivatele?error=invalid_email')
  }

  try {
    const admin = createAdminClient()
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}/callback`,
    })
    if (error) throw error

    // Belt-and-suspenders: trigger handle_new_user() should already insert the profile,
    // but upsert ensures the email is visible in admin even if trigger missed it.
    if (data?.user) {
      await admin
        .from('user_profiles')
        .upsert({ id: data.user.id, email }, { onConflict: 'id', ignoreDuplicates: true })
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Chyba při odesílání pozvánky.'
    redirect(`/admin/uzivatele?error=${encodeURIComponent(msg)}`)
  }

  revalidatePath('/admin/uzivatele')
  redirect('/admin/uzivatele?success=invited')
}

// ─── Zrušit pozvánku (smazat neaktivovaný účet) ──────────────────────────────

export async function cancelInvitation(formData: FormData) {
  await requireAdmin()

  const userId = formData.get('user_id') as string | null
  if (!userId) redirect('/admin/uzivatele?error=missing_id')

  try {
    const admin = createAdminClient()
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) throw error
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Nepodařilo se zrušit pozvánku.'
    redirect(`/admin/uzivatele?error=${encodeURIComponent(msg)}`)
  }

  revalidatePath('/admin/uzivatele')
  redirect('/admin/uzivatele?success=invitation_cancelled')
}
