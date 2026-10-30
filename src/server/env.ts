export const env = {
  appUrl: (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  // Shown on /support and /privacy, and in the App Store listing.
  supportEmail: process.env.SUPPORT_EMAIL ?? "support@pitchin.app",
  cronSecret: process.env.CRON_SECRET ?? "",
  isProd: process.env.NODE_ENV === "production",
  isTest: process.env.NODE_ENV === "test" || !!process.env.VITEST,
  apple: {
    // A Services ID from developer.apple.com, like "app.pitchin.web", for the website's Apple button
    clientId: process.env.APPLE_CLIENT_ID ?? "",
    // The iPhone app's bundle ID(s), comma-separated, like "app.pitchin.ios". The audience of native tokens.
    bundleIds: (process.env.APPLE_BUNDLE_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    // A Sign in with Apple key (.p8), used to revoke Apple sign-in when an account is deleted.
    teamId: process.env.APPLE_TEAM_ID ?? "",
    keyId: process.env.APPLE_KEY_ID ?? "",
    privateKey: (process.env.APPLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
  },
  // App Review signs in with this number and code. No text is sent.
  demo: {
    phone: process.env.AUTH_DEMO_PHONE ?? "",
    code: process.env.AUTH_DEMO_CODE ?? "",
  },
  // A public Mapbox token (pk.…) for the aerial photo at the top of a game. Without it games keep the plain night hero.
  mapboxToken: process.env.MAPBOX_TOKEN ?? "",
  // Turns on /api/v1/test-players, which signs in the fake players behind the "Test players" GitHub action.
  testPlayersKey: process.env.TEST_PLAYERS_KEY ?? "",
  push: {
    enabled: process.env.PUSH_NOTIFICATIONS !== "false",
    // Only needed when "Enhanced push security" is on in the Expo project.
    accessToken: process.env.EXPO_ACCESS_TOKEN ?? "",
  },
  // Run the scheduler inside the web server every minute (Railway and other always-on hosts).
  tickInProcess: process.env.TICK_IN_PROCESS === "1",
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
    authToken: process.env.TWILIO_AUTH_TOKEN ?? "",
    verifyServiceSid: process.env.TWILIO_VERIFY_SERVICE_SID ?? "",
    fromNumber: process.env.TWILIO_FROM_NUMBER ?? "",
  },
};

export const twilioConfigured = () => !!(env.twilio.accountSid && env.twilio.authToken);
export const smsConfigured = () => twilioConfigured() && !!env.twilio.fromNumber;
export const verifyConfigured = () => twilioConfigured() && !!env.twilio.verifyServiceSid;
