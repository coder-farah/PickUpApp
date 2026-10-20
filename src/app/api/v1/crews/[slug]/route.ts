import { api } from "@/server/api";
import { getCurrentUser } from "@/server/auth";
import { loadCrew } from "@/server/loaders";

export const GET = api<{ slug: string }>(async (_req, { slug }) => {
  const user = await getCurrentUser();
  return loadCrew(slug, user?.id ?? null);
});
