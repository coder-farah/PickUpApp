import "server-only";
import { ApiError } from "./api";
import { env } from "./env";
import { getGamePage, getGroupPage } from "./queries";
import { blockedBy } from "./blocks";
import { cardView, crewCardView, face, gameDetailView, scheduleLabel } from "./views";
import type { CrewView, GameDetailView } from "@/lib/api-types";

export async function loadGame(code: string, viewerId: string | null): Promise<GameDetailView> {
  const page = await getGamePage(code, viewerId);
  if (!page) throw new ApiError(404, "This game doesn't exist.");
  const view = gameDetailView(page, viewerId);
  const mine = await blockedBy(viewerId);
  const here = [view.host, ...view.playing, ...view.queue].map((x) => ("userId" in x ? x.userId : x.id));
  return { ...view, blocked: [...new Set(here.filter((id) => mine.has(id)))] };
}

export async function loadCrew(slug: string, viewerId: string | null): Promise<CrewView> {
  const p = await getGroupPage(slug, viewerId);
  if (!p) throw new ApiError(404, "This crew doesn't exist.");
  const now = new Date();
  const g = p.group;
  const active = p.schedules.filter((s) => s.active);
  return {
    crew: {
      ...crewCardView({ group: g, members: p.members.length, schedules: active.map((s) => `${s.weekday}@${s.startTime}`).join(",") }),
      description: g.description,
      homeField: g.homeField,
      area: g.area,
      visibility: g.visibility,
      shareUrl: `${env.appUrl}/groups/${g.slug}`,
      inviteUrl: p.isOrganizer && g.inviteCode ? `${env.appUrl}/join/${g.inviteCode}` : null,
      chatUrl: p.isMember ? g.chatUrl : null,
    },
    members: p.members.map((m) => ({ ...face({ id: m.id, name: m.name, v: m.v }), role: m.role })),
    schedules: p.schedules.map((s) => ({ id: s.id, label: scheduleLabel(`${s.weekday}@${s.startTime}`), active: s.active })),
    games: p.games.map((c) => cardView(c, now)),
    isMember: p.isMember,
    isOrganizer: p.isOrganizer,
  };
}
