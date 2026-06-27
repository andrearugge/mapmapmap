import { chromium } from 'playwright'
import type { Template, ActivityData, Customizations } from '@/types/map-story'
import type { Renderer } from './renderer'
import { hashRenderInput } from './renderer'
import { encodeRenderData } from './encode-render-data'

// v1: launch a browser per render (acceptable for queue-limited concurrency).
// Future: keep browser alive and reuse pages across renders.

/**
 * Renders a `<MapStory>` to a transparent 1080×1920 PNG using Playwright/Chromium.
 *
 * Navigates to the internal `/render-frame` page, which accepts `secret` and `data`
 * query parameters, waits until network-idle, and screenshots the canvas area.
 *
 * Requires two environment variables:
 * - `RENDER_FRAME_SECRET` — shared secret that authenticates the render-frame route.
 * - `RENDER_WORKER_BASE_URL` — base URL of the running Next.js server
 *   (defaults to `http://localhost:3000`).
 */
export class PlaywrightRenderer implements Renderer {
  /**
   * Renders the given template + activity + customizations to a PNG buffer.
   *
   * @param input - The render input containing the template, activity data, and customizations.
   * @returns An object with `png` (a transparent PNG `Buffer` at 1080×1920) and `cacheKey`
   *   (a SHA-256 hex digest of the canonicalised render input, suitable for R2 caching).
   * @throws {Error} If `RENDER_FRAME_SECRET` is not set in the environment.
   */
  async render(input: {
    template: Template
    activity: ActivityData
    customizations: Customizations
  }): Promise<{ png: Buffer; cacheKey: string }> {
    const secret = process.env.RENDER_FRAME_SECRET
    if (!secret) throw new Error('RENDER_FRAME_SECRET not configured')

    const baseUrl = process.env.RENDER_WORKER_BASE_URL ?? 'http://localhost:3000'

    const cacheKey = hashRenderInput({
      templateId: input.template.id,
      activity: input.activity,
      customizations: input.customizations,
    })

    const encoded = encodeRenderData({
      templateId: input.template.id,
      activity: input.activity,
      customizations: input.customizations,
    })

    // v1: passes full render data as a base64url query param. Chromium accepts
    // very large URLs (>2MB) and Next.js has no hard query-string limit, so this
    // is safe for trimmed Strava summary polylines. If URL size becomes a concern,
    // switch render-frame to accept a POST body instead.
    const url =
      `${baseUrl}/render-frame` +
      `?secret=${encodeURIComponent(secret)}` +
      `&data=${encoded}`

    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage()
      await page.setViewportSize({ width: 1080, height: 1920 })
      await page.goto(url, { waitUntil: 'networkidle' })

      const pngUint8 = await page.screenshot({
        type: 'png',
        omitBackground: true,
        clip: { x: 0, y: 0, width: 1080, height: 1920 },
      })

      return { png: Buffer.from(pngUint8), cacheKey }
    } finally {
      await browser.close()
    }
  }
}
