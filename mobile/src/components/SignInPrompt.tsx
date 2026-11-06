import type { ReactNode } from "react";
import { Linking, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_URL } from "@/api/client";
import { askToSignIn } from "@/lib/intent";
import { useTheme } from "@/theme";
import { Body, Button, Disp, Mono, Page } from "./ui";

/** A tab that only makes sense with an account (Host, You), as a guest sees it. */
export function SignInPrompt({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Page padTop={insets.top + 12} style={{ paddingHorizontal: 16, gap: 18 }}>
      <View style={{ gap: 6 }}>
        <Mono size={11} color={c.muted}>
          {eyebrow.toUpperCase()}
        </Mono>
        <Disp size={40}>{title}</Disp>
        <Body size={15} color={c.muted}>
          {children}
        </Body>
      </View>
      <Button title="Sign in" size="lg" onPress={() => askToSignIn()} />
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 20 }}>
        <Body size={13} color={c.muted} onPress={() => void Linking.openURL(`${API_URL}/support`)}>
          Help and support
        </Body>
        <Body size={13} color={c.muted} onPress={() => void Linking.openURL(`${API_URL}/privacy`)}>
          Privacy policy
        </Body>
      </View>
    </Page>
  );
}
