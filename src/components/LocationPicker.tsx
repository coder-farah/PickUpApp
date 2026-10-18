"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LocateFixed, Loader2, MapPin, Search, X } from "lucide-react";
import { saveAreaAction } from "@/app/actions";
import { buttonClass } from "./ui";
import { MAX_MILES, MILE_PRESETS, MIN_MILES, type Place } from "@/lib/geo";
import { cn } from "@/lib/cn";

type Props = {
  place: Place;
  miles: number;
  view: "list" | "map";
  signedIn: boolean;
};

/**
 * Where Explore searches: the device's location (the browser asks first) or a city or ZIP,
 * plus a radius from 1 to 50 miles. The choice lives in the URL so it can be shared.
 */
export function LocationPicker({ place, miles, view, signedIn }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-full bg-night py-2 pr-2 pl-4 text-left text-white"
        aria-haspopup="dialog"
      >
        <MapPin className="size-4 shrink-0 text-lime" />
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{place.label}</span>
        <span className="mono inline-flex h-9 shrink-0 items-center rounded-full bg-lime px-3.5 text-[12px] text-lime-ink">{miles} mi</span>
      </button>
      {open && <PickerSheet place={place} miles={miles} view={view} signedIn={signedIn} onClose={() => setOpen(false)} />}
    </>
  );
}

function PickerSheet({ place, miles, view, signedIn, onClose }: Props & { onClose: () => void }) {
  const router = useRouter();
  const [chosen, setChosen] = useState<Place>(place);
  const [radius, setRadius] = useState(miles);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [save, setSave] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  function search(q: string) {
    setQuery(q);
    clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/geo?q=${encodeURIComponent(q)}`);
        const json = (await res.json()) as { places: Place[] };
        setResults(json.places);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setProblem("This browser can't share your location. Search a city or ZIP instead.");
      return;
    }
    setProblem(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        let label = "Current location";
        try {
          const res = await fetch(`/api/geo?lat=${lat}&lng=${lng}`);
          label = ((await res.json()) as { label: string }).label;
        } catch {}
        setChosen({ lat, lng, label });
        setResults([]);
        setQuery("");
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setProblem(
          err.code === err.PERMISSION_DENIED
            ? "Location is off for Pitchin. Allow it in your browser settings, or search a city or ZIP."
            : "We couldn't find you just now. Try again, or search a city or ZIP.",
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  async function apply() {
    const q = new URLSearchParams({ lat: chosen.lat.toFixed(5), lng: chosen.lng.toFixed(5), place: chosen.label, r: String(radius) });
    if (view === "map") q.set("view", "map");
    if (save && signedIn) {
      const fd = new FormData();
      fd.set("lat", String(chosen.lat));
      fd.set("lng", String(chosen.lng));
      fd.set("label", chosen.label);
      fd.set("miles", String(radius));
      await saveAreaAction(null, fd);
    }
    onClose();
    router.push(`/discover?${q}`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label="Search area">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 cursor-default"
        style={{ background: "linear-gradient(180deg, transparent 0, transparent 14%, color-mix(in srgb, var(--bg) 70%, transparent) 30%, var(--bg) 46%)" }}
        onClick={onClose}
      />
      <div className="sheet-up relative w-full max-w-lg px-4 pb-[max(24px,env(safe-area-inset-bottom))] md:pb-0">
        <div className="flex max-h-[86dvh] flex-col gap-5 overflow-y-auto rounded-[28px] bg-surface p-5 shadow-[0_-12px_40px_rgb(0_0_0/0.12)] md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Search area</p>
              <h2 className="disp mt-1 text-[34px]">Where do you play?</h2>
            </div>
            <button type="button" aria-label="Close" onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2">
              <X className="size-4" />
            </button>
          </div>

          <button type="button" onClick={useMyLocation} className="flex items-center gap-3 rounded-2xl bg-night px-4 py-3.5 text-left text-white">
            {locating ? <Loader2 className="size-5 animate-spin text-lime" /> : <LocateFixed className="size-5 text-lime" />}
            <span className="flex-1">
              <span className="block text-[15px] font-medium">Use my current location</span>
              <span className="block text-[12.5px] text-white/60">Your browser will ask first. We don&apos;t store it unless you save it.</span>
            </span>
          </button>
          {problem && <p className="rounded-2xl bg-amber-soft px-4 py-3 text-[13.5px] text-amber">{problem}</p>}

          <div className="flex flex-col gap-2">
            <label htmlFor="place-q" className="eyebrow">
              Or a city or ZIP
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" />
              <input
                id="place-q"
                value={query}
                onChange={(e) => search(e.target.value)}
                placeholder="Oakland, 94110, Austin…"
                autoComplete="off"
                className="h-12 w-full rounded-2xl border border-line bg-surface pr-10 pl-11 text-[15px] focus:border-ink focus:outline-none"
              />
              {searching && <Loader2 className="absolute top-1/2 right-4 size-4 -translate-y-1/2 animate-spin text-muted" />}
            </div>
            {results.length > 0 && (
              <ul className="flex flex-col overflow-hidden rounded-2xl bg-surface-2">
                {results.map((r) => (
                  <li key={`${r.label}${r.lat}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setChosen(r);
                        setResults([]);
                        setQuery(r.label);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] hover:bg-line"
                    >
                      <MapPin className="size-4 shrink-0 text-muted" /> {r.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {query.trim().length >= 2 && !searching && results.length === 0 && <p className="text-[13px] text-muted">No places match that yet.</p>}
          </div>

          <div className="flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3">
            <MapPin className="size-4 shrink-0 text-pitch" />
            <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{chosen.label}</span>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <label htmlFor="radius" className="eyebrow">
                Radius
              </label>
              <span className="disp nums text-[30px]">
                {radius} <span className="text-[16px] text-muted">mi</span>
              </span>
            </div>
            <input
              id="radius"
              type="range"
              min={MIN_MILES}
              max={MAX_MILES}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full accent-[var(--night)]"
            />
            <div className="flex gap-2">
              {MILE_PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setRadius(m)}
                  className={cn("mono h-9 flex-1 rounded-full text-[12px]", radius === m ? "bg-night text-lime" : "bg-surface-2 text-ink-2")}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {signedIn && (
            <label className="flex items-center gap-3 text-[14.5px]">
              <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} className="size-4 accent-[var(--night)]" />
              Save as my area for Home and Explore
            </label>
          )}

          <button type="button" onClick={apply} className={buttonClass("primary", "lg", "w-full")}>
            Show games
          </button>
        </div>
      </div>
    </div>
  );
}
