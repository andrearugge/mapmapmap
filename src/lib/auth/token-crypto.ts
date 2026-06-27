import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 16
const TAG_BYTES = 16
const KEY_BYTES = 32
const SALT = 'mapmapmap-token-v1'

function deriveKey(): Buffer {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET environment variable is not set')
  return scryptSync(secret, SALT, KEY_BYTES)
}

/**
 * Encrypts a token string with AES-256-GCM.
 * Output format (base64): [IV (16 bytes)][auth tag (16 bytes)][ciphertext]
 */
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_BYTES)
  const key = deriveKey()
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

/**
 * Decrypts a token string produced by encryptToken.
 * Throws if the ciphertext has been tampered with.
 */
export function decryptToken(ciphertext: string): string {
  const buf = Buffer.from(ciphertext, 'base64')
  const iv = buf.subarray(0, IV_BYTES)
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
  const encrypted = buf.subarray(IV_BYTES + TAG_BYTES)
  const key = deriveKey()
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    'utf8',
  )
}
