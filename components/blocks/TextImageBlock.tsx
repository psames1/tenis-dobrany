type Props = {
  title: string
  content: string | null
  icon?: string | null
  imagePosition?: 'left' | 'right'
}

export function TextImageBlock({ title, content, icon, imagePosition = 'right' }: Props) {
  const visual = (
    <div className="flex items-center justify-center bg-green-50 rounded-2xl p-12 text-8xl min-h-48">
      {icon ?? '🎾'}
    </div>
  )

  const text = (
    <div className="flex flex-col justify-center">
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">{title}</h2>
      {content && (
          <div
            className="article-content"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        )}
    </div>
  )

  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16 items-center">
          {imagePosition === 'left' ? (
            <>{visual}{text}</>
          ) : (
            <>{text}{visual}</>
          )}
        </div>
      </div>
    </section>
  )
}
