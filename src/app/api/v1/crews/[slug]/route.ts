import { z } from "zod";
import { api, needUser, readJson } from "@/server/api";
import { getCurrentUser } from "@/server/auth";
import { setCrewChat } from "@/server/crews";
import { loadCrew } from "@/server/loaders";

export const GET = api<{ slug: string }>(async (_req, { slug }) => {
  const user = await getCurrentUser();
  return loadCrew(slug, user?.id ?? null);
});

/** Organizers set or clear the group chat link (`chatUrl: null` clears it). Returns the crew. */
export const PATCH = api<{ slug: string }>(async (req, { slug }) => {
  const user = await needUser();
  const { chatUrl } = await readJson(req, z.object({ chatUrl: z.string().max(300).nullable() }));
  await setCrewChat(user, slug, chatUrl);
  return loadCrew(slug, user.id);
});
