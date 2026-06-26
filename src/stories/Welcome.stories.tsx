import type { Meta, StoryObj } from '@storybook/react'

function WelcomeCanvas() {
  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1B3D72',
        color: '#fff',
        fontFamily: 'system-ui',
        fontSize: 48,
        fontWeight: 'bold',
      }}
    >
      Mapmapmap
    </div>
  )
}

const meta: Meta<typeof WelcomeCanvas> = {
  title: 'Canvas/Welcome',
  component: WelcomeCanvas,
}
export default meta

export const Default: StoryObj<typeof WelcomeCanvas> = {}
