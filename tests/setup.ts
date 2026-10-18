import { beforeAll, beforeEach } from "vitest";

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://kickoff:kickoff@localhost:5432/kickoff_test";

beforeAll(async () => {
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const { db } = await import("@/server/db");
  await migrate(db, { migrationsFolder: "./drizzle" });
});

beforeEach(async () => {
  const { sql } = await import("@/server/db");
  await sql`truncate push_tokens, invites, notifications, spots, games, schedules, group_members, groups, sessions, login_codes, users cascade`;
});
