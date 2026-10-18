import { eq } from "drizzle-orm";
import { z } from "zod";
import { api, ApiError, needUser, readJson } from "@/server/api";
import { joinCrew, leaveCrew } from "@/server/crews";
import { db, t } from "@/server/db";
import { loadCrew } from "@/server/loaders";

/** `join` (with `invite` for invite-only crews; the slug can be "-" when joining by invite) or `leave`. */
export const POST = api<{ slug: string; action: string }>(async (req, { slug, action }) => {
  const user = await needUser();
  const { invite } = await readJson(req, z.object({ invite: z.string().max(40).nullish() }).default({}));
  if (action === "join") {
    const crew = await joinCrew(user.id, slug === "-" ? null : slug, invite ?? null);
    return loadCrew(crew.slug, user.id);
  }
  if (action === "leave") {
    const [g] = await db.select({ id: t.groups.id }).from(t.groups).where(eq(t.groups.slug, slug));
    if (!g) throw new ApiError(404, "This crew doesn't exist.");
    await leaveCrew(user.id, g.id);
    return loadCrew(slug, user.id);
  }
  throw new ApiError(404, "Unknown action.");
});
