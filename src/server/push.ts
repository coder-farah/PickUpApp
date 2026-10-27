import { inArray } from "drizzle-orm";
import { db, t } from "./db";
import { env } from "./env";

/** Lock-screen notifications for the iPhone app, through Expo's push service (it holds the APNs key). */
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/** `categoryId` names the set of buttons the app shows on the notification (see mobile/src/lib/push.ts). */
export type PushMessage = { to: string; title: string; body: string; url?: string | null; badge?: number; categoryId?: string };

export const isExpoToken = (token: string) => /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token);

/** Send pushes in batches of 100. Never throws: the inbox already has every notification. */
export async function sendPush(messages: PushMessage[]) {
  if (!env.push.enabled || messages.length === 0) return 0;
  if (env.isTest) return messages.length;
  let sent = 0;
  const dead: string[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(env.push.accessToken ? { Authorization: `Bearer ${env.push.accessToken}` } : {}),
        },
        body: JSON.stringify(
          batch.map((m) => ({
            to: m.to,
            title: m.title,
            body: m.body,
            sound: "default",
            badge: m.badge,
            ...(m.categoryId ? { categoryId: m.categoryId } : {}),
            data: m.url ? { url: m.url } : {},
          })),
        ),
        signal: AbortSignal.timeout(8000),
      });
      const json = (await res.json().catch(() => ({}))) as { data?: { status: string; details?: { error?: string } }[] };
      (json.data ?? []).forEach((r, j) => {
        if (r.status === "ok") sent++;
        else if (r.details?.error === "DeviceNotRegistered") dead.push(batch[j].to);
        else console.error("[push] failed", r.details?.error ?? r.status);
      });
    } catch (err) {
      console.error("[push] request failed", err);
    }
  }
  if (dead.length) await db.delete(t.pushTokens).where(inArray(t.pushTokens.token, dead));
  return sent;
}
