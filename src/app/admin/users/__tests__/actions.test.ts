import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/auth', () => ({ auth: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

import { db } from '@/lib/db'
import { auth } from '@/auth'
import { updateUserRole, deleteUser } from '@/app/admin/users/actions'

const stubSelect = (row: Record<string, unknown> | null) =>
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(row ? [row] : []),
      }),
    }),
  } as unknown as ReturnType<typeof db.select>)

const stubUpdate = () =>
  vi.mocked(db.update).mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  } as unknown as ReturnType<typeof db.update>)

const stubDelete = () =>
  vi.mocked(db.delete).mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  } as unknown as ReturnType<typeof db.delete>)

describe('updateUserRole', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws Unauthorized when caller role is user', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'caller-1' } } as never)
    stubSelect({ role: 'user' })
    await expect(updateUserRole('target-1', 'admin')).rejects.toThrow('Unauthorized')
  })

  it('throws when admin tries to demote themselves', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1' } } as never)
    stubSelect({ role: 'admin' })
    await expect(updateUserRole('admin-1', 'user')).rejects.toThrow(
      'Cannot remove own admin role',
    )
  })

  it('calls db.update when admin updates another user', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1' } } as never)
    stubSelect({ role: 'admin' })
    const spy = stubUpdate()
    await updateUserRole('user-2', 'admin')
    expect(spy).toHaveBeenCalled()
  })
})

describe('deleteUser', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws Unauthorized when caller role is user', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'caller-1' } } as never)
    stubSelect({ role: 'user' })
    await expect(deleteUser('target-1')).rejects.toThrow('Unauthorized')
  })

  it('throws when admin tries to delete themselves', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1' } } as never)
    stubSelect({ role: 'admin' })
    await expect(deleteUser('admin-1')).rejects.toThrow('Cannot delete own account')
  })

  it('calls db.delete when admin deletes another user', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1' } } as never)
    stubSelect({ role: 'admin' })
    const spy = stubDelete()
    await deleteUser('user-2')
    expect(spy).toHaveBeenCalled()
  })
})
