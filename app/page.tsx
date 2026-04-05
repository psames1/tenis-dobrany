import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Metadata } from 'next'
import { visibilitiesForRole } from '@/lib/supabase/visibility'
import { HeroCarousel } from '@/components/home/HeroCarousel'
import { ParallaxStrip } from '@/components/home/ParallaxStrip'

export const metadata: Metadata = {
  title: 'Tenisový oddíl TJ Dobřany',
  description: 'Tenisový oddíl TJ Dobřany, z.s. — Hrajeme tenis od roku 1964 v areálu Džungle v Dobřanech u Plzně.',
}

type Button = { label: string; url: string; variant: 'primary' | 'outline' }
type HeroData = { buttons?: Button[]; images?: string[] }
type ParallaxData = { image_url?: string }

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('cs-CZ', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default async function HomePage() {
  const supabase = await createClient()

  // Krok 1: user + page_components paralelně
  const [{ data: components }, { data: { user } }] = await Promise.all([
    supabase
      .from('page_components')
      .select('id, component, title, subtitle, content, data')
      .eq('page_key', 'home')
      .eq('is_active', true)
      .order('sort_order'),
    supabase.auth.getUser(),
  ])

  // Krok 2: role uživatele
  let role: string | null = null
  if (user) {
    const { data: up } = await supabase
      .from('user_profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single()
    if (up?.is_active) role = up.role ?? 'member'
  }
  const visibilities = visibilitiesForRole(role)

  // Krok 3: nejnovější aktuality + články ze sekce "uvod"
  const [{ data: newsArticles }, { data: uvodArticles }] = await Promise.all([
    supabase
      .from('pages')
      .select('id, slug, title, excerpt, image_url, published_at, sections!inner(slug)')
      .eq('is_active', true)
      .eq('is_news', true)
      .in('visibility', visibilities)
      .order('published_at', { ascending: false })
      .limit(3),
    supabase
      .from('pages')
      .select('id, slug, title, excerpt, content, image_url, sections!inner(slug)')
      .eq('is_active', true)
      .eq('sections.slug', 'uvod')
      .in('visibility', visibilities)
      .order('sort_order', { ascending: true }),
  ])

  const all = components ?? []
  const hero      = all.find(c => c.component === 'hero')
  const clubText  = all.find(c => c.component === 'text_o_klubu')
  const parallax  = all.find(c => c.component === 'parallax_strip')

  const heroData = (hero?.data as HeroData | null) ?? {}
  const heroButtons = heroData.buttons ?? []
  const heroImages = heroData.images ?? []
  const parallaxData = (parallax?.data as ParallaxData | null) ?? {}

  return (
    <>
      {/* ── Hero sekce s karuselem fotek ─────────────────────────────── */}
      {hero && (
        <HeroCarousel
          title={hero.title}
          subtitle={hero.subtitle}
          buttons={heroButtons}
          images={heroImages}
        />
      )}

      {/* ── Nejnovější aktuality ─────────────────────────────────────── */}
      <section className="py-14 sm:py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {!newsArticles || newsArticles.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
              <p className="text-gray-400">Zatím žádné aktuality.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {newsArticles.map(article => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const sec = Array.isArray(article.sections) ? (article.sections as any[])[0] : article.sections
                  const sectionSlug = sec?.slug ?? 'aktuality'
                  return (
                    <Link
                      key={article.id}
                      href={`/${sectionSlug}/${article.slug}`}
                      className="group flex flex-col bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md hover:border-green-200 transition-all"
                    >
                      <div className="p-5 flex flex-col flex-1">
                        <h3 className="font-semibold text-gray-900 group-hover:text-green-700 transition-colors leading-snug mb-1">
                          {article.title}
                        </h3>
                        <time className="text-xs text-gray-400 mb-2 block">{formatDate(article.published_at)}</time>
                        {article.excerpt && (
                          <p className="text-sm text-gray-500 line-clamp-3 flex-1">{article.excerpt.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').trim()}</p>
                        )}
                      </div>
                      <div className="bg-green-50 h-40 flex items-center justify-center text-5xl flex-shrink-0 overflow-hidden">
                        {article.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={article.image_url} alt={article.title} className="w-full h-full object-cover" />
                        ) : (
                          '📰'
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
              <div className="mt-8 text-center">
                <Link
                  href="/aktuality"
                  className="inline-block text-sm text-green-600 font-medium hover:text-green-800 transition-colors"
                >
                  Další články →
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── O klubu ──────────────────────────────────────────────────── */}
      {clubText && (
        <section className="py-14 sm:py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            {clubText.title && (
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 text-center">{clubText.title}</h2>
            )}
            {clubText.content && (
              <div
                className="article-content text-gray-600 text-lg leading-relaxed text-center"
                dangerouslySetInnerHTML={{ __html: clubText.content }}
              />
            )}
          </div>
        </section>
      )}

      {/* ── Parallax prosvítající pruh ───────────────────────────────── */}
      {parallax && parallaxData.image_url && (
        <ParallaxStrip
          imageUrl={parallaxData.image_url}
          title={parallax.title}
          subtitle={parallax.subtitle}
        />
      )}

      {/* ── Bloky ze sekce Úvod (kontakt-mapa, další obsah) ──────── */}
      {(uvodArticles ?? []).map(article => (
        <section key={article.id} className="py-14 sm:py-20 even:bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            {article.title && (
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 text-center">{article.title}</h2>
            )}
            {article.content && (
              <div
                className="article-content text-gray-600 text-lg leading-relaxed"
                dangerouslySetInnerHTML={{ __html: article.content }}
              />
            )}
          </div>
        </section>
      ))}
    </>
  )
}

