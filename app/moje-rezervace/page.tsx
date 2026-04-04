import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getOrganization } from '@/lib/organization'
import CancelReservationButton from './CancelReservationButton'

function formatDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'Europe/Prague' }),
    time: d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Prague' }),
  }
}

function getPragueDate(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Prague' })
}

export default async function MojeRezervacePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/moje-rezervace')

  const org = await getOrganization()
  if (!org) redirect('/rezervace')

  const now = new Date().toISOString()

  // Nadcházející rezervace
  const { data: upcoming } = await supabase
    .from('app_court_reservations')
    .select(`
      id, start_time, end_time, status, partner_name, note,
      app_courts ( name, surface )
    `)
    .eq('user_id', user.id)
    .eq('organization_id', org.id)
    .eq('status', 'confirmed')
    .gte('start_time', now)
    .order('start_time')
    .limit(20)

  // Historie — posledních 30 rezervací (vč. zrušených)
  const { data: history } = await supabase
    .from('app_court_reservations')
    .select(`
      id, start_time, end_time, status, partner_name,
      app_courts ( name )
    `)
    .eq('user_id', user.id)
    .eq('organization_id', org.id)
    .lt('start_time', now)
    .order('start_time', { ascending: false })
    .limit(30)

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Moje rezervace</h1>
        <Link
          href="/rezervace"
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          + Nová rezervace
        </Link>
      </div>

      {/* Nadcházející */}
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Nadcházející
        </h2>

        {!upcoming?.length && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-10 text-center">
            <p className="text-gray-500 text-sm">Nemáte žádné nadcházející rezervace.</p>
            <Link href="/rezervace" className="mt-3 inline-block text-sm text-green-600 hover:underline">
              Rezervovat kurt →
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {(upcoming ?? []).map((r: any) => {
            const start = formatDateTime(r.start_time)
            const end = formatDateTime(r.end_time)
            return (
              <div
                key={r.id}
                className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 flex items-start justify-between gap-4"
              >
                <div>
                  <p className="font-semibold text-gray-900">
                    {r.app_courts?.name ?? 'Kurt'}
                    <span className="ml-2 text-xs font-normal text-gray-500">
                      {r.app_courts?.surface === 'clay' ? 'antuka' : r.app_courts?.surface}
                    </span>
                  </p>
                  <p className="text-sm text-gray-700 mt-0.5 capitalize">
                    {start.date}, {start.time} – {end.time}
                  </p>
                  {r.partner_name && (
                    <p className="text-xs text-gray-500 mt-1">Spoluhráč: {r.partner_name}</p>
                  )}
                  {r.note && (
                    <p className="text-xs text-gray-400 mt-0.5">{r.note}</p>
                  )}
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <Link
                    href={`/rezervace?datum=${getPragueDate(r.start_time)}`}
                    className="rounded-lg border border-green-200 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 transition-colors text-center whitespace-nowrap"
                  >
                    📅 V kalendáři
                  </Link>
                  <CancelReservationButton reservationId={r.id} />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Historie */}
      {!!history?.length && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Historie
          </h2>
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Kurt</th>
                  <th className="px-4 py-2 text-left font-medium">Datum</th>
                  <th className="px-4 py-2 text-left font-medium">Čas</th>
                  <th className="px-4 py-2 text-left font-medium">Stav</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((r: any) => {
                  const start = formatDateTime(r.start_time)
                  const end = formatDateTime(r.end_time)
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700">{r.app_courts?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/rezervace?datum=${getPragueDate(r.start_time)}`}
                          className="text-gray-600 capitalize hover:text-green-600 hover:underline"
                        >
                          {start.date}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{start.time} – {end.time}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'confirmed') {
    return <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Proběhla</span>
  }
  if (status === 'cancelled') {
    return <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">Zrušena</span>
  }
  return <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">{status}</span>
}


