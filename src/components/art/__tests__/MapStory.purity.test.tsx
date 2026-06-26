import { render, within } from '@testing-library/react'
import { MapStory } from '../MapStory'
import { minimalArcTemplate } from '@/lib/art/arts/minimal-arc'
import {
  longWindingRouteFixture,
  shortCityRouteFixture,
  linearRouteFixture,
  noGpsFixture,
} from '@/lib/art/fixtures'
import type { Customizations } from '@/types/map-story'

const CUSTOMIZATIONS: Customizations = {
  primary: '#C13917',
  accent: '#1B3D72',
  background: { type: 'transparent' },
  artPosition: 'middle-center',
}

/**
 * CRITICAL: These snapshot tests guard the MapStory purity invariant.
 * Same input MUST produce identical output on every render.
 * NEVER skip, never remove. If a snapshot changes intentionally, update it with:
 *   pnpm test:run -- --update-snapshots
 */
describe('MapStory purity invariant', () => {
  it('renders long winding route identically across renders', () => {
    const props = { template: minimalArcTemplate, activity: longWindingRouteFixture, customizations: CUSTOMIZATIONS }
    const { container: a } = render(<MapStory {...props} />)
    const { container: b } = render(<MapStory {...props} />)
    expect(a.innerHTML).toBe(b.innerHTML)
  })

  it('renders short city route identically across renders', () => {
    const props = { template: minimalArcTemplate, activity: shortCityRouteFixture, customizations: CUSTOMIZATIONS }
    const { container: a } = render(<MapStory {...props} />)
    const { container: b } = render(<MapStory {...props} />)
    expect(a.innerHTML).toBe(b.innerHTML)
  })

  it('renders no-GPS fixture identically across renders', () => {
    const props = { template: minimalArcTemplate, activity: noGpsFixture, customizations: CUSTOMIZATIONS }
    const { container: a } = render(<MapStory {...props} />)
    const { container: b } = render(<MapStory {...props} />)
    expect(a.innerHTML).toBe(b.innerHTML)
  })

  it('renders long winding route — snapshot', () => {
    const { container } = render(
      <MapStory template={minimalArcTemplate} activity={longWindingRouteFixture} customizations={CUSTOMIZATIONS} />
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it('StravaAttribution is always present in output', () => {
    const fixtures = [longWindingRouteFixture, shortCityRouteFixture, linearRouteFixture, noGpsFixture]
    for (const activity of fixtures) {
      const { container } = render(
        <MapStory template={minimalArcTemplate} activity={activity} customizations={CUSTOMIZATIONS} />
      )
      expect(within(container).getByLabelText('Powered by Strava')).toBeTruthy()
    }
  })

  it('transparent background renders no BackgroundLayer element', () => {
    const { container } = render(
      <MapStory template={minimalArcTemplate} activity={longWindingRouteFixture} customizations={CUSTOMIZATIONS} />
    )
    const bg = container.querySelector('[style*="backgroundImage"]')
    expect(bg).toBeNull()
  })

  it('overlay is absent when background is transparent', () => {
    const { container } = render(
      <MapStory template={minimalArcTemplate} activity={longWindingRouteFixture} customizations={CUSTOMIZATIONS} />
    )
    // No overlay div should exist
    const overlayDivs = container.querySelectorAll('[style*="opacity"]')
    expect(overlayDivs.length).toBe(0)
  })
})
