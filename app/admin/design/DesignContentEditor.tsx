'use client'

import dynamic from 'next/dynamic'

const RichTextEditor = dynamic(() => import('@/components/editor/RichTextEditor').then(m => m.RichTextEditor), {
  ssr: false,
  loading: () => <div className="w-full h-32 bg-gray-50 rounded-lg animate-pulse" />,
})

type Props = {
  componentId: string
  defaultValue: string
}

export function DesignContentEditor({ componentId, defaultValue }: Props) {
  return (
    <RichTextEditor
      key={componentId}
      name="content"
      defaultValue={defaultValue}
      minHeight="min-h-32"
    />
  )
}
