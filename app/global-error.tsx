'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="cs">
      <body className="antialiased flex items-center justify-center min-h-screen bg-gray-50">
        <div className="max-w-xl w-full mx-auto px-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <h2 className="text-lg font-bold text-red-800 mb-2">
              Chyba aplikace (root layout)
            </h2>
            <p className="text-sm text-red-600 mb-4">{error.message}</p>
            {error.digest && (
              <p className="text-xs text-red-400 font-mono mb-4">
                Digest: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
            >
              Zkusit znovu
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
