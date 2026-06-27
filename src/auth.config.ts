import type { NextAuthConfig } from 'next-auth'

/**
 * Edge-safe Auth.js config — no DB imports, no Node.js-only APIs.
 * Used by the middleware; extended by auth.ts with the full DB adapter.
 */
export const authConfig = {
  providers: [],
} satisfies NextAuthConfig
