import type { Preview } from '@storybook/react'
import '../src/app/globals.css'

const VIEWPORT_1080x1920 = {
  name: '9:16 — 1080×1920 (Instagram Story)',
  type: 'desktop' as const,
  width: 1080,
  height: 1920,
}

const preview: Preview = {
  parameters: {
    viewport: {
      viewports: {
        story: VIEWPORT_1080x1920,
      },
      defaultViewport: 'story',
    },
    backgrounds: {
      default: 'white',
      values: [
        { name: 'white', value: '#ffffff' },
        { name: 'black', value: '#000000' },
        { name: 'transparent', value: 'transparent' },
      ],
    },
  },
}

export default preview
