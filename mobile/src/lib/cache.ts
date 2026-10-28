import { File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { keys } from "@/api/hooks";

/**
 * Your profile and Home, saved on the phone so the app opens straight to what you saw last and refreshes it quietly,
 * instead of waiting on the network behind a loading screen.
 */
const SAVED: QueryKey[] = [keys.me, keys.home];
type Saved = { key: QueryKey; data: unknown; at: number }[];

const file = () => new File(Paths.document, "saved-queries.json");

/** Put what was saved last time back into the query cache. Each entry keeps its old time, so it refetches on use. */
export function restoreSaved(qc: QueryClient) {
  if (Platform.OS === "web") return;
  try {
    const f = file();
    if (!f.exists) return;
    for (const { key, data, at } of JSON.parse(f.textSync()) as Saved) qc.setQueryData(key, data, { updatedAt: at });
  } catch {
    // A bad or unreadable file only costs us the head start.
  }
}

/** Save those queries whenever they change. Returns the unsubscribe. */
export function keepSaved(qc: QueryClient) {
  if (Platform.OS === "web") return () => undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const save = () => {
    const saved: Saved = [];
    for (const key of SAVED) {
      const s = qc.getQueryState(key);
      if (s?.data !== undefined) saved.push({ key, data: s.data, at: s.dataUpdatedAt });
    }
    try {
      if (saved.length) file().write(JSON.stringify(saved));
      else clearSaved();
    } catch {
      // Out of space or similar: the app still works, it just won't open instantly next time.
    }
  };
  const unsubscribe = qc.getQueryCache().subscribe((e) => {
    if (e.type !== "updated" && e.type !== "removed") return;
    if (!SAVED.some((k) => JSON.stringify(k) === JSON.stringify(e.query.queryKey))) return;
    clearTimeout(timer);
    timer = setTimeout(save, 500);
  });
  return () => {
    clearTimeout(timer);
    unsubscribe();
  };
}

/** Forget it all, on sign-out. */
export function clearSaved() {
  if (Platform.OS === "web") return;
  try {
    const f = file();
    if (f.exists) f.delete();
  } catch {
    // Nothing saved to remove.
  }
}
