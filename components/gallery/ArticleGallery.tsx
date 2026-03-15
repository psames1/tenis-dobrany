'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

type GalleryImage = {
  url: string
  alt?: string | null
}

export function ArticleGallery({ images }: { images: GalleryImage[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const isOpen = lightboxIndex !== null
  const count = images.length

  const close = useCallback(() => setLightboxIndex(null), [])
  const prev = useCallback(
    () => setLightboxIndex(i => (i !== null ? (i - 1 + count) % count : null)),
    [count],
  )
  const next = useCallback(
    () => setLightboxIndex(i => (i !== null ? (i + 1) % count : null)),
    [count],
  )

  // Klávesnicová navigace
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, close, prev, next])

  // Zákaz scrollování stránky při otevřeném lightboxu
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (images.length === 0) return null

  return (
    <>
      {/* Mřížka miniatur */}
      <section className="mt-10 pt-8 border-t border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Fotogalerie</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setLightboxIndex(i)}
              className="block aspect-square overflow-hidden rounded-xl bg-gray-100 hover:opacity-85 active:scale-[0.97] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              aria-label={img.alt ?? `Otevřít foto ${i + 1}`}
            >
              <img
                src={img.url}
                alt={img.alt ?? `Foto ${i + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      </section>

      {/* Lightbox */}
      {isOpen && lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.92)' }}
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Fotogalerie – lightbox"
        >
          {/* Zavřít */}
          <button
            type="button"
            onClick={close}
            className="absolute top-4 right-4 p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors z-10"
            aria-label="Zavřít"
          >
            <X size={26} />
          </button>

          {/* Počítadlo */}
          <div
            className="absolute top-5 left-1/2 -translate-x-1/2 text-white/50 text-sm select-none pointer-events-none z-10"
            aria-live="polite"
          >
            {lightboxIndex + 1} / {count}
          </div>

          {/* Předchozí */}
          {count > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); prev() }}
              className="absolute left-2 sm:left-4 p-3 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors z-10"
              aria-label="Předchozí foto"
            >
              <ChevronLeft size={38} />
            </button>
          )}

          {/* Obrázek */}
          <div
            className="relative px-16 sm:px-20"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={lightboxIndex}
              src={images[lightboxIndex].url}
              alt={images[lightboxIndex].alt ?? `Foto ${lightboxIndex + 1}`}
              className="max-w-[min(90vw,1200px)] max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
          </div>

          {/* Další */}
          {count > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); next() }}
              className="absolute right-2 sm:right-4 p-3 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors z-10"
              aria-label="Další foto"
            >
              <ChevronRight size={38} />
            </button>
          )}
        </div>
      )}
    </>
  )
}
