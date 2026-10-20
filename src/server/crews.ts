import "server-only";
import { and, eq, inArray, sql as dsql } from "drizzle-orm";
import { db, t } from "./db";
import { GameError } from "./engine";

/** Join a crew by its slug, or by an invite code for invite-only crews. Returns the crew. */
export async function joinCrew(userId: string, slugOrNull: string | null, invite: string | null) {
  const [bySlug] = slugOrNull ? await db.select().from(t.groups).where(eq(t.groups.slug, slugOrNull)) : [];
  const target = bySlug ?? (invite ? (await db.select().from(t.groups).where(eq(t.groups.inviteCode, invite)))[0] : undefined);
  if (!target) throw new GameError("This group doesn't exist anymore.");
  if (target.visibility === "private" && target.inviteCode !== invite) {
    throw new GameError("This group is invite-only. Ask an organizer for the link.");
  }
  await db.insert(t.groupMembers).values({ groupId: target.id, userId }).onConflictDoNothing();
  return target;
}

export async function leaveCrew(userId: string, groupId: string) {
  const members = await db.select().from(t.groupMembers).where(eq(t.groupMembers.groupId, groupId));
  const mine = members.find((m) => m.userId === userId);
  if (!mine) return;
  if (mine.role === "organizer" && members.filter((m) => m.role === "organizer").length === 1 && members.length > 1) {
    throw new GameError("You're the only organizer. Make someone else an organizer before leaving.");
  }
  await db.delete(t.groupMembers).where(and(eq(t.groupMembers.groupId, groupId), eq(t.groupMembers.userId, userId)));
}

/** Member counts and weekly times for crew cards. */
export async function crewStats(groupIds: string[]) {
  if (groupIds.length === 0) return new Map<string, { members: number; schedules: string | null }>();
  const rows = await db
    .select({
      id: t.groups.id,
      members: dsql<number>`(select count(*)::int from group_members m where m.group_id = ${t.groups.id})`,
      schedules: dsql<string | null>`(select string_agg(s.weekday::text || '@' || s.start_time, ',' order by s.weekday) from schedules s where s.group_id = ${t.groups.id} and s.active)`,
    })
    .from(t.groups)
    .where(inArray(t.groups.id, groupIds));
  return new Map(rows.map((r) => [r.id, { members: r.members, schedules: r.schedules }]));
}
