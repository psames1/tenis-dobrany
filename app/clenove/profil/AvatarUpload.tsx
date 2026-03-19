'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Camera, Trash2 } from 'lucide-react'

type Props = {
  currentAvatarUrl?: string | null
  fullName?: string | null
  email: string
}

function getInitials(name?: string | null, email?: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }
  return (email ?? '?').slice(0, 2).toUpperCase()
}

export default function AvatarUpload({ currentAvatarUrl, fullName, email }: Props) {
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const initials = getInitials(fullName, email)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    if (!file.type.startsWith('image/')) {
      setError('Vyberte soubor obrázku (JPG, PNG, WebP).')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Soubor je příliš velký – maximum je 2 MB.')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(false)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Nejste přihlášen.'); setLoading(false); return }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `${user.id}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, cacheControl: '3600' })

    if (uploadError) {
      setError(uploadError.message)
      setLoading(false)
      return
    }

    // Cache-bust the URL so the browser reloads the new image
    const publicUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
    const urlWithBust = `${publicUrl}?t=${Date.now()}`

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ avatar_url: urlWithBust })
      .eq('id', user.id)

    if (updateError) {
      setError(updateError.message)
    } else {
      setAvatarUrl(urlWithBust)
      setSuccess(true)
    }
    setLoading(false)
  }

  async function handleRemove() {
    setLoading(true)
    setError(null)
    setSuccess(false)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ avatar_url: null })
      .eq('id', user.id)

    if (updateError) {
      setError(updateError.message)
    } else {
      setAvatarUrl(null)
      setSuccess(true)
    }
    setLoading(false)
  }

  return (
    <div className="flex items-center gap-6 mb-6">
      {/* Avatar preview */}
      <div className="relative shrink-0">
        <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-gray-200">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="Profilová fotka" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-green-600 flex items-center justify-center text-white text-xl font-bold select-none">
              {initials}
            </div>
          )}
        </div>
        {loading && (
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
            <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="space-y-2">
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Camera size={14} />
            {avatarUrl ? 'Změnit fotku' : 'Nahrát fotku'}
          </button>
          {avatarUrl && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <Trash2 size={14} />
              Odebrat
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400">JPG, PNG nebo WebP · max. 2 MB</p>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {success && <p className="text-xs text-green-600">✓ Fotka byla uložena.</p>}
      </div>
    </div>
  )
}
