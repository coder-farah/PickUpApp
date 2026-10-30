import "server-only";
import { and, eq, inArray, sql as dsql } from "drizzle-orm";
import { db, t } from "./db";
import { GameError } from "./engine";
import { queueNotifications } from "./notify";
import type { SessionUser } from "./auth";

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

/**
 * Organizers run a crew: post its games and change its weekly times. Any organizer can make a member one, or make an
 * organizer (themselves included) a member again, as long as the crew keeps at least one.
 */
export async function setCrewRole(actor: SessionUser, slug: string, userId: string, role: "organizer" | "member") {
  const [g] = await db.select().from(t.groups).where(eq(t.groups.slug, slug));
  if (!g) throw new GameError("This crew doesn't exist.");
  const members = await db.select().from(t.groupMembers).where(eq(t.groupMembers.groupId, g.id));
  if (members.find((m) => m.userId === actor.id)?.role !== "organizer") throw new GameError("Only organizers can change who organizes.");
  const target = members.find((m) => m.userId === userId);
  if (!target) throw new GameError("They're not in this crew.");
  if (target.role === role) return;
  if (role === "member" && members.filter((m) => m.role === "organizer").length === 1) {
    throw new GameError("A crew needs an organizer. Make someone else one first.");
  }
  await db.transaction(async (tx) => {
    await tx.update(t.groupMembers).set({ role }).where(and(eq(t.groupMembers.groupId, g.id), eq(t.groupMembers.userId, userId)));
    if (role === "organizer" && userId !== actor.id) {
      await queueNotifications(tx, [
        {
          userId,
          kind: "organizer_added",
          title: `You're an organizer of ${g.name}`,
          body: `${(actor.name ?? "An organizer").split(" ")[0]} made you one. You can post its games and change its weekly times.`,
          groupId: g.id,
          url: `/groups/${g.slug}`,
          sms: true,
        },
      ]);
    }
  });
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
