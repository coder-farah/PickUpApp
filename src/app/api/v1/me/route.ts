import { eq } from "drizzle-orm";
import { z } from "zod";
import { api, needUser, readJson } from "@/server/api";
import { getCurrentUser } from "@/server/auth";
import { deleteAccount } from "@/server/account";
import { db, t } from "@/server/db";
import { saveProfile } from "@/server/profile";
import { getManagedGroups, getPlayerStats, unreadCount } from "@/server/queries";
import { userView } from "@/server/views";
import type { MeView } from "@/lib/api-types";

async function meView(userId: string): Promise<MeView> {
  const [user] = await db.select().from(t.users).where(eq(t.users.id, userId));
  const [stats, managed, unread] = await Promise.all([getPlayerStats(userId), getManagedGroups(userId), unreadCount(userId)]);
  return {
    user: userView(user),
    stats,
    managedCrews: managed.map((g) => ({ id: g.id, name: g.name, slug: g.slug })),
    unread,
  };
}

export const GET = api(async () => meView((await needUser()).id));

/** Save the profile. First run sends `onboarded: true`. The photo is a 256px JPEG data URL. */
export const PATCH = api(async (req) => {
  const user = await needUser();
  const body = await readJson(
    req,
    z.object({
      name: z.string().max(80),
      username: z.string().max(40).default(""),
      photo: z.string().max(450_000).nullish(),
      removePhoto: z.boolean().default(false),
      smsEnabled: z.boolean().optional(),
      onboarded: z.boolean().optional(),
    }),
  );
  await saveProfile(user, { name: body.name, username: body.username, photo: body.photo ?? "", removePhoto: body.removePhoto });
  await db
    .update(t.users)
    .set({
      ...(body.smsEnabled !== undefined ? { smsEnabled: body.smsEnabled } : {}),
      ...(body.onboarded && !user.onboardedAt ? { onboardedAt: new Date() } : {}),
    })
    .where(eq(t.users.id, user.id));
  return meView(user.id);
});

/** Delete the account (App Store rule 5.1.1(v)). */
export const DELETE = api(async () => {
  const user = await getCurrentUser();
  if (user) await deleteAccount(user.id);
  return { ok: true };
});
