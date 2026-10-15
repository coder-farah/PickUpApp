import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden px-[max(16px,env(safe-area-inset-left))]">
      <PitchLines />
      <header className="relative mx-auto flex h-16 w-full max-w-md items-center" style={{ marginTop: "env(safe-area-inset-top)" }}>
        <Link href="/">
          <Logo />
        </Link>
      </header>
      <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center pb-[12vh]">{children}</main>
    </div>
  );
}

/** Faint pitch markings behind the sign-in card. */
function PitchLines() {
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full text-line" preserveAspectRatio="xMidYMid slice" viewBox="0 0 800 1200">
      <g fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="60" y="60" width="680" height="1080" rx="4" />
        <line x1="60" y1="600" x2="740" y2="600" />
        <circle cx="400" cy="600" r="110" />
        <rect x="220" y="60" width="360" height="170" />
        <rect x="220" y="970" width="360" height="170" />
        <path d="M320 230a90 90 0 0 0 160 0M320 970a90 90 0 0 1 160 0" />
      </g>
    </svg>
  );
}
