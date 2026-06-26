import { defineConfig } from 'drizzle-kit'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

// Load .env.local when DATABASE_URL is not in the environment.
// On the host, drizzle-kit CLI doesn't go through Next.js so the file isn't auto-loaded.
// Inside Docker/CI, DATABASE_URL is injected via environment variables — skip the file.
if (!process.env.DATABASE_URL) {
  const envPath = join(process.cwd(), '.env.local')
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
      const m = line.match(/^([^#=\s][^=]*)=(.*)$/)
      if (m) {
        const val = m[2].trim().replace(/^["'](.*)["']$/, '$1')
        process.env[m[1].trim()] = val
      }
    }
  }
}

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './src/lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
