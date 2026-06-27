'use client'

import { useTransition } from 'react'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { updateUserRole, deleteUser } from '@/app/admin/users/actions'

export type UserRow = {
  id: string
  name: string
  handle: string | null
  role: 'user' | 'admin'
  createdAt: Date
}

const columnHelper = createColumnHelper<UserRow>()

interface UsersTableProps {
  users: UserRow[]
}

export function UsersTable({ users }: UsersTableProps) {
  const [isPending, startTransition] = useTransition()

  const columns = [
    columnHelper.accessor('name', { header: 'Name' }),
    columnHelper.accessor('handle', {
      header: 'Handle',
      cell: (info) => info.getValue() ?? '—',
    }),
    columnHelper.accessor('role', {
      header: 'Role',
      cell: (info) => {
        const row = info.row.original
        const isAdmin = info.getValue() === 'admin'
        return (
          <button
            type="button"
            onClick={() =>
              startTransition(async () => {
                await updateUserRole(row.id, isAdmin ? 'user' : 'admin')
              })
            }
            className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
              isAdmin ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
            }`}
          >
            {isAdmin ? 'admin' : 'user'}
          </button>
        )
      },
    }),
    columnHelper.accessor('createdAt', {
      header: 'Joined',
      cell: (info) => info.getValue().toLocaleDateString('it-IT'),
    }),
    columnHelper.display({
      id: 'actions',
      cell: (info) => (
        <button
          type="button"
          onClick={() => {
            if (!confirm(`Delete ${info.row.original.name}? This cannot be undone.`)) return
            startTransition(async () => {
              await deleteUser(info.row.original.id)
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
    data: users,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
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
            <tr key={row.id} className="border-t last:border-b-0">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {table.getRowModel().rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">
                No users yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {isPending && (
        <p className="border-t px-4 py-2 text-xs text-muted-foreground">Saving…</p>
      )}
    </div>
  )
}
