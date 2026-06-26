import type { Meta, StoryObj } from '@storybook/react'
import { MapStory } from '@/components/art/MapStory'
import { minimalArcTemplate } from '@/lib/art/arts/minimal-arc'
import {
  longWindingRouteFixture,
  shortCityRouteFixture,
  linearRouteFixture,
  noGpsFixture,
} from '@/lib/art/fixtures'
import type { Customizations } from '@/types/map-story'

const defaultCustomizations: Customizations = {
  primary: '#C13917',
  accent: '#1B3D72',
  background: { type: 'transparent' },
  artPosition: 'middle-center',
}

const meta: Meta<typeof MapStory> = {
  title: 'Art/MinimalArc',
  component: MapStory,
  args: {
    template: minimalArcTemplate,
    customizations: defaultCustomizations,
  },
  argTypes: {
    customizations: { control: 'object' },
  },
}
export default meta

type Story = StoryObj<typeof MapStory>

export const LongWinding: Story = { args: { activity: longWindingRouteFixture } }
export const ShortCity: Story = { args: { activity: shortCityRouteFixture } }
export const Linear: Story = { args: { activity: linearRouteFixture } }
export const NoGps: Story = { args: { activity: noGpsFixture } }
export const WithBackground: Story = {
  args: {
    activity: longWindingRouteFixture,
    customizations: {
      ...defaultCustomizations,
      background: {
        type: 'image',
        assetUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1080',
        overlay: { enabled: true, color: '#000000', opacity: 0.4 },
      },
    },
  },
}
