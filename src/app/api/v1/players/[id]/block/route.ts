import { api, needUser } from "@/server/api";
import { blockPlayer, unblockPlayer } from "@/server/blocks";

/** Block a player. */
export const POST = api<{ id: string }>(async (_req, { id }) => {
  const user = await needUser();
  await blockPlayer(user.id, id);
  return { blocked: true };
});

/** Unblock them. */
export const DELETE = api<{ id: string }>(async (_req, { id }) => {
  const user = await needUser();
  await unblockPlayer(user.id, id);
  return { blocked: false };
});
