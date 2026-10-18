import { and, eq, isNull } from "drizzle-orm";
import { api, needUser } from "@/server/api";
import { db, t } from "@/server/db";

/** Mark everything read (clears the app-icon badge on the next push). */
export const POST = api(async () => {
  const user = await needUser();
  await db
    .update(t.notifications)
    .set({ readAt: new Date() })
    .where(and(eq(t.notifications.userId, user.id), isNull(t.notifications.readAt)));
  return { ok: true };
});
