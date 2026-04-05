import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { SectionEditorForm } from '@/app/clenove/SectionEditorForm'

export const metadata: Metadata = { title: 'Nový článek ve skupině' }

type Props = { params: Promise<{ slug: string }> }

export default async function NovyClankVSekci({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Načti sekci
  const { data: section } = await supabase
    .from('sections')
    .select('id, slug, title')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()
  if (!section) notFound()

  // Ověř, že má uživatel oprávnění can_create_articles na tuto sekci
  const { data: memberships } = await supabase
    .from('user_group_members').select('group_id').eq('user_id', user.id)
  const groupIds = (memberships ?? []).map(m => m.group_id)

  if (groupIds.length > 0) {
    const { data: perms } = await supabase
      .from('section_group_permissions')
      .select('can_create_articles')
      .eq('section_id', section.id)
      .in('group_id', groupIds)
      .eq('can_create_articles', true)
      .limit(1)
    if (!perms || perms.length === 0) redirect('/clenove?error=forbidden')
  } else {
    redirect('/clenove?error=forbidden')
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <nav className="text-sm text-gray-400 mb-4 flex items-center gap-2">
        <Link href="/clenove" className="hover:text-green-600 transition-colors">Členové</Link>
        <span>/</span>
        <Link href={`/${section.slug}`} className="hover:text-green-600 transition-colors">{section.title}</Link>
        <span>/</span>
        <span>Nový článek</span>
      </nav>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nový článek — {section.title}</h1>
      <SectionEditorForm
        sectionId={section.id}
        sectionSlug={section.slug}
        sectionTitle={section.title}
      />
    </div>
  )
}
