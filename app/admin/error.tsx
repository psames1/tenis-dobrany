'use client'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="max-w-xl mx-auto mt-16 px-4">
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <h2 className="text-lg font-bold text-red-800 mb-2">Chyba v administraci</h2>
        <p className="text-sm text-red-600 mb-4">{error.message}</p>
        {error.digest && (
          <p className="text-xs text-red-400 font-mono mb-4">Digest: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
        >
          Zkusit znovu
        </button>
      </div>
    </div>
  )
}
