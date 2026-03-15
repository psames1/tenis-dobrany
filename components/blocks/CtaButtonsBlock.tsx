import Link from 'next/link'

type Button = { label: string; url: string; variant: 'primary' | 'outline' }

type Props = {
  title?: string | null
  subtitle?: string | null
  buttons?: Button[]
}

export function CtaButtonsBlock({ title, subtitle, buttons = [] }: Props) {
  return (
    <section className="py-16 sm:py-20 bg-green-800 text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {title && (
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">{title}</h2>
        )}
        {subtitle && (
          <p className="text-green-200 text-lg mb-8">{subtitle}</p>
        )}
        {buttons.length > 0 && (
          <div className="flex flex-wrap justify-center gap-4">
            {buttons.map((btn, i) => (
              btn.variant === 'outline' ? (
                <Link
                  key={i}
                  href={btn.url}
                  className="px-6 py-3 rounded-lg border-2 border-white text-white font-semibold hover:bg-white hover:text-green-800 transition-colors"
                >
                  {btn.label}
                </Link>
              ) : (
                <Link
                  key={i}
                  href={btn.url}
                  className="px-6 py-3 rounded-lg bg-white text-green-800 font-semibold hover:bg-green-50 transition-colors shadow"
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
