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
  // background-position-y as percentage: 30% (top-of-image) → 70% (bottom-of-image)
  const [bgY, setBgY] = useState(50)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const rect = el.getBoundingClientRect()
      const vh = window.innerHeight
      // progress: 0 when element enters at viewport bottom; 1 when exits at viewport top
      const travel = vh + rect.height
      const progress = Math.max(0, Math.min(1, (vh - rect.top) / travel))
      // Map progress [0→1] to bgY [15%→85%] — wider range for more visible movement
      setBgY(15 + progress * 70)
    }
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update, { passive: true })
    // iOS Safari fires touchmove separately from scroll in some cases
    window.addEventListener('touchmove', update, { passive: true })
    update()
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      window.removeEventListener('touchmove', update)
    }
  }, [])

  return (
    <div
      ref={ref}
      className="relative overflow-hidden"
      style={{ minHeight }}
    >
      <div
        className="absolute inset-0 bg-cover"
        style={{
          backgroundImage: `url(${imageUrl})`,
          backgroundPosition: `center ${bgY}%`,
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
