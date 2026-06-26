import { z } from 'zod'

const routePoint = z.tuple([
  z.number().min(0).max(1),
  z.number().min(0).max(1),
])

export const activityDataSchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string(),
  date: z.string(),
  stats: z.object({
    distance_m: z.number().nonnegative(),
    movingTime_s: z.number().nonnegative(),
    elapsedTime_s: z.number().nonnegative(),
    elevationGain_m: z.number().nonnegative(),
    avgSpeed_mps: z.number().nonnegative(),
  }),
  route: z.object({
    points: z.array(routePoint),
    hasGps: z.boolean(),
  }),
  athlete: z.object({
    name: z.string(),
    avatarUrl: z.string().url().optional(),
    handle: z.string().optional(),
  }),
})
