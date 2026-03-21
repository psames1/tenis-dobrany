'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  imageUrl: string
  /** Volitelný text overlay */
  title?: string | null
  subtitle?: string | null
  minHeight?: string
}

export function ParallaxStrip({ imageUrl, title, subtitle, minHeight = '300px' }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onScroll = () => {
      const rect = el.getBoundingClientRect()
      const vh = window.innerHeight
      if (rect.bottom > 0 && rect.top < vh) {
        setOffset((rect.top / vh) * 40)
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div
      ref={ref}
      className="relative overflow-hidden"
      style={{ minHeight }}
    >
      <div
        className="absolute inset-0 bg-cover bg-center will-change-transform transition-none"
        style={{
          backgroundImage: `url(${imageUrl})`,
          transform: `translateY(${offset}px) scale(1.1)`,
        }}
      />
      <div className="absolute inset-0 bg-black/30" />
      {(title || subtitle) && (
        <div className="relative z-10 flex flex-col items-center justify-center text-center text-white px-4" style={{ minHeight }}>
          {title && <h2 className="text-2xl sm:text-3xl font-bold mb-2 tracking-tight">{title}</h2>}
          {subtitle && <p className="text-lg text-gray-200 max-w-xl">{subtitle}</p>}
        </div>
      )}
    </div>
  )
}
