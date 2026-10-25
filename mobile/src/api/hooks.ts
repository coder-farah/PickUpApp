import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { CrewView, DiscoverView, GameDetailView, HomeView, InboxView, MeView } from "./types";

export const keys = {
  home: ["home"] as const,
  me: ["me"] as const,
  inbox: ["inbox"] as const,
  game: (code: string) => ["game", code] as const,
  crew: (slug: string) => ["crew", slug] as const,
  discover: (q: string) => ["discover", q] as const,
};

export const useHome = () => useQuery({ queryKey: keys.home, queryFn: () => api<HomeView>("/api/v1/home") });
export const useMe = () => useQuery({ queryKey: keys.me, queryFn: () => api<MeView>("/api/v1/me") });
export const useInbox = () => useQuery({ queryKey: keys.inbox, queryFn: () => api<InboxView>("/api/v1/inbox") });
export const useGame = (code: string, enabled = true) =>
  useQuery({ queryKey: keys.game(code), queryFn: () => api<GameDetailView>(`/api/v1/games/${encodeURIComponent(code)}`), enabled });
export const useCrew = (slug: string) =>
  useQuery({ queryKey: keys.crew(slug), queryFn: () => api<CrewView>(`/api/v1/crews/${encodeURIComponent(slug)}`) });

export type DiscoverQuery = { lat?: number; lng?: number; place?: string; r?: number; day?: string | null };
export function useDiscover(q: DiscoverQuery) {
  const params = new URLSearchParams();
  if (q.lat != null && q.lng != null) {
    params.set("lat", q.lat.toFixed(5));
    params.set("lng", q.lng.toFixed(5));
    if (q.place) params.set("place", q.place);
  }
  if (q.r) params.set("r", String(q.r));
  if (q.day) params.set("day", q.day);
  const qs = params.toString();
  return useQuery({ queryKey: keys.discover(qs), queryFn: () => api<DiscoverView>(`/api/v1/discover${qs ? `?${qs}` : ""}`) });
}

export type GameAction = "join" | "leave" | "claim" | "decline" | "guest" | "cancel" | "capacity";

/** Act on a game and show the fresh roster right away; home and lists refresh behind it. */
export function useGameAction(code: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, ...body }: { action: GameAction; spotId?: string; name?: string; reason?: string; capacity?: number | null }) =>
      api<GameDetailView>(`/api/v1/games/${encodeURIComponent(code)}/${action}`, { body }),
    onSuccess: (data) => {
      qc.setQueryData(keys.game(code), data);
      qc.invalidateQueries({ queryKey: keys.home });
      qc.invalidateQueries({ queryKey: ["discover"] });
    },
  });
}

export function useCrewAction(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, invite }: { action: "join" | "leave"; invite?: string }) =>
      api<CrewView>(`/api/v1/crews/${encodeURIComponent(slug)}/${action}`, { body: { invite } }),
    onSuccess: (data) => {
      qc.setQueryData(keys.crew(data.crew.slug), data);
      qc.invalidateQueries({ queryKey: keys.home });
    },
  });
}
