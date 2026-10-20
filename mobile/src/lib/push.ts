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
