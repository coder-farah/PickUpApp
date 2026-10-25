import { Alert, Linking } from "react-native";
import { showMenu } from "./menu";

type Place = { locationName: string; locationAddress: string | null; lat: number | null; lng: number | null };

/** Links that open each maps app when it's installed and its website when it isn't, so no URL schemes are needed. */
export function directionLinks(p: Place) {
  const query = [p.locationName, p.locationAddress].filter(Boolean).join(", ");
  const point = p.lat != null && p.lng != null ? `${p.lat},${p.lng}` : null;
  const q = encodeURIComponent(query);
  return {
    apple: `https://maps.apple.com/?daddr=${point ?? q}&q=${q}`,
    google: `https://www.google.com/maps/dir/?api=1&destination=${point ?? q}`,
    waze: point ? `https://waze.com/ul?ll=${point}&navigate=yes` : `https://waze.com/ul?q=${q}&navigate=yes`,
  };
}

/** Ask which maps app to use, then open turn-by-turn directions to the game. */
export function openDirections(p: Place) {
  const links = directionLinks(p);
  const open = (url: string) => void Linking.openURL(url).catch(() => Alert.alert("Couldn't open maps"));
  showMenu(p.locationName, [
    { label: "Apple Maps", onPress: () => open(links.apple) },
    { label: "Google Maps", onPress: () => open(links.google) },
    { label: "Waze", onPress: () => open(links.waze) },
  ]);
}
