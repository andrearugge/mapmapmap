import type { Template } from '@/types/map-story'
import { roundTechSchema } from './schema'

// Badge box: 437px wide (from Figma), 750px tall (content-driven; overflow: visible)
// Cluster anchor: middle-left → left: 64px (safe area), vertically centered
export const roundTechTemplate: Template = {
  id: 'round-tech',
  name: 'Round Tech',
  size: { w: 1080, h: 1920 },
  layers: [
    { kind: 'background', placement: 'frame' },
    {
      kind: 'badge',
      placement: 'cluster',
      box: { x: 0, y: 0, w: 437, h: 750 },
      render: 'round-tech-card',
    },
    { kind: 'attribution', placement: 'frame', anchor: 'bottom-right' },
  ],
  allowedAnchors: ['top-left', 'middle-left', 'bottom-left'],
  defaultAnchor: 'middle-left',
  customizationSchema: roundTechSchema,
}
