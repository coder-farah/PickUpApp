import { type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme";
import { ChevronLeft } from "./icons";
import { Body, Disp, Mono } from "./ui";

/** One step of sign-in or first run: back, progress dots, skip, a big title and the form. */
export function FlowPage({
  step,
  steps,
  title,
  lead,
  back = true,
  onSkip,
  children,
  footer,
}: {
  step?: number;
  steps?: number;
  title: string;
  lead?: ReactNode;
  back?: boolean;
  onSkip?: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", height: insets.top + 56 }}>
        <View style={{ width: 80 }}>
          {back && router.canGoBack() && (
            <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
              <ChevronLeft color={c.ink} size={24} />
            </Pressable>
          )}
        </View>
        <View style={{ flex: 1, flexDirection: "row", justifyContent: "center", gap: 6 }}>
          {steps
            ? Array.from({ length: steps }, (_, i) => (
                <View key={i} style={{ width: i === step ? 20 : 6, height: 6, borderRadius: 3, backgroundColor: i <= (step ?? 0) ? c.ink : c.lineStrong }} />
              ))
            : null}
        </View>
        <View style={{ width: 80, alignItems: "flex-end", paddingRight: 8 }}>
          {onSkip && (
            <Pressable onPress={onSkip} hitSlop={12}>
              <Mono size={12} color={c.ink2}>
                Skip
              </Mono>
            </Pressable>
          )}
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24, gap: 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 12 }}>
          <Disp size={52}>{title}</Disp>
          {lead ? (
            <Body size={16} color={c.ink2}>
              {lead}
            </Body>
          ) : null}
        </View>
        {children}
      </ScrollView>
      {footer ? <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 16, paddingTop: 8, gap: 12 }}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
}
