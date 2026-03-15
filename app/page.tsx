import { createClient } from '@/lib/supabase/server'
import { HeroBlock } from '@/components/blocks/HeroBlock'
import { TextImageBlock } from '@/components/blocks/TextImageBlock'
import { SectionCardsBlock } from '@/components/blocks/SectionCardsBlock'
import { LatestArticlesBlock } from '@/components/blocks/LatestArticlesBlock'
import { CtaButtonsBlock } from '@/components/blocks/CtaButtonsBlock'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tenisový oddíl TJ Dobřany',
  description: 'Tenisový oddíl TJ Dobřany, z.s. — Hrajeme tenis od roku 1964 v areálu Džungle v Dobřanech u Plzně.',
}

type PageComponent = {
  id: string
  component: string
  title: string | null
  subtitle: string | null
  content: string | null
  data: Record<string, unknown>
}

type Button = { label: string; url: string; variant: 'primary' | 'outline' }

export default async function HomePage() {
  const supabase = await createClient()

  const [
    { data: components },
    { data: sections },
    { data: articles },
  ] = await Promise.all([
    supabase
      .from('page_components')
      .select('id, component, title, subtitle, content, data')
      .eq('page_key', 'home')
      .eq('is_active', true)
      .order('sort_order'),

    supabase
      .from('sections')
      .select('id, slug, title, description')
      .eq('is_active', true)
      .eq('show_in_menu', true)
      .order('menu_order'),

    supabase
      .from('pages')
      .select('id, slug, title, excerpt, image_url, published_at, section:sections!inner(slug)')
      .eq('is_active', true)
      .eq('sections.slug', 'aktuality')
      .order('published_at', { ascending: false })
      .limit(3),
  ])

  const blocks = (components ?? []) as PageComponent[]

  return (
    <>
      {blocks.map(block => {
        switch (block.component) {

          case 'hero':
            return (
              <HeroBlock
                key={block.id}
                title={block.title ?? ''}
                subtitle={block.subtitle}
                buttons={(block.data.buttons as Button[] | undefined) ?? []}
              />
            )

          case 'text_image': {
            const d = block.data as { image_position?: 'left' | 'right'; icon?: string }
            return (
              <TextImageBlock
                key={block.id}
                title={block.title ?? ''}
                content={block.content}
                icon={d.icon}
                imagePosition={d.image_position}
              />
            )
          }

          case 'section_cards':
            return (
              <SectionCardsBlock
                key={block.id}
                title={block.title}
                subtitle={block.subtitle}
                sections={sections ?? []}
              />
            )

          case 'latest_articles': {
            const d = block.data as { source_section?: string }
            return (
              <LatestArticlesBlock
                key={block.id}
                title={block.title}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                articles={(articles as any[]) ?? []}
                sectionSlug={d.source_section ?? 'aktuality'}
              />
            )
          }

          case 'cta_buttons':
            return (
              <CtaButtonsBlock
                key={block.id}
                title={block.title}
                subtitle={block.subtitle}
                buttons={(block.data.buttons as Button[] | undefined) ?? []}
              />
            )

          default:
            return null
        }
      })}
    </>
  )
}

