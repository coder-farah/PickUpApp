import { and, eq, inArray, sql as dsql } from "drizzle-orm";
import { db, t, type DbOrTx } from "./db";
import { env, smsConfigured } from "./env";
import { sendSms } from "./twilio";
import { sendPush, type PushMessage } from "./push";

export type NotificationInput = {
  userId: string;
  kind:
    | "rsvps_open"
    | "game_on"
    | "game_at_risk"
    | "game_confirmed"
    | "game_cancelled"
    | "spot_offered"
    | "offer_expired"
    | "last_call"
    | "promoted"
    | "new_player"
    | "removed";
  title: string;
  body: string;
  gameId?: string | null;
  groupId?: string | null;
  url?: string | null;
  /** Also alert the player: a push on their iPhone, or a text when they don't have the app. */
  sms?: boolean;
};

/** Write inbox rows inside the caller's transaction. Texts go out later via `dispatchPending`. */
export async function queueNotifications(tx: DbOrTx, items: NotificationInput[]) {
  if (items.length === 0) return;
  await tx.insert(t.notifications).values(
    items.map((n) => ({
      userId: n.userId,
      kind: n.kind,
      title: n.title,
      body: n.body,
      gameId: n.gameId ?? null,
      groupId: n.groupId ?? null,
      url: n.url ?? null,
      smsPending: !!n.sms,
    })),
  );
}

export const gameUrl = (code: string) => `/g/${code}`;
export const absoluteUrl = (path: string) => `${env.appUrl}${path}`;

/** Send pending text messages. Safe to run concurrently: rows are claimed with SKIP LOCKED. */
export async function dispatchPending(limit = 100) {
  const rows = await db.transaction(async (tx) => {
    const claimed = await tx.execute<{ id: string }>(
      dsql`select id from notifications where sms_pending = true order by created_at limit ${limit} for update skip locked`,
    );
    const ids = claimed.map((r) => r.id);
    if (ids.length === 0) return [];
    const items = await tx
      .select({ n: t.notifications, phone: t.users.phone, smsEnabled: t.users.smsEnabled })
      .from(t.notifications)
      .innerJoin(t.users, eq(t.users.id, t.notifications.userId))
      .where(inArray(t.notifications.id, ids));
    await tx
      .update(t.notifications)
      .set({ smsPending: false, sentAt: new Date() })
      .where(and(inArray(t.notifications.id, ids)));
    return items;
  });

  // Players with the app get a push. Everyone else gets a text, unless they turned texts off.
  const userIds = [...new Set(rows.map((r) => r.n.userId))];
  const tokens = userIds.length
    ? await db.select().from(t.pushTokens).where(inArray(t.pushTokens.userId, userIds))
    : [];
  const unread = userIds.length
    ? await db
        .select({ userId: t.notifications.userId, n: dsql<number>`count(*)::int` })
        .from(t.notifications)
        .where(and(inArray(t.notifications.userId, userIds), dsql`${t.notifications.readAt} is null`))
        .groupBy(t.notifications.userId)
    : [];

  let sent = 0;
  const pushes: PushMessage[] = [];
  for (const { n, phone, smsEnabled } of rows) {
    const mine = tokens.filter((tk) => tk.userId === n.userId);
    if (mine.length) {
      const badge = unread.find((u) => u.userId === n.userId)?.n;
      for (const tk of mine) pushes.push({ to: tk.token, title: n.title, body: n.body, url: n.url, badge });
      continue;
    }
    if (!smsEnabled || !phone) continue; // Apple sign-ins without a phone only get the inbox
    const text = `${n.title}. ${n.body}${n.url ? ` ${absoluteUrl(n.url)}` : ""}`;
    if (smsConfigured()) {
      try {
        await sendSms(phone, text);
        sent++;
      } catch (err) {
        console.error("[sms] failed", phone, err);
      }
    } else if (!env.isTest) {
      console.log(`[sms → ${phone}] ${text}`);
    }
  }
  sent += await sendPush(pushes);
  return sent;
}
