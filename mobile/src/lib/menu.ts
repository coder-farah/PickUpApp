import { ActionSheetIOS, Alert, Platform } from "react-native";

export type MenuItem = { label: string; onPress: () => void; destructive?: boolean };

/** The iOS action sheet (an alert elsewhere): a short list of choices with Cancel at the bottom. */
export function showMenu(title: string | undefined, items: MenuItem[], message?: string) {
  if (Platform.OS === "ios") {
    const destructive = items.findIndex((i) => i.destructive);
    ActionSheetIOS.showActionSheetWithOptions(
      { title, message, options: [...items.map((i) => i.label), "Cancel"], cancelButtonIndex: items.length, destructiveButtonIndex: destructive < 0 ? undefined : destructive },
      (i) => i < items.length && items[i].onPress(),
    );
  } else {
    Alert.alert(title ?? "", message, [...items.map((i) => ({ text: i.label, style: i.destructive ? ("destructive" as const) : undefined, onPress: i.onPress })), { text: "Cancel", style: "cancel" }]);
  }
}
