"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Home, Plus, Search, User } from "lucide-react";
import { Logo } from "./Logo";
import { Avatar } from "./Avatar";
import { buttonClass } from "./ui";
import { cn } from "@/lib/cn";

const items = [
  { href: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  { href: "/discover", label: "Explore", icon: Search, match: (p: string) => p.startsWith("/discover") },
  { href: "/new", label: "Host", icon: Plus, match: (p: string) => p.startsWith("/new") },
  { href: "/me", label: "You", icon: User, match: (p: string) => p.startsWith("/me") },
];

/** Pages that open on a pitch-night hero; the header floats over it in white. */
const onNight = (path: string) =>
  path === "/" || path.startsWith("/g/") || path.startsWith("/groups/") || path.startsWith("/i/");

type HeaderUser = { id: string; name: string | null; avatarVersion: number } | null;

export function AppHeader({ user, unread }: { user: HeaderUser; unread: number }) {
  const path = usePathname();
  const night = onNight(path);
  return (
    <header
      className={cn("z-30 w-full", night ? "absolute inset-x-0 top-0 text-white" : "sticky top-0 bg-bg/88 backdrop-blur-xl")}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" aria-label="Pitchin home">
            <Logo />
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {items
              .filter((i) => i.href !== "/me")
              .map((i) => (
                <Link
                  key={i.href}
                  href={i.href}
                  aria-current={i.match(path) ? "page" : undefined}
                  className={cn(
                    "rounded-full px-3.5 py-2 text-[14px] font-medium transition-colors",
                    i.match(path) ? (night ? "bg-white/10 text-lime" : "bg-surface text-ink shadow-card") : night ? "text-white/60 hover:text-white" : "text-muted hover:text-ink",
                  )}
                >
                  {i.label}
                </Link>
              ))}
          </nav>
        </div>
        {user ? (
          <div className="flex items-center gap-2" style={{ ["--ring" as string]: "transparent" }}>
            <Link href="/inbox" aria-label={unread ? `Inbox, ${unread} new` : "Inbox"} className={cn("relative grid size-10 place-items-center rounded-full", night ? "bg-white/10 hover:bg-white/15" : "bg-surface shadow-card hover:bg-surface-2")}>
              <Bell className="size-[18px]" />
              {unread > 0 && <span className="absolute top-2 right-2.5 size-2 rounded-full bg-lime ring-2 ring-night" />}
            </Link>
            <Link href="/me" aria-label="Your profile" className="rounded-full">
              <Avatar name={user.name} seed={user.id} photo={user.avatarVersion} size={40} />
            </Link>
          </div>
        ) : (
          <Link href={`/login?next=${encodeURIComponent(path)}`} className={buttonClass(night ? "white" : "primary", "sm")}>
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}

/** The floating tab bar on phones. */
export function BottomNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Tabs"
      className="fixed inset-x-4 z-40 mx-auto grid h-16 max-w-md grid-cols-4 rounded-full bg-nav px-2 shadow-[0_12px_32px_rgb(0_0_0/0.22)] md:hidden"
      style={{ bottom: "max(16px, env(safe-area-inset-bottom))" }}
    >
      {items.map((i) => {
        const active = i.match(path);
        const Icon = i.icon;
        if (i.href === "/new")
          return (
            <Link key={i.href} href="/new" aria-label="Host a game" className="flex items-center justify-center">
              <span className={cn("grid size-11 place-items-center rounded-full active:scale-95", active ? "bg-lime text-lime-ink" : "bg-white/10 text-white")}>
                <Plus className="size-5" strokeWidth={2.4} />
              </span>
            </Link>
          );
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={cn("flex flex-col items-center justify-center gap-1", active ? "text-lime" : "text-white/50")}
          >
            <Icon className="size-[21px]" strokeWidth={2} />
            <span className={cn("size-1 rounded-full", active ? "bg-lime" : "bg-transparent")} />
            <span className="sr-only">{i.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
