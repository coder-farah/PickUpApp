import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "@/api/client";

/** Lock-screen notifications. We ask only when the person taps to turn them on, never at launch. */

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
});

const projectId = () => Constants.expoConfig?.extra?.eas?.projectId as string | undefined;

export async function pushStatus(): Promise<"on" | "off" | "blocked" | "unavailable"> {
  if (Platform.OS === "web" || !Device.isDevice) return "unavailable";
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === "granted") return "on";
  return canAskAgain ? "off" : "blocked";
}

export async function currentPushToken() {
  if ((await pushStatus()) !== "on" || !projectId()) return null;
  return (await Notifications.getExpoPushTokenAsync({ projectId: projectId() })).data;
}

/** Ask for permission (if needed) and register this phone with the server. Returns whether it's on. */
export async function enablePush(): Promise<boolean> {
  if (Platform.OS === "web" || !Device.isDevice || !projectId()) return false;
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== "granted") return false;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId: projectId() })).data;
  await api("/api/v1/me/push", { body: { token, platform: Platform.OS } });
  return true;
}

/** Re-register on launch when permission is already on (tokens can change). */
export async function refreshPushRegistration() {
  const token = await currentPushToken().catch(() => null);
  if (token) await api("/api/v1/me/push", { body: { token, platform: Platform.OS } }).catch(() => undefined);
}

export const clearBadge = () => (Platform.OS === "web" ? Promise.resolve() : Notifications.setBadgeCountAsync(0).then(() => undefined));

/**
 * Buttons on the lock-screen notification (press and hold it). The server picks the set by what the notification is
 * about: a game that just opened gets "I'm in", a game you're in gets "Can't make it", a held spot gets "Claim it".
 */
export const PUSH_ACTIONS = { join: "I'm in", leave: "Can't make it", claim: "Claim it", decline: "Pass" } as const;
export type PushAction = keyof typeof PUSH_ACTIONS;

const CATEGORIES: Record<string, PushAction[]> = {
  join: ["join"],
  playing: ["leave"],
  claim: ["claim"],
  offer: ["claim", "decline"],
};

export async function registerPushActions() {
  if (Platform.OS === "web") return;
  await Promise.all(
    Object.entries(CATEGORIES).map(([id, actions]) =>
      Notifications.setNotificationCategoryAsync(
        id,
        actions.map((a) => ({ identifier: a, buttonTitle: PUSH_ACTIONS[a], options: { opensAppToForeground: true, isDestructive: a === "leave" || a === "decline" } })),
      ),
    ),
  ).catch(() => undefined);
}

/** "/g/abc123" → "abc123" */
export const gameCodeFrom = (url: unknown) => (typeof url === "string" ? (/^\/g\/([^/?#]+)/.exec(url)?.[1] ?? null) : null);
