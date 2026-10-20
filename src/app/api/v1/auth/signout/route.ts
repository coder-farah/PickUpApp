import { z } from "zod";
import { eq } from "drizzle-orm";
import { api, readJson } from "@/server/api";
import { endSession } from "@/server/auth";
import { db, t } from "@/server/db";

/** End this phone's session, and stop pushes to it. */
export const POST = api(async (req) => {
  const { pushToken } = await readJson(req, z.object({ pushToken: z.string().max(200).nullish() }));
  if (pushToken) await db.delete(t.pushTokens).where(eq(t.pushTokens.token, pushToken));
  await endSession();
  return { ok: true };
});
