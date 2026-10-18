import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getGamePage } from "@/server/queries";
import { gameState } from "@/lib/game-state";
import { fmtWhen } from "@/lib/time";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Game details";

const font = (f: string) => readFile(path.join(process.cwd(), "assets", f));

/** The card WhatsApp shows when someone pastes a game link. */
export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const data = await getGamePage(code, null);
  const [display, body] = await Promise.all([font("archivo-expanded-800.ttf"), font("archivo-500.ttf")]);
  const fonts = [
    { name: "Display", data: display, weight: 800 as const },
    { name: "Body", data: body, weight: 500 as const },
  ];
  if (!data) {
    return new ImageResponse(<div style={{ display: "flex", width: "100%", height: "100%", background: "#0E2B1D" }} />, { ...size, fonts });
  }
  const { game, playing } = data;
  const state = gameState(game, playing.length, data.queue.length);
  const cells = game.capacity === null ? [] : Array.from({ length: Math.min(game.capacity, 30) }, (_, i) => i);
  const accent = state.key === "cancelled" ? "#FF7452" : "#C8F25A";
  const note = game.capacity === null ? "going" : playing.length >= game.capacity ? "going · Full" : `going · ${game.capacity - playing.length} left`;

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#0E2B1D", color: "#fff", padding: 64, fontFamily: "Body", position: "relative" }}>
        <svg width="1200" height="630" viewBox="0 0 1200 630" style={{ position: "absolute", top: 0, left: 0, opacity: 0.12 }}>
          <circle cx="1040" cy="315" r="170" fill="none" stroke="#fff" strokeWidth="4" />
          <line x1="1040" y1="0" x2="1040" y2="630" stroke="#fff" strokeWidth="4" />
        </svg>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", padding: "8px 18px", borderRadius: 999, background: "rgba(255,255,255,.12)", color: accent, fontSize: 26, letterSpacing: 2, textTransform: "uppercase" }}>
            {state.label}
          </div>
          <div style={{ display: "flex", fontSize: 30, opacity: 0.8, letterSpacing: -1 }}>pitchin</div>
        </div>
        <div style={{ display: "flex", fontFamily: "Display", fontSize: game.title.length > 18 ? 84 : 104, lineHeight: 1, marginTop: 36, textTransform: "uppercase", letterSpacing: -2, maxWidth: 900 }}>
          {game.title}
        </div>
        <div style={{ display: "flex", fontSize: 34, marginTop: 20, opacity: 0.85 }}>
          {fmtWhen(game.startsAt, game.timezone)} · {game.locationName}
        </div>
        <div style={{ display: "flex", flex: 1 }} />
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "baseline", fontFamily: "Display" }}>
            <span style={{ fontSize: 120, lineHeight: 1 }}>{playing.length}</span>
            {game.capacity !== null && <span style={{ fontSize: 56, opacity: 0.5 }}>/{game.capacity}</span>}
            <span style={{ fontFamily: "Body", fontSize: 30, opacity: 0.7, marginLeft: 20 }}>{note}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 20 }}>
          {cells.map((i) => (
            <div key={i} style={{ display: "flex", flex: 1, height: 16, borderRadius: 8, background: i < playing.length ? accent : "rgba(255,255,255,.16)" }} />
          ))}
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
