import {
  pgTable,
  text,
  timestamp,
  integer,
  primaryKey,
  pgEnum,
  boolean,
  json,
  real,
} from 'drizzle-orm/pg-core'
import type { AdapterAccountType } from 'next-auth/adapters'

export const users = pgTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  stravaAthleteId: text('strava_athlete_id').notNull().unique(),
  name: text('name').notNull(),
  // Auth.js adapter-required columns (email/emailVerified unused by Strava but needed for adapter types)
  email: text('email'),
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  image: text('image'),
  // App-specific columns
  avatarUrl: text('avatar_url'),
  handle: text('handle'),
  role: text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const accounts = pgTable(
  'accounts',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    // Strava tokens — encrypted at rest in Phase 3
    // JS keys use snake_case to satisfy @auth/drizzle-adapter DefaultPostgresAccountsTable
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
)

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
})

export const activities = pgTable('activities', {
  id: text('id').primaryKey(), // Strava activity ID as string
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  name: text('name').notNull(),
  date: timestamp('date', { withTimezone: true }).notNull(),
  distanceM: integer('distance_m').notNull().default(0),
  movingTimeS: integer('moving_time_s').notNull().default(0),
  elapsedTimeS: integer('elapsed_time_s').notNull().default(0),
  elevationGainM: integer('elevation_gain_m').notNull().default(0),
  avgSpeedMps: real('avg_speed_mps').notNull().default(0),
  // Normalized route points [0..1]² — stored as JSON array of [x,y] pairs
  routePoints: json('route_points').$type<[number, number][]>().notNull().default([]),
  hasGps: boolean('has_gps').notNull().default(false),
  athleteName: text('athlete_name').notNull(),
  athleteAvatarUrl: text('athlete_avatar_url'),
  athleteHandle: text('athlete_handle'),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
})

export const renderJobStatusEnum = pgEnum('render_job_status', [
  'pending',
  'processing',
  'done',
  'failed',
])

export const renderJobs = pgTable('render_jobs', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  inputHash: text('input_hash').notNull(),
  status: renderJobStatusEnum('status').notNull().default('pending'),
  r2Key: text('r2_key'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const groups = pgTable('groups', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const userGroups = pgTable(
  'user_groups',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.groupId] })],
)

export const artGroupEntitlements = pgTable(
  'art_group_entitlements',
  {
    templateId: text('template_id').notNull(),
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.templateId, t.groupId] })],
)

export const artUserEntitlements = pgTable(
  'art_user_entitlements',
  {
    templateId: text('template_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.templateId, t.userId] })],
)
