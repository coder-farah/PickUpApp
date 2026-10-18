import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { unreadCount } from "@/server/queries";
import { AppHeader, BottomNav } from "@/components/Nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Finish first-run setup (name, username, photo) before anything else.
  if (user && !user.onboardedAt) redirect("/welcome");
  const unread = user ? await unreadCount(user.id) : 0;
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip">
      <AppHeader user={user && { id: user.id, name: user.name, avatarVersion: user.avatarVersion }} unread={unread} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-36 md:px-8 md:pt-10 md:pb-20">{children}</main>
      {user && <BottomNav />}
    </div>
  );
}
