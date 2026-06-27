'use client'

import { useRef, useTransition } from 'react'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { createGroup, deleteGroup } from '@/app/admin/groups/actions'

export type GroupRow = {
  id: string
  name: string
  memberCount: number
  createdAt: Date
}

const columnHelper = createColumnHelper<GroupRow>()

interface GroupsTableProps {
  groups: GroupRow[]
}

export function GroupsTable({ groups }: GroupsTableProps) {
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  const columns = [
    columnHelper.accessor('name', { header: 'Name' }),
    columnHelper.accessor('memberCount', { header: 'Members' }),
    columnHelper.accessor('createdAt', {
      header: 'Created',
      cell: (info) => info.getValue().toLocaleDateString('it-IT'),
    }),
    columnHelper.display({
      id: 'actions',
      cell: (info) => (
        <button
          type="button"
          onClick={() => {
            if (!confirm(`Delete group "${info.row.original.name}"? This cannot be undone.`)) return
            startTransition(async () => {
              await deleteGroup(info.row.original.id)
            })
          }}
          className="text-xs text-destructive hover:underline"
        >
          Delete
        </button>
      ),
    }),
  ]

  const table = useReactTable({
    data: groups,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const name = inputRef.current?.value.trim() ?? ''
    if (!name) return
    startTransition(async () => {
      await createGroup(name)
      if (inputRef.current) inputRef.current.value = ''
    })
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          placeholder="New group name"
          className="rounded-md border px-3 py-1.5 text-sm"
          required
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-foreground px-4 py-1.5 text-sm font-medium text-background disabled:opacity-50"
        >
          Create
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-t">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No groups yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {isPending && (
          <p className="border-t px-4 py-2 text-xs text-muted-foreground">Saving…</p>
        )}
      </div>
    </div>
  )
}
