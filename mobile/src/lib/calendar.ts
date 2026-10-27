import * as Calendar from "expo-calendar";
import { Alert, Linking, Platform } from "react-native";
import { API_URL } from "@/api/client";

type Game = { code: string; title: string; startsAt: string; durationMinutes: number; locationName: string; locationAddress: string | null; shareUrl: string; notes: string | null };

/**
 * Opens the system "New Event" sheet filled in with the game; the person taps Add. iOS 17 and later need no calendar
 * permission for that sheet. Older iOS asks once.
 */
export async function addToCalendar(g: Game) {
  if (Platform.OS === "web") return void Linking.openURL(`${API_URL}/g/${encodeURIComponent(g.code)}/calendar.ics`);
  const start = new Date(g.startsAt);
  try {
    if (Platform.OS === "ios" && parseInt(String(Platform.Version), 10) < 17) {
      const { granted } = await Calendar.requestCalendarPermissionsAsync();
      if (!granted) return void Alert.alert("Calendar is off for Pitchin", "Turn it on in Settings to add games to your calendar.");
    }
    await Calendar.createEventInCalendarAsync({
      title: g.title,
      startDate: start,
      endDate: new Date(start.getTime() + g.durationMinutes * 60_000),
      location: [g.locationName, g.locationAddress].filter(Boolean).join(", "),
      url: g.shareUrl,
      notes: [g.notes, g.shareUrl].filter(Boolean).join("\n\n"),
    });
  } catch (err) {
    Alert.alert("Couldn't open your calendar", (err as Error).message);
  }
}
