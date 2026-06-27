import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/auth', () => ({ auth: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  },
}))

import { db } from '@/lib/db'
import { auth } from '@/auth'
import { createGroup, deleteGroup } from '@/app/admin/groups/actions'

const stubSelectAdmin = () =>
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ role: 'admin' }]),
      }),
    }),
  } as unknown as ReturnType<typeof db.select>)

const stubSelectUser = () =>
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ role: 'user' }]),
      }),
    }),
  } as unknown as ReturnType<typeof db.select>)

const stubInsert = () =>
  vi.mocked(db.insert).mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  } as unknown as ReturnType<typeof db.insert>)

const stubDelete = () =>
  vi.mocked(db.delete).mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  } as unknown as ReturnType<typeof db.delete>)

describe('createGroup', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws Unauthorized when caller is not admin', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'caller-1' } } as never)
    stubSelectUser()
    await expect(createGroup('Beta Users')).rejects.toThrow('Unauthorized')
  })

  it('throws when name is empty', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1' } } as never)
    stubSelectAdmin()
    await expect(createGroup('  ')).rejects.toThrow('Group name is required')
  })

  it('calls db.insert when admin creates valid group', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1' } } as never)
    stubSelectAdmin()
    const spy = stubInsert()
    await createGroup('Beta Users')
    expect(spy).toHaveBeenCalled()
  })
})

describe('deleteGroup', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws Unauthorized when caller is not admin', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'caller-1' } } as never)
    stubSelectUser()
    await expect(deleteGroup('group-1')).rejects.toThrow('Unauthorized')
  })

  it('calls db.delete when admin deletes a group', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1' } } as never)
    stubSelectAdmin()
    const spy = stubDelete()
    await deleteGroup('group-1')
    expect(spy).toHaveBeenCalled()
  })
})
