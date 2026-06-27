import { encryptToken, decryptToken } from './token-crypto'

// Set AUTH_SECRET for tests
process.env.AUTH_SECRET = 'test-secret-must-be-at-least-32-chars-long!!'

describe('token-crypto', () => {
  it('round-trips a token', () => {
    const original = 'strava_access_token_abc123'
    const encrypted = encryptToken(original)
    expect(decryptToken(encrypted)).toBe(original)
  })

  it('produces different ciphertext for the same plaintext (random IV)', () => {
    const token = 'same_token'
    const a = encryptToken(token)
    const b = encryptToken(token)
    expect(a).not.toBe(b)
    // But both decrypt to the same value
    expect(decryptToken(a)).toBe(token)
    expect(decryptToken(b)).toBe(token)
  })

  it('throws when AUTH_SECRET is not set', () => {
    const original = process.env.AUTH_SECRET
    delete process.env.AUTH_SECRET
    expect(() => encryptToken('anything')).toThrow('AUTH_SECRET')
    process.env.AUTH_SECRET = original
  })

  it('throws on tampered ciphertext', () => {
    const encrypted = encryptToken('real_token')
    const tampered = encrypted.slice(0, -4) + 'XXXX'
    expect(() => decryptToken(tampered)).toThrow()
  })
})
