import Link from "next/link";
import { Bell, Plus } from "lucide-react";
import { getCurrentUser } from "@/server/auth";
import { unreadCount } from "@/server/queries";
import { Logo } from "@/components/Logo";
import { Avatar } from "@/components/Avatar";
import { BottomNav, DesktopNav } from "@/components/Nav";
import { ButtonLink } from "@/components/ui";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const unread = user ? await unreadCount(user.id) : 0;
  return (
    <div className="flex min-h-dvh flex-col">
      <header
        className="sticky z-30 border-b border-line/70 bg-bg/85 backdrop-blur-xl"
        style={{ top: 0, paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-[max(16px,env(safe-area-inset-left))] md:px-8">
          <div className="flex items-center gap-8">
            <Link href="/" aria-label="KickOff home">
              <Logo />
            </Link>
            <DesktopNav />
          </div>
          {user ? (
            <div className="flex items-center gap-2">
              <div className="hidden md:block">
                <ButtonLink href="/new" size="sm">
                  <Plus className="size-4" strokeWidth={2.4} /> New game
                </ButtonLink>
              </div>
              <Link href="/inbox" aria-label="Inbox" className="relative hidden size-9 place-items-center rounded-xl text-ink-2 hover:bg-surface md:grid">
                <Bell className="size-5" />
                {unread > 0 && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-signal ring-2 ring-bg" />}
              </Link>
              <Link href="/me" aria-label="Your profile" className="rounded-xl">
                <Avatar name={user.name} seed={user.id} size={34} />
              </Link>
            </div>
          ) : (
            <ButtonLink href="/login" size="sm" variant="secondary">
              Sign in
            </ButtonLink>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-[max(16px,env(safe-area-inset-left))] pt-6 pb-32 md:px-8 md:pt-10 md:pb-20">
        {children}
      </main>
      {user && <BottomNav unread={unread} />}
    </div>
  );
}
