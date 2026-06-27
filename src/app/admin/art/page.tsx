import { db } from '@/lib/db'
import { artGroupEntitlements, artUserEntitlements, groups, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { artRegistry } from '@/lib/art/registry'
import { requireAdmin } from '@/lib/auth/require-admin'

export default async function AdminArtPage() {
  await requireAdmin()

  const templates = Array.from(artRegistry.values())

  // Fetch all entitlement rows with names
  const groupEnts = await db
    .select({
      templateId: artGroupEntitlements.templateId,
      groupName: groups.name,
    })
    .from(artGroupEntitlements)
    .innerJoin(groups, eq(artGroupEntitlements.groupId, groups.id))

  const userEnts = await db
    .select({
      templateId: artUserEntitlements.templateId,
      userName: users.name,
    })
    .from(artUserEntitlements)
    .innerJoin(users, eq(artUserEntitlements.userId, users.id))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Art Catalog</h1>
        <p className="text-sm text-muted-foreground">
          {templates.length} registered template{templates.length !== 1 ? 's' : ''}. Entitlements
          are read-only in v1 — all templates are available to all users by default.
        </p>
      </div>

      <div className="space-y-3">
        {templates.map((t) => {
          const tGroupEnts = groupEnts.filter((e) => e.templateId === t.id)
          const tUserEnts = userEnts.filter((e) => e.templateId === t.id)

          return (
            <div key={t.id} className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{t.id}</p>
                </div>
                {tGroupEnts.length > 0 || tUserEnts.length > 0 ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                    Restricted
                  </span>
                ) : (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                    Public
                  </span>
                )}
              </div>
              {(tGroupEnts.length > 0 || tUserEnts.length > 0) && (
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {tGroupEnts.length > 0 && (
                    <p>Groups: {tGroupEnts.map((e) => e.groupName).join(', ')}</p>
                  )}
                  {tUserEnts.length > 0 && (
                    <p>Users: {tUserEnts.map((e) => e.userName).join(', ')}</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
