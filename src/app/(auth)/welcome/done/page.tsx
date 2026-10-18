import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { requireUser, safeNext } from "@/server/auth";
import { db, t } from "@/server/db";
import { Avatar } from "@/components/Avatar";
import { PitchMotif } from "@/components/Logo";
import { buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "You're in" };

export default async function DonePage({ searchParams }: { searchParams: Promise<{ next?: string; n?: string; game?: string }> }) {
  const { next: rawNext, n, game: gameCode } = await searchParams;
  const user = await requireUser("/welcome/done");
  const next = safeNext(rawNext);
  const sent = Math.max(0, Number(n) || 0);
  const [game] = gameCode ? await db.select({ title: t.games.title }).from(t.games).where(eq(t.games.code, gameCode)) : [];
  const first = (user.name ?? "").split(" ")[0];
  const summary = sent
    ? `${sent} friend${sent === 1 ? "" : "s"} invited${game ? ` to ${game.title}` : ""}. We'll let you know when they join.`
    : "Find a game near you, or host one and share the link.";

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-night text-white" style={{ ["--ring" as string]: "var(--night)" }}>
      <PitchMotif className="top-10 -left-40 size-[620px]" />
      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 text-center" style={{ paddingBottom: "max(28px, env(safe-area-inset-bottom))" }}>
        <div className="rise flex flex-col items-center">
          <span className="rounded-full bg-lime p-1">
            <Avatar name={user.name} seed={user.id} photo={user.avatarVersion} size={96} />
          </span>
          <h1 className="disp mt-8 text-[64px]">
            You&apos;re in,
            <br />
            <span className="text-lime">{first || "player"}</span>
          </h1>
          <p className="mt-4 max-w-xs text-[15px] text-white/65">{summary}</p>
        </div>
        <Link href={next === "/" ? "/discover" : next} className={buttonClass("lime", "lg", "rise mt-10 w-full")}>
          {next === "/" ? "Find a game" : "Continue"}
        </Link>
        {user.username && <p className="mono mt-4 text-[11px] text-white/45">@{user.username}</p>}
      </div>
    </div>
  );
}
