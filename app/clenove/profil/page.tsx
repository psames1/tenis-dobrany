import { createClient } from '@/lib/supabase/server'
import { saveProfile } from '../actions'
import ChangePasswordForm from './ChangePasswordForm'
import AvatarUpload from './AvatarUpload'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Členská sekce – Profil' }

type SearchParams = Promise<{ success?: string; error?: string }>

export default async function ProfilePage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('email, full_name, phone, role, avatar_url, created_at')
    .eq('id', user.id)
    .single()

  const { success, error } = await searchParams

  const ROLE_LABELS: Record<string, string> = {
    admin:   'Admin',
    manager: 'Editor',
    member:  'Člen',
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Můj profil</h1>

      {/* Avatar */}
      <AvatarUpload
        currentAvatarUrl={profile?.avatar_url}
        fullName={profile?.full_name}
        email={profile?.email ?? user.email ?? ''}
      />
      {success && (
        <div className="mb-5 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          ✓ Profil byl uložen.
        </div>
      )}
      {error && (
        <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          Chyba: {decodeURIComponent(error)}
        </div>
      )}

      {/* Info řádky */}
      <div className="mb-6 p-4 bg-white rounded-xl border border-gray-200 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Email</span>
          <span className="text-gray-900">{profile?.email ?? user.email}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Role</span>
          <span className="text-gray-900">{ROLE_LABELS[profile?.role ?? ''] ?? profile?.role}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Člen od</span>
          <span className="text-gray-900">
            {profile?.created_at
              ? new Date(profile.created_at).toLocaleDateString('cs-CZ')
              : '—'}
          </span>
        </div>
      </div>

      {/* Editovatelný formulář */}
      <form action={saveProfile} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="full_name">
            Celé jméno
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            defaultValue={profile?.full_name ?? ''}
            placeholder="Jan Novák"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="phone">
            Telefon
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={profile?.phone ?? ''}
            placeholder="+420 600 000 000"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <button
          type="submit"
          className="px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
        >
          Uložit profil
        </button>
      </form>

      {/* Oddělovač */}
      <div className="my-8 border-t border-gray-200" />

      {/* Změna hesla */}
      <ChangePasswordForm />
    </div>
  )
}
