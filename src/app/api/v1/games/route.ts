import { api, needUser, readJson, sendAlerts } from "@/server/api";
import { createGame, gameInput } from "@/server/hosting";

/** Post a one-time game. Returns its share code. */
export const POST = api(async (req) => {
  const user = await needUser();
  const game = await createGame(user, await readJson(req, gameInput));
  if (game.notified) sendAlerts();
  return { code: game.code };
});
