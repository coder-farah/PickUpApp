"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Compass, Home, Plus, User } from "lucide-react";
import { cn } from "@/lib/cn";

const items = [
  { href: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  { href: "/discover", label: "Discover", icon: Compass, match: (p: string) => p.startsWith("/discover") },
  { href: "/new", label: "Create", icon: Plus, match: (p: string) => p.startsWith("/new") || p.endsWith("/new") },
  { href: "/inbox", label: "Inbox", icon: Bell, match: (p: string) => p.startsWith("/inbox") },
  { href: "/me", label: "You", icon: User, match: (p: string) => p.startsWith("/me") },
];

export function DesktopNav() {
  const path = usePathname();
  return (
    <nav className="hidden items-center gap-1 md:flex">
      {items
        .filter((i) => i.href !== "/new" && i.href !== "/me")
        .map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={cn(
              "rounded-xl px-3.5 py-2 text-[14px] font-semibold transition-colors",
              i.match(path) ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink",
            )}
          >
            {i.label}
          </Link>
        ))}
    </nav>
  );
}

export function BottomNav({ unread }: { unread: number }) {
  const path = usePathname();
  return (
    <nav
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/92 px-2 pt-2 backdrop-blur-xl md:hidden"
      style={{ paddingLeft: "max(8px, env(safe-area-inset-left))", paddingRight: "max(8px, env(safe-area-inset-right))" }}
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {items.map((i) => {
          const active = i.match(path);
          const Icon = i.icon;
          if (i.href === "/new")
            return (
              <li key={i.href} className="flex justify-center">
                <Link href="/new" aria-label="Create a game" className="-mt-1 grid size-12 place-items-center rounded-2xl bg-pitch text-pitch-ink shadow-card active:scale-95">
                  <Plus className="size-6" strokeWidth={2.4} />
                </Link>
              </li>
            );
          return (
            <li key={i.href}>
              <Link href={i.href} className={cn("relative flex flex-col items-center gap-1 py-1 text-[10.5px] font-semibold", active ? "text-ink" : "text-muted")}>
                <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 1.8} />
                {i.label}
                {i.href === "/inbox" && unread > 0 && (
                  <span className="absolute top-0 right-[calc(50%-18px)] grid h-4 min-w-4 place-items-center rounded-full bg-signal px-1 font-mono text-[9.5px] text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
