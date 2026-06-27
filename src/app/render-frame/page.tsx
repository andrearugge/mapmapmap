import { notFound } from 'next/navigation'
import { decodeRenderData } from '@/lib/render/encode-render-data'
import { getTemplate } from '@/lib/art/registry'
import { MapStory } from '@/components/art/MapStory'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function RenderFramePage({ searchParams }: Props) {
  const params = await searchParams

  const secret = process.env.RENDER_FRAME_SECRET
  if (!secret || params.secret !== secret) {
    notFound()
  }

  const encoded = params.data
  if (typeof encoded !== 'string') notFound()

  const renderData = decodeRenderData(encoded)
  if (!renderData) notFound()

  let template
  try {
    template = getTemplate(renderData.templateId)
  } catch {
    notFound()
  }

  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        position: 'relative',
        overflow: 'hidden',
        background: 'transparent',
      }}
    >
      <MapStory
        template={template}
        activity={renderData.activity}
        customizations={renderData.customizations}
      />
    </div>
  )
}
