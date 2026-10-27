import { z } from "zod";
import { api, needUser, readJson, sendAlerts } from "@/server/api";
import { addCohost, cohostCandidates, removeCohost } from "@/server/cohosts";
import { loadGame } from "@/server/loaders";
import { face } from "@/server/views";
import type { CohostCandidatesView } from "@/lib/api-types";

const who = z.object({ userId: z.string().uuid() });

/** People the hosts can pick as a co-host. */
export const GET = api<{ code: string }>(async (_req, { code }): Promise<CohostCandidatesView> => {
  const user = await needUser();
  return { people: (await cohostCandidates(user, code)).map(face) };
});

/** Adds a co-host and tells them. Returns the game. */
export const POST = api<{ code: string }>(async (req, { code }) => {
  const user = await needUser();
  await addCohost(user, code, (await readJson(req, who)).userId);
  sendAlerts();
  return loadGame(code, user.id);
});

/** Takes a co-host off (or lets a co-host step down). Returns the game. */
export const DELETE = api<{ code: string }>(async (req, { code }) => {
  const user = await needUser();
  await removeCohost(user, code, (await readJson(req, who)).userId);
  return loadGame(code, user.id);
});
