'use client'

import { useTransition, useState } from 'react'
import { cancelReservation } from '../rezervace/actions'

export default function CancelReservationButton({ reservationId }: { reservationId: string }) {
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState(false)

  if (done) {
    return <span className="text-xs text-gray-400">Zrušena</span>
  }

  return (
    <button
      onClick={() => {
        if (!confirm('Opravdu chcete zrušit tuto rezervaci?')) return
        startTransition(async () => {
          const result = await cancelReservation(reservationId)
          if (result.success) {
            setDone(true)
          } else {
            alert(result.error)
          }
        })
      }}
      disabled={isPending}
      className="flex-shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
    >
      {isPending ? 'Ruším...' : 'Zrušit'}
    </button>
  )
}
