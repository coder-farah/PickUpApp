import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { api, ApiError, needUser, readJson } from "@/server/api";
import { db, t } from "@/server/db";
import { isExpoToken } from "@/server/push";

const schema = z.object({ token: z.string().max(200), platform: z.enum(["ios", "android"]).default("ios") });

/** Register this phone for pushes. A token moves to whoever signed in last on that phone. */
export const POST = api(async (req) => {
  const user = await needUser();
  const { token, platform } = await readJson(req, schema);
  if (!isExpoToken(token)) throw new ApiError(400, "That isn't a push token.");
  await db
    .insert(t.pushTokens)
    .values({ token, userId: user.id, platform })
    .onConflictDoUpdate({ target: t.pushTokens.token, set: { userId: user.id, platform, updatedAt: new Date() } });
  return { ok: true };
});

export const DELETE = api(async (req) => {
  const user = await needUser();
  const { token } = await readJson(req, schema.pick({ token: true }));
  await db.delete(t.pushTokens).where(and(eq(t.pushTokens.token, token), eq(t.pushTokens.userId, user.id)));
  return { ok: true };
});
