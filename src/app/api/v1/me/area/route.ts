import { z } from "zod";
import { api, needUser, readJson } from "@/server/api";
import { saveArea } from "@/server/profile";
import { clampMiles } from "@/lib/geo";

/** Remember where Explore searches. */
export const PUT = api(async (req) => {
  const user = await needUser();
  const a = await readJson(
    req,
    z.object({ label: z.string().max(60).default("Pinned spot"), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), miles: z.number() }),
  );
  await saveArea(user.id, { label: a.label || "Pinned spot", lat: a.lat, lng: a.lng, miles: clampMiles(a.miles) });
  return { ok: true };
});
