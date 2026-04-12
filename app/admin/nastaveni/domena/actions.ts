'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrganization } from '@/lib/organization'

export async function saveCustomDomain(orgId: string, domain: string | null) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Nejste přihlášen/a' }

  // verify user is admin or manager (CMS role in user_profiles)
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    return { success: false, error: 'Nemáte oprávnění' }
  }

  // get org context to verify orgId matches
  const org = await getOrganization()
  if (!org || org.id !== orgId) {
    return { success: false, error: 'Organizace nenalezena' }
  }

  // use admin client to bypass RLS
  const admin = createAdminClient()
  const { error } = await admin
    .from('app_organizations')
    .update({ custom_domain: domain })
    .eq('id', orgId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
