import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AdminSidebar } from './AdminSidebar'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/admin')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    redirect('/?error=forbidden')
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar role={profile.role} name={profile.full_name ?? profile.email ?? ''} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <h1 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Administrace
          </h1>
          <form action="/logout" method="POST">
            <button
              type="submit"
              className="text-sm text-gray-500 hover:text-red-600 transition-colors"
            >
              Odhlásit
            </button>
          </form>
        </header>

        <main className="flex-1 p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
