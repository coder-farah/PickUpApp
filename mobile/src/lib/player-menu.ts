import { Alert, Linking } from "react-native";
import type { QueryClient } from "@tanstack/react-query";
import { API_URL, SUPPORT_EMAIL, api } from "@/api/client";
import { keys } from "@/api/hooks";
import { showMenu } from "@/lib/menu";
import { needsSignIn } from "@/lib/intent";

/** Report or block another player. Blocking keeps them off your games and crews and hides theirs from you. */
export function playerMenu(p: { id: string; name: string }, blocked: boolean, from: string, qc: QueryClient) {
  if (needsSignIn({ path: from })) return;
  const set = async (block: boolean) => {
    try {
      await api(`/api/v1/players/${p.id}/block`, { method: block ? "POST" : "DELETE" });
      void qc.invalidateQueries({ queryKey: ["game"] });
      void qc.invalidateQueries({ queryKey: keys.home });
      void qc.invalidateQueries({ queryKey: ["discover"] });
    } catch (err) {
      Alert.alert("Couldn't do that", (err as Error).message);
    }
  };
  const report = () =>
    void Linking.openURL(
      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Report player ${p.name}`)}&body=${encodeURIComponent(`Player: ${p.name} (${p.id})\n${API_URL}${from}\n\nWhat happened:`)}`,
    );
  showMenu(p.name, [
    { label: "Report", onPress: report },
    blocked
      ? { label: "Unblock", onPress: () => void set(false) }
      : {
          label: "Block",
          destructive: true,
          onPress: () =>
            Alert.alert(`Block ${p.name}?`, undefined, [
              { text: "Cancel", style: "cancel" },
              { text: "Block", style: "destructive", onPress: () => void set(true) },
            ]),
        },
  ]);
}
