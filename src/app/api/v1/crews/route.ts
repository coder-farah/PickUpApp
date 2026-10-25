import { api, needUser, readJson } from "@/server/api";
import { createCrew, crewInput } from "@/server/hosting";

/** Start a weekly crew with its first weekly game. Returns its slug and the first game's code. */
export const POST = api(async (req) => {
  const user = await needUser();
  return createCrew(user, await readJson(req, crewInput));
});
