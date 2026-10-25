import { api, needUser, readJson, sendAlerts } from "@/server/api";
import { getCurrentUser } from "@/server/auth";
import { editGame, gameEditInput } from "@/server/hosting";
import { loadGame } from "@/server/loaders";

/** One game: the count, the roster, your spot and what you can do. Anyone with the code can see it. */
export const GET = api<{ code: string }>(async (_req, { code }) => {
  const user = await getCurrentUser();
  return loadGame(code, user?.id ?? null);
});

/** The host changes the game. A new time or place alerts everyone on the list. */
export const PATCH = api<{ code: string }>(async (req, { code }) => {
  const user = await needUser();
  await editGame(user, code, await readJson(req, gameEditInput));
  sendAlerts();
  return loadGame(code, user.id);
});
