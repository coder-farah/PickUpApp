import { z } from "zod";
import { api, needUser, readJson, sendAlerts } from "@/server/api";
import { makeHost } from "@/server/cohosts";
import { loadGame } from "@/server/loaders";

/** Hands the game to another player; the old host stays on as a co-host. Returns the game. */
export const POST = api<{ code: string }>(async (req, { code }) => {
  const user = await needUser();
  await makeHost(user, code, (await readJson(req, z.object({ userId: z.string().uuid() }))).userId);
  sendAlerts();
  return loadGame(code, user.id);
});
