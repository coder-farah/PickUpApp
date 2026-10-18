import { z } from "zod";
import { api, ApiError, needUser, readJson, sendAlerts } from "@/server/api";
import * as engine from "@/server/engine";
import { getGamePage } from "@/server/queries";
import { loadGame } from "@/server/loaders";
import type { GameDetailView } from "@/lib/api-types";

const body = z
  .object({
    spotId: z.string().uuid().optional(),
    name: z.string().max(40).optional(),
    reason: z.string().max(200).optional(),
    capacity: z.number().int().nullable().optional(),
  })
  .default({});

/**
 * Player and host actions on a game: join, leave, claim, decline, guest, cancel, capacity.
 * Leave, claim and decline act on your own spot unless `spotId` says otherwise. Returns the game.
 */
export const POST = api<{ code: string; action: string }>(async (req, { code, action }): Promise<GameDetailView> => {
  const user = await needUser();
  const input = await readJson(req, body);
  const page = await getGamePage(code, user.id);
  if (!page) throw new ApiError(404, "This game doesn't exist.");
  const g = page.game;
  const spotId = input.spotId ?? page.myMain?.id;
  const needSpot = () => {
    if (!spotId) throw new ApiError(400, "You're not on the list for this game.");
    return spotId;
  };

  switch (action) {
    case "join":
      await engine.join(g.id, user.id);
      break;
    case "leave":
      await engine.leave(needSpot(), user.id);
      break;
    case "claim":
      await engine.claim(needSpot(), user.id);
      break;
    case "decline":
      await engine.decline(needSpot(), user.id);
      break;
    case "guest":
      await engine.addGuest(g.id, user.id, input.name ?? "");
      break;
    case "cancel":
      await engine.cancelGame(g.id, user.id, input.reason ?? null);
      break;
    case "capacity":
      await engine.setCapacity(g.id, user.id, input.capacity ?? null);
      break;
    default:
      throw new ApiError(404, "Unknown action.");
  }
  sendAlerts();
  return loadGame(code, user.id);
});
