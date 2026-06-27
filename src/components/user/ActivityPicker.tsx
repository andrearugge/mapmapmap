'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ActivityData } from '@/types/map-story'

interface Props {
  activities: ActivityData[]
}

const PAGE_SIZE = 10

function formatDistance(m: number): string {
  return `${(m / 1000).toFixed(1)} km`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function ActivityPicker({ activities }: Props) {
  const router = useRouter()
  const [page, setPage] = useState(0)

  const pageItems = activities.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(activities.length / PAGE_SIZE)

  if (activities.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-lg font-medium">No GPS activities found</p>
        <p className="text-sm text-muted-foreground">
          Activities without GPS data (indoor runs, etc.) cannot be turned into a story.
          Go for a run outside and come back!
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b bg-background px-4 py-3">
        <h1 className="text-lg font-semibold">Choose an activity</h1>
        <p className="text-sm text-muted-foreground">{activities.length} activities with GPS</p>
      </header>

      <ul className="flex-1 divide-y">
        {pageItems.map((activity) => (
          <li key={activity.id}>
            <button
              type="button"
              onClick={() => router.push(`/editor/${activity.id}`)}
              className="flex w-full items-center gap-4 px-4 py-4 text-left active:bg-muted"
            >
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">{activity.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(activity.date)} · {formatDistance(activity.stats.distance_m)} · {activity.type}
                </p>
              </div>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M7.5 5l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <footer className="sticky bottom-0 flex items-center justify-between border-t bg-background px-4 py-3">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="text-sm disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="text-sm disabled:opacity-40"
          >
            Next
          </button>
        </footer>
      )}
    </div>
  )
}
