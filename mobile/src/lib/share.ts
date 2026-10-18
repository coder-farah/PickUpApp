import { Share } from "react-native";

/** The iOS share sheet: Messages, WhatsApp, copy link. */
export async function shareLink(message: string, url: string) {
  try {
    await Share.share({ message: `${message} ${url}`, url });
  } catch {
    // dismissed
  }
}
