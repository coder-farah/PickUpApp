import { api, needUser } from "@/server/api";
import { getInbox, unreadCount } from "@/server/queries";
import { inboxItemView } from "@/server/views";
import type { InboxView } from "@/lib/api-types";

export const GET = api(async (): Promise<InboxView> => {
  const user = await needUser();
  const now = new Date();
  const [items, unread] = await Promise.all([getInbox(user.id), unreadCount(user.id)]);
  return { items: items.map((n) => inboxItemView(n, now)), unread };
});
