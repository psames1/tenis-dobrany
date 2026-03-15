import { createClient } from '@supabase/supabase-js'

/**
 * Supabase Admin client se service role key.
 * ⚠️  Obchází RLS — používej POUZE v Server Actions, nikdy na klientovi.
 * Vyžaduje: SUPABASE_SERVICE_ROLE_KEY v .env.local
 *   (Supabase Dashboard → Settings → API → service_role JWT)
 */
export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    throw new Error(
      'Chybí SUPABASE_SERVICE_ROLE_KEY. Přidej ji do .env.local ' +
      '(Supabase Dashboard → Settings → API → service_role JWT).'
    )
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
