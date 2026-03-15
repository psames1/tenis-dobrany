import Link from 'next/link'

type Button = { label: string; url: string; variant: 'primary' | 'outline' }

type Props = {
  title: string
  subtitle?: string | null
  buttons?: Button[]
}

export function HeroBlock({ title, subtitle, buttons = [] }: Props) {
  return (
    <section className="relative bg-gradient-to-br from-green-700 via-green-600 to-green-800 text-white overflow-hidden">
      {/* Dekorativní tenisový vzor v pozadí */}
      <div className="absolute inset-0 opacity-10 pointer-events-none select-none" aria-hidden="true">
        <div className="absolute top-8 right-8 text-9xl">🎾</div>
        <div className="absolute bottom-8 left-8 text-7xl">🎾</div>
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 text-center">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight tracking-tight mb-4">
          {title}
        </h1>

        {subtitle && (
          <p className="text-lg sm:text-xl text-green-100 mb-8 max-w-2xl mx-auto">
            {subtitle}
          </p>
        )}

        {buttons.length > 0 && (
          <div className="flex flex-wrap justify-center gap-4 mt-6">
            {buttons.map((btn, i) => (
              btn.variant === 'outline' ? (
                <Link
                  key={i}
                  href={btn.url}
                  className="px-6 py-3 rounded-lg border-2 border-white text-white font-semibold hover:bg-white hover:text-green-700 transition-colors"
                >
                  {btn.label}
                </Link>
              ) : (
                <Link
                  key={i}
                  href={btn.url}
                  className="px-6 py-3 rounded-lg bg-white text-green-700 font-semibold hover:bg-green-50 transition-colors shadow-md"
                >
                  {btn.label}
                </Link>
              )
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
