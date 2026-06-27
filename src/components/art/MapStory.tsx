import type { ActivityData, Customizations, LayerNode, Template } from '@/types/map-story'
import { anchorToPosition } from '@/lib/art/anchor-position'
import { BackgroundLayer } from './layers/BackgroundLayer'
import { OverlayLayer } from './layers/OverlayLayer'
import { RouteLayer } from './layers/RouteLayer'
import { StatLayer } from './layers/StatLayer'
import { TextLayer } from './layers/TextLayer'
import { BadgeLayer } from './layers/BadgeLayer'
import { StravaAttribution } from './StravaAttribution'

interface MapStoryProps {
  template: Template
  activity: ActivityData
  customizations: Customizations
}

/** Computes the bounding box of all cluster layers (min origin, max extent). */
function clusterBounds(layers: LayerNode[]): { w: number; h: number } {
  if (layers.length === 0) return { w: 0, h: 0 }
  let maxX = 0
  let maxY = 0
  for (const l of layers) {
    if (l.placement === 'cluster' && 'box' in l) {
      maxX = Math.max(maxX, l.box.x + l.box.w)
      maxY = Math.max(maxY, l.box.y + l.box.h)
    }
  }
  return { w: maxX, h: maxY }
}

function renderFrameLayer(
  layer: LayerNode,
  activity: ActivityData,
  customizations: Customizations,
  index: number,
) {
  switch (layer.kind) {
    case 'background':
      return <BackgroundLayer key={index} customizations={customizations} />
    case 'overlay':
      return <OverlayLayer key={index} customizations={customizations} />
    default:
      return null
  }
}

function renderClusterLayer(
  layer: LayerNode,
  activity: ActivityData,
  customizations: Customizations,
  index: number,
) {
  if (layer.placement !== 'cluster') return null

  if (layer.kind === 'route') {
    return (
      <RouteLayer
        key={index}
        box={layer.box}
        style={layer.style}
        activity={activity}
        customizations={customizations}
      />
    )
  }
  if (layer.kind === 'stat') {
    return (
      <StatLayer
        key={index}
        bind={layer.bind}
        box={layer.box}
        style={layer.style}
        activity={activity}
        customizations={customizations}
        format={layer.format}
      />
    )
  }
  if (layer.kind === 'text') {
    return (
      <TextLayer
        key={index}
        value={layer.value}
        box={layer.box}
        style={layer.style}
        customizations={customizations}
      />
    )
  }
  if (layer.kind === 'badge') {
    return (
      <BadgeLayer
        key={index}
        renderId={layer.render}
        box={layer.box}
      />
    )
  }
  return null
}

/**
 * Pure render function: (template, activity, customizations) → JSX.
 * No hooks, no side effects, no implicit inputs. Same input → same output.
 */
export function MapStory({ template, activity, customizations }: MapStoryProps) {
  const nonAttributionFrameLayers = template.layers.filter(
    (l): l is Extract<LayerNode, { placement: 'frame'; kind: 'background' | 'overlay' }> =>
      l.placement === 'frame' && l.kind !== 'attribution',
  )
  const clusterLayers = template.layers.filter(
    (l): l is Extract<LayerNode, { placement: 'cluster' }> => l.placement === 'cluster',
  )
  const attributionLayer = template.layers.find(
    (l): l is Extract<LayerNode, { kind: 'attribution' }> => l.kind === 'attribution',
  )

  const bounds = clusterBounds(template.layers)
  const clusterStyle = anchorToPosition(customizations.artPosition, bounds)

  return (
    <div
      data-mapstory
      style={{
        width: template.size.w,
        height: template.size.h,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {nonAttributionFrameLayers.map((layer, i) =>
        renderFrameLayer(layer, activity, customizations, i),
      )}

      {clusterLayers.length > 0 && (
        <div style={{ position: 'absolute', ...clusterStyle }}>
          {clusterLayers.map((layer, i) =>
            renderClusterLayer(layer, activity, customizations, i),
          )}
        </div>
      )}

      {/* Attribution always renders last — on top of cluster (spec §6.5) */}
      <StravaAttribution anchor={attributionLayer?.anchor ?? 'bottom-center'} />
    </div>
  )
}
