import { useEffect } from "react";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold } from "@expo-google-fonts/geist";
import { GeistMono_400Regular, GeistMono_500Medium } from "@expo-google-fonts/geist-mono";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { AppState, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/lib/auth";
import { refreshPushRegistration } from "@/lib/push";
import { useTheme } from "@/theme";

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1 } } });

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

  // Tapping a notification opens the game or crew it's about.
  useEffect(() => {
    if (Platform.OS === "web" || !signedIn) return;
    const open = (r: Notifications.NotificationResponse | null) => {
      const url = r?.notification.request.content.data?.url;
      if (typeof url === "string" && url.startsWith("/")) router.push(url as never);
    };
    void Notifications.getLastNotificationResponseAsync().then(open);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
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
          <Stack.Screen name="groups/[slug]" />
          <Stack.Screen name="join/[invite]" />
          <Stack.Screen name="inbox" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
