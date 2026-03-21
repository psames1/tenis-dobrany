'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type Button = { label: string; url: string; variant: 'primary' | 'outline' }

type Props = {
  title?: string | null
  subtitle?: string | null
  buttons: Button[]
  images: string[]       // pole URL obrázků z DB (data.images)
  /** Interval přepínání v ms (default 6000) */
  interval?: number
}

export function HeroCarousel({ title, subtitle, buttons, images, interval = 6000 }: Props) {
  const [current, setCurrent] = useState(0)
  const [loaded, setLoaded] = useState<boolean[]>([])

  // Přednahrej první obrázek, pak postupně zbytek
  useEffect(() => {
    if (images.length === 0) return
    const arr = new Array(images.length).fill(false)
    images.forEach((src, i) => {
      const img = new Image()
      img.onload = () => {
        arr[i] = true
        setLoaded([...arr])
      }
      img.src = src
    })
  }, [images])

  const next = useCallback(() => {
    if (images.length <= 1) return
    setCurrent(c => (c + 1) % images.length)
  }, [images.length])

  // Autoplay
  useEffect(() => {
    if (images.length <= 1) return
    const timer = setInterval(next, interval)
    return () => clearInterval(timer)
  }, [next, interval, images.length])

  const anyLoaded = loaded.some(Boolean)

  return (
    <section className="relative w-full overflow-hidden bg-green-800" style={{ minHeight: '260px' }}>
      {/* Vrstva obrázků na pozadí */}
      {images.length > 0 && (
        <div className="absolute inset-0">
          {images.map((src, i) => (
            <div
              key={src}
              className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${
                i === current && anyLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              style={{ backgroundImage: `url(${src})` }}
            />
          ))}
        </div>
      )}

      {/* Obsah s poloprůhledným oknem */}
      <div className="relative z-10 flex items-center justify-center min-h-[260px] px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-green-800/25 backdrop-blur-sm rounded-2xl px-6 py-6 sm:px-10 sm:py-8 max-w-2xl w-full text-center">
          {title && (
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-3 leading-tight tracking-tight">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="text-sm sm:text-base text-gray-200 mb-6 leading-relaxed max-w-xl mx-auto">
              {subtitle}
            </p>
          )}
          {buttons.length > 0 && (
            <div className="flex flex-wrap justify-center gap-4">
              {buttons.map((btn, i) =>
                btn.variant === 'outline' ? (
                  <Link
                    key={i}
                    href={btn.url}
                    className="px-7 py-3 rounded-full border-2 border-white text-white font-semibold hover:bg-white hover:text-green-700 transition-all duration-200 text-sm sm:text-base"
                  >
                    {btn.label}
                  </Link>
                ) : (
                  <Link
                    key={i}
                    href={btn.url}
                    className="px-7 py-3 rounded-full bg-amber-500 text-white font-semibold hover:bg-amber-400 transition-all duration-200 shadow-lg text-sm sm:text-base"
                  >
                    {btn.label}
                  </Link>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* Indikátory slide-ů */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                i === current ? 'bg-white scale-110' : 'bg-white/40 hover:bg-white/60'
              }`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  )
}
