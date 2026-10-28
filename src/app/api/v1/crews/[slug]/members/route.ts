import { z } from "zod";
import { api, needUser, readJson, sendAlerts } from "@/server/api";
import { setCrewRole } from "@/server/crews";
import { loadCrew } from "@/server/loaders";

/** An organizer makes a member an organizer, or an organizer a member again. Returns the crew. */
export const POST = api<{ slug: string }>(async (req, { slug }) => {
  const user = await needUser();
  const { userId, role } = await readJson(req, z.object({ userId: z.string().uuid(), role: z.enum(["organizer", "member"]) }));
  await setCrewRole(user, slug, userId, role);
  sendAlerts();
  return loadCrew(slug, user.id);
});
