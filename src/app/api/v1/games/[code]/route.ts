import { api } from "@/server/api";
import { getCurrentUser } from "@/server/auth";
import { loadGame } from "@/server/loaders";

/** One game: the count, the roster, your spot and what you can do. Anyone with the code can see it. */
export const GET = api<{ code: string }>(async (_req, { code }) => {
  const user = await getCurrentUser();
  return loadGame(code, user?.id ?? null);
});
