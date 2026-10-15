import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <LogoMark className="size-12" />
      <h1 className="font-display text-[clamp(44px,10vw,96px)] uppercase">Out of bounds</h1>
      <p className="max-w-sm text-muted">This game, group or page doesn&apos;t exist. The link may have expired or been mistyped.</p>
      <Link href="/" className={buttonClass()}>
        Back to KickOff
      </Link>
    </div>
  );
}
