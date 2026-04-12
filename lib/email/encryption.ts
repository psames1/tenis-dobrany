import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-cbc'

function getKey(): Buffer {
  const raw = process.env.SMTP_ENCRYPTION_KEY
  if (!raw || raw.length < 32) {
    throw new Error('SMTP_ENCRYPTION_KEY must be at least 32 characters')
  }
  // Use first 32 bytes as key (AES-256)
  return Buffer.from(raw.slice(0, 32), 'utf-8')
}

/** Encrypt plaintext → "iv:ciphertext" (hex encoded) */
export function encrypt(text: string): string {
  const key = getKey()
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return `${iv.toString('hex')}:${encrypted}`
}

/** Decrypt "iv:ciphertext" → plaintext */
export function decrypt(text: string): string {
  const key = getKey()
  const [ivHex, encrypted] = text.split(':')
  if (!ivHex || !encrypted) {
    throw new Error('Invalid encrypted format — expected "iv:ciphertext"')
  }
  const iv = Buffer.from(ivHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}
