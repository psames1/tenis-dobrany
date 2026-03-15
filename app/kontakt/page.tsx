import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kontakt',
  description: 'Kontaktní informace tenisového oddílu TJ Dobřany, z.s.',
}

export default function KontaktPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <nav className="text-sm text-gray-400 mb-6 flex items-center gap-2">
        <Link href="/" className="hover:text-green-600 transition-colors">Domů</Link>
        <span>/</span>
        <span className="text-gray-700">Kontakt</span>
      </nav>

      <h1 className="text-3xl font-bold text-gray-900 mb-10">Kontakt</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Kontaktní údaje */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-5">
            Tenisový oddíl TJ Dobřany, z.s.
          </h2>
          <ul className="space-y-4">
            <li className="flex items-start gap-3">
              <span className="text-2xl leading-none mt-0.5" aria-hidden="true">📍</span>
              <div className="text-gray-600 text-sm leading-relaxed">
                <div>Areál Džungle</div>
                <div>334 41 Dobřany</div>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-2xl leading-none mt-0.5" aria-hidden="true">📧</span>
              <a
                href="mailto:info@tenisdobrany.cz"
                className="text-green-600 hover:text-green-800 transition-colors text-sm"
              >
                info@tenisdobrany.cz
              </a>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-2xl leading-none mt-0.5" aria-hidden="true">📱</span>
              <span className="text-gray-600 text-sm">+420 xxx xxx xxx</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-2xl leading-none mt-0.5" aria-hidden="true">🌐</span>
              <a
                href="https://www.facebook.com/tenisdobrany"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-600 hover:text-green-800 transition-colors text-sm"
              >
                Facebook
              </a>
            </li>
          </ul>
        </div>

        {/* Jak se dostat */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Jak se dostat</h2>
          <p className="text-gray-600 text-sm leading-relaxed mb-4">
            Areál se nachází v Dobřanech u Plzně. Dobřany jsou dostupné autem
            i vlakem z Plzně (cca 15 minut jízdy).
          </p>
          {/* Placeholder pro mapu — nahradit embed Google Maps */}
          <div className="bg-gray-50 rounded-xl h-40 flex items-center justify-center text-gray-400 text-sm border border-dashed border-gray-200">
            Mapa bude doplněna
          </div>
        </div>
      </div>
    </div>
  )
}
