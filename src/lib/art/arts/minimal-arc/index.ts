import type { Template } from '@/types/map-story'
import { minimalArcSchema } from './schema'

export const minimalArcTemplate: Template = {
  id: 'minimal-arc',
  name: 'Minimal Arc',
  size: { w: 1080, h: 1920 },
  layers: [
    { kind: 'background', placement: 'frame' },
    { kind: 'overlay', placement: 'frame' },
    {
      kind: 'route',
      placement: 'cluster',
      box: { x: 0, y: 0, w: 880, h: 880 },
      style: { stroke: 'primary', width: 5, dash: 'solid', glow: true },
    },
    {
      kind: 'stat',
      placement: 'cluster',
      bind: 'distance_m',
      box: { x: 0, y: 920, w: 440, h: 100 },
      style: { font: 'system-ui, sans-serif', size: 52, color: 'primary', weight: 700 },
    },
    {
      kind: 'stat',
      placement: 'cluster',
      bind: 'movingTime_s',
      box: { x: 440, y: 920, w: 440, h: 100 },
      style: { font: 'system-ui, sans-serif', size: 52, color: 'accent', weight: 700 },
    },
    {
      kind: 'attribution',
      placement: 'frame',
      anchor: 'bottom-center',
    },
  ],
  allowedAnchors: ['top-center', 'middle-center', 'bottom-center'],
  defaultAnchor: 'middle-center',
  customizationSchema: minimalArcSchema,
}
