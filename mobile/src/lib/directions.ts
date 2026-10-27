import { ActionSheetIOS, Alert, Linking, Platform } from "react-native";

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
  const options = [
    { label: "Apple Maps", url: links.apple },
    { label: "Google Maps", url: links.google },
    { label: "Waze", url: links.waze },
  ];
  const open = (url: string) => void Linking.openURL(url).catch(() => Alert.alert("Couldn't open maps"));
  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      { title: p.locationName, options: [...options.map((o) => o.label), "Cancel"], cancelButtonIndex: options.length },
      (i) => i < options.length && open(options[i].url),
    );
  } else {
    Alert.alert(p.locationName, "Get directions with", [...options.map((o) => ({ text: o.label, onPress: () => open(o.url) })), { text: "Cancel", style: "cancel" }]);
  }
}
