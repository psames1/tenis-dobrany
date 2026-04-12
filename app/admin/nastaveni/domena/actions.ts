'use server'

import { createClient } from '@/lib/supabase/server'

export async function saveCustomDomain(orgId: string, domain: string | null) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Nejste přihlášen/a' }

  // verify user is admin or manager of this org
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', user.id)
    .single()

  if (!membership || !['admin', 'manager'].includes(membership.role)) {
    return { success: false, error: 'Nemáte oprávnění' }
  }

  const { error } = await supabase
    .from('app_organizations')
    .update({ custom_domain: domain })
    .eq('id', orgId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
