import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const ts = (name: string) => timestamp(name, { withTimezone: true });

export const sportEnum = pgEnum("sport", ["soccer", "basketball", "volleyball", "ultimate", "other"]);
export const visibilityEnum = pgEnum("visibility", ["public", "private"]);
export const memberRoleEnum = pgEnum("member_role", ["organizer", "member"]);
export const gameStatusEnum = pgEnum("game_status", ["scheduled", "open", "on", "cancelled", "completed"]);
export const spotStatusEnum = pgEnum("spot_status", ["in", "waitlist", "offered", "out"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  phone: text("phone").notNull().unique(),
  name: text("name"),
  smsEnabled: boolean("sms_enabled").default(true).notNull(),
  createdAt: createdAt(),
});

export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: ts("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** Login codes for development and as a fallback when Twilio Verify isn't configured. */
export const loginCodes = pgTable(
  "login_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    phone: text("phone").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
    createdAt: createdAt(),
  },
  (t) => [index("login_codes_phone_idx").on(t.phone, t.createdAt)],
);

export const groups = pgTable("groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  sport: sportEnum("sport").default("soccer").notNull(),
  description: text("description"),
  homeField: text("home_field"),
  area: text("area"),
  city: text("city").default("San Francisco").notNull(),
  timezone: text("timezone").default("America/Los_Angeles").notNull(),
  visibility: visibilityEnum("visibility").default("public").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: createdAt(),
});

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").default("member").notNull(),
    joinedAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] }), index("group_members_user_idx").on(t.userId)],
);

/** A weekly rule that creates games on its own. Rules are copied onto each game it creates. */
export const schedules = pgTable(
  "schedules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    weekday: integer("weekday").notNull(), // 0 = Sunday … 6 = Saturday
    startTime: text("start_time").notNull(), // "HH:MM" in the group's timezone
    durationMinutes: integer("duration_minutes").default(90).notNull(),
    locationName: text("location_name").notNull(),
    locationAddress: text("location_address"),
    capacity: integer("capacity").notNull(),
    minPlayers: integer("min_players").notNull(),
    opensHoursBefore: integer("opens_hours_before").default(48).notNull(),
    decisionHoursBefore: integer("decision_hours_before").default(4).notNull(),
    claimMinutes: integer("claim_minutes").default(30).notNull(),
    lastCallHours: integer("last_call_hours").default(3).notNull(),
    guestsAllowed: boolean("guests_allowed").default(true).notNull(),
    active: boolean("active").default(true).notNull(),
    createdBy: uuid("created_by").notNull().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("schedules_group_idx").on(t.groupId)],
);

export const games = pgTable(
  "games",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull().unique(), // short id used in share links: /g/{code}
    groupId: uuid("group_id").references(() => groups.id, { onDelete: "cascade" }),
    scheduleId: uuid("schedule_id").references(() => schedules.id, { onDelete: "set null" }),
    hostId: uuid("host_id").notNull().references(() => users.id),
    title: text("title").notNull(),
    sport: sportEnum("sport").default("soccer").notNull(),
    notes: text("notes"),
    timezone: text("timezone").default("America/Los_Angeles").notNull(),
    startsAt: ts("starts_at").notNull(),
    endsAt: ts("ends_at").notNull(),
    opensAt: ts("opens_at").notNull(),
    decisionAt: ts("decision_at"),
    lastCallAt: ts("last_call_at").notNull(),
    locationName: text("location_name").notNull(),
    locationAddress: text("location_address"),
    capacity: integer("capacity").notNull(),
    minPlayers: integer("min_players").notNull(),
    claimMinutes: integer("claim_minutes").default(30).notNull(),
    guestsAllowed: boolean("guests_allowed").default(true).notNull(),
    visibility: visibilityEnum("visibility").default("public").notNull(),
    status: gameStatusEnum("status").default("open").notNull(),
    cancelReason: text("cancel_reason"),
    decidedAt: ts("decided_at"),
    lastCallNotifiedAt: ts("last_call_notified_at"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("games_schedule_start_uq").on(t.scheduleId, t.startsAt),
    index("games_starts_idx").on(t.startsAt),
    index("games_group_idx").on(t.groupId, t.startsAt),
    index("games_status_idx").on(t.status),
  ],
);

/**
 * One place in a game. A guest (+1) is its own spot, owned by the player who brought them.
 * Order on the waitlist is `queued_at`.
 */
export const spots = pgTable(
  "spots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gameId: uuid("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    guestName: text("guest_name"),
    status: spotStatusEnum("status").notNull(),
    queuedAt: ts("queued_at").defaultNow().notNull(),
    offerExpiresAt: ts("offer_expires_at"),
    confirmedAt: ts("confirmed_at"),
    leftAt: ts("left_at"),
    lateDrop: boolean("late_drop").default(false).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("spots_one_per_player_uq").on(t.gameId, t.userId).where(sql`${t.guestName} is null`),
    index("spots_game_status_idx").on(t.gameId, t.status, t.queuedAt),
    index("spots_user_idx").on(t.userId),
  ],
);

/** Inbox items. Rows with `sms_pending` are sent by the dispatcher after the change commits. */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    gameId: uuid("game_id").references(() => games.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").references(() => groups.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    url: text("url"),
    smsPending: boolean("sms_pending").default(false).notNull(),
    sentAt: ts("sent_at"),
    readAt: ts("read_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("notifications_user_idx").on(t.userId, t.createdAt),
    index("notifications_pending_idx").on(t.smsPending),
  ],
);

export type User = typeof users.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type Schedule = typeof schedules.$inferSelect;
export type Game = typeof games.$inferSelect;
export type Spot = typeof spots.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Sport = (typeof sportEnum.enumValues)[number];
