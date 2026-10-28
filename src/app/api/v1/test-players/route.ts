import { z } from "zod";
import { api, ApiError, readJson } from "@/server/api";
import { removeTestPlayers, testPlayerSession, testPlayersAllowed } from "@/server/test-players";

const body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("session"),
    n: z.number().int().min(1).max(15),
    area: z.object({ label: z.string().max(60), lat: z.number(), lng: z.number() }).optional(),
  }),
  z.object({ action: z.literal("remove") }),
]);

/** Signs in a test player, or removes them all. Used by the "Test players" GitHub action; 404 without the key. */
export const POST = api(async (req) => {
  if (!testPlayersAllowed(req.headers.get("x-test-players-key"))) throw new ApiError(404, "Not found.");
  const input = await readJson(req, body);
  if (input.action === "remove") return { removed: await removeTestPlayers() };
  return testPlayerSession(input.n, input.area);
});
