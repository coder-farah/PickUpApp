import type { ExpoConfig } from "expo/config";

/**
 * Pitchin for iPhone. There's no ios/ folder in git: EAS generates it from this file at build time.
 * The bundle ID is permanent once the App Store record exists.
 */
const profile = process.env.EAS_BUILD_PROFILE ?? "development";
const storeBuild = profile === "production" || profile === "preview";
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
const appLinkDomain = process.env.APP_LINK_DOMAIN;
// Filled in once by the "iOS setup" workflow (eas init). Push tokens need it.
const EAS_PROJECT_ID = "c693dadd-6417-4dc0-94c4-54625cd5231a";

const config: ExpoConfig = {
  name: "Pitchin",
  slug: "pitchin",
  owner: process.env.EXPO_OWNER ?? "coder-farah",
  version: "1.0.0",
  scheme: "pitchin",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: false,
    bundleIdentifier: process.env.IOS_BUNDLE_ID ?? "app.pitchin.ios",
    usesAppleSignIn: true,
    ...(appLinkDomain ? { associatedDomains: [`applinks:${appLinkDomain}`] } : {}),
    infoPlist: {
      NSLocationWhenInUseUsageDescription: "Pitchin uses your location only when you tap Use my location, to find games near you.",
      NSPhotoLibraryUsageDescription: "Pitchin uses your photo library only when you choose a profile photo.",
      ...(storeBuild ? { NSAppTransportSecurity: { NSAllowsArbitraryLoads: false } } : {}),
    },
    config: { usesNonExemptEncryption: false },
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyAccessedAPITypes: [
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults", NSPrivacyAccessedAPITypeReasons: ["CA92.1"] },
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp", NSPrivacyAccessedAPITypeReasons: ["C617.1"] },
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategorySystemBootTime", NSPrivacyAccessedAPITypeReasons: ["35F9.1"] },
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace", NSPrivacyAccessedAPITypeReasons: ["E174.1"] },
      ],
    },
  },
  android: {
    package: "app.pitchin.android",
    adaptiveIcon: { foregroundImage: "./assets/adaptive-icon.png", backgroundColor: "#0C0D0C" },
  },
  web: { favicon: "./assets/favicon.png", bundler: "metro" },
  plugins: [
    "expo-router",
    ["expo-splash-screen", { image: "./assets/splash-icon.png", imageWidth: 120, backgroundColor: "#0E2B1D" }],
    ["expo-secure-store", { faceIDPermission: false }],
    ["expo-notifications", { mode: storeBuild ? "production" : "development" }],
    "expo-apple-authentication",
    ["expo-image-picker", { photosPermission: "Pitchin uses your photo library only when you choose a profile photo.", cameraPermission: false, microphonePermission: false }],
    ["expo-location", { locationWhenInUsePermission: "Pitchin uses your location only when you tap Use my location, to find games near you." }],
    "expo-font",
    "@react-native-community/datetimepicker",
    ["expo-build-properties", { ios: { deploymentTarget: "15.1" } }],
  ],
  experiments: { typedRoutes: false },
  extra: {
    apiUrl,
    supportEmail: process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? "support@pitchin.app",
    eas: { projectId: process.env.EAS_PROJECT_ID || EAS_PROJECT_ID || undefined },
  },
};

export default config;
