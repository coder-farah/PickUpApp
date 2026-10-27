import { useEffect } from "react";
import { Stack, router, type ErrorBoundaryProps } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold } from "@expo-google-fonts/geist";
import { GeistMono_400Regular, GeistMono_500Medium } from "@expo-google-fonts/geist-mono";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { Alert, AppState, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/lib/auth";
import { api } from "@/api/client";
import { keys } from "@/api/hooks";
import type { GameDetailView } from "@/api/types";
import { PUSH_ACTIONS, gameCodeFrom, refreshPushRegistration, registerPushActions, type PushAction } from "@/lib/push";
import { ErrorView } from "@/components/ui";
import { useTheme } from "@/theme";

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1 } } });

// An error outside rendering shows its message instead of closing the app, so a tester can screenshot it for us.
if (Platform.OS !== "web" && !__DEV__) {
  const seen = new Set<string>();
  ErrorUtils.setGlobalHandler((err) => {
    const e = err instanceof Error ? err : new Error(String(err));
    if (seen.has(e.message)) return;
    seen.add(e.message);
    Alert.alert("Something went wrong", [e.message, ...(e.stack ?? "").split("\n").slice(1, 4)].join("\n"));
  });
}

/** A screen that throws while drawing shows what broke and a way to try again, rather than a crash. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <ErrorView message={`Something went wrong.\n\n${error.message}`} onRetry={() => void retry()} />;
}

// Refetch when the app comes back to the foreground, like a browser tab regaining focus.
AppState.addEventListener("change", (s) => focusManager.setFocused(s === "active"));

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "ArchivoCondensed-ExtraBold": require("../../assets/fonts/ArchivoCondensed-ExtraBold.ttf"),
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    GeistMono_400Regular,
    GeistMono_500Medium,
  });
  if (!fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Navigator />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function Navigator() {
  const { status, user } = useAuth();
  const { c, isDark } = useTheme();
  const signedIn = status === "signedIn";
  const onboarded = signedIn && (user?.onboarded ?? true);

  useEffect(() => {
    if (status !== "loading") void SplashScreen.hideAsync();
    if (signedIn) void refreshPushRegistration();
  }, [status, signedIn]);

  // Tapping a notification opens the game or crew it's about. A button on it (I'm in, Can't make it…) acts first.
  useEffect(() => {
    if (Platform.OS === "web" || !signedIn) return;
    void registerPushActions();
    const open = async (r: Notifications.NotificationResponse | null) => {
      if (!r) return;
      Notifications.clearLastNotificationResponse();
      const url = r.notification.request.content.data?.url;
      const action = r.actionIdentifier as PushAction;
      const code = gameCodeFrom(url);
      if (code && action in PUSH_ACTIONS) {
        try {
          const fresh = await api<GameDetailView>(`/api/v1/games/${encodeURIComponent(code)}/${action}`, { body: {} });
          queryClient.setQueryData(keys.game(code), fresh);
          void queryClient.invalidateQueries({ queryKey: keys.home });
        } catch (err) {
          Alert.alert("Couldn't do that", (err as Error).message);
        }
      }
      if (typeof url === "string" && url.startsWith("/")) router.push(url as never);
    };
    void Notifications.getLastNotificationResponseAsync().then(open);
    const sub = Notifications.addNotificationResponseReceivedListener((r) => void open(r));
    return () => sub.remove();
  }, [signedIn]);

  if (status === "loading") return null;
  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !onboarded}>
          <Stack.Screen name="welcome" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="g/[code]" />
          <Stack.Screen name="edit/[code]" />
          <Stack.Screen name="groups/[slug]" />
          <Stack.Screen name="join/[invite]" />
          <Stack.Screen name="inbox" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
