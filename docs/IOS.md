# Getting Pitchin onto TestFlight

The iPhone app is in `mobile/`: Expo SDK 54 with expo-router. There's no `ios/` folder in git. Expo's build service (EAS Build) makes it from `mobile/app.config.ts` on its own Macs, so no Mac is needed. Builds start from GitHub Actions.

Do the steps in order. Keys go into GitHub secrets or Railway, never into a chat, a file in the repo, or a commit.

## 1. Accounts

1. **Apple Developer Program** ($99 a year) at developer.apple.com, on the account that will own the app. Note the **Team ID** (Membership details).
2. **Expo** account at expo.dev. Create an access token (Account settings > Access tokens).

## 2. Apple setup

1. **Identifiers > App IDs > +**: bundle ID `app.pitchin.ios`. Turn on **Sign in with Apple**, **Push Notifications** and **Associated Domains**. The bundle ID is permanent once the App Store record exists. To use another one, change `IOS_BUNDLE_ID` in `mobile/app.config.ts` and `APPLE_BUNDLE_IDS` on the server.
2. **App Store Connect > Apps > +**: new iOS app named Pitchin with that bundle ID. Its **Apple ID** (a number, under App Information) is `ASC_APP_ID`.
3. **App Store Connect > Users and Access > Integrations > App Store Connect API > +**: a key with the **Admin** role (Expo needs it to make certificates). Download the `.p8` once, and note the **Key ID** and **Issuer ID**.
4. **Certificates, IDs & Profiles > Keys > +**: a key with **Sign in with Apple** enabled, for the server to revoke Apple sign-in when someone deletes their account. Note its Key ID. This one goes to Railway (step 4), not GitHub.

## 3. GitHub

Settings > Secrets and variables > Actions.

| Secret | Value |
| --- | --- |
| `EXPO_TOKEN` | Expo access token |
| `APPLE_TEAM_ID` | Team ID |
| `ASC_API_KEY_P8` | the whole App Store Connect `.p8` file, including the BEGIN and END lines |
| `ASC_KEY_ID` | its Key ID |
| `ASC_ISSUER_ID` | its Issuer ID |

| Variable | Value |
| --- | --- |
| `ASC_APP_ID` | the app's Apple ID from App Store Connect |
| `APPLE_TEAM_TYPE` | `COMPANY_OR_ORGANIZATION` if your Apple Developer membership is a company (optional; defaults to `INDIVIDUAL`) |
| `API_URL` | the production server, like `https://pitchin.app` |
| `APP_LINK_DOMAIN` | its domain, like `pitchin.app`, for universal links |
| `STAGING_API_URL`, `STAGING_APP_LINK_DOMAIN` | the same for staging (optional) |

When the variables aren't set, builds use the addresses in `mobile/eas.json`.

## 4. Server (Railway)

The app talks to the same Next.js server as the website. See [DEPLOY.md](DEPLOY.md) for Railway. For the app, also set:

- `APPLE_BUNDLE_IDS=app.pitchin.ios`
- `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (the Sign in with Apple key from step 2.4)
- `AUTH_DEMO_PHONE` and `AUTH_DEMO_CODE` for App Review, like `+15555550100` and a 6 digit code
- `SUPPORT_EMAIL`

Check `https://your-domain/.well-known/apple-app-site-association` returns JSON listing `TEAMID.app.pitchin.ios`, and that `/privacy` and `/support` load.

## 5. Build

1. **Actions > iOS setup > Run workflow**, once. It creates the Expo project, commits its ID into `mobile/app.config.ts`, and has Expo make the distribution certificate and provisioning profile.
2. **Actions > iOS build > Run workflow** with profile `production` and "Send to TestFlight" ticked. It runs the app's tests, builds on Expo (about 15 to 25 minutes) and uploads to App Store Connect. Build numbers go up on their own.
3. If a build finished without uploading, **Actions > TestFlight upload** sends the latest one.

Apple then processes the build (5 to 30 minutes). In App Store Connect > TestFlight, answer the export compliance question if asked (the app declares no non-exempt encryption, so it usually isn't), add yourself under **Internal Testing**, and install it with the TestFlight app.

## 6. Before external testers or the App Store

- **TestFlight > Test Information**: feedback email, privacy policy URL (`/privacy`), and review notes with the demo number and code.
- **App Privacy**: Pitchin collects name, phone number, email (Apple sign-in), photos (optional profile photo), coarse location (only when searching), and user ID, all linked to the user, none used for tracking.
- **Account deletion** is in Me > Delete account, as App Review requires.
- Upgrade Twilio from trial so codes reach any number. Twilio Verify alone doesn't need A2P 10DLC registration. Only the alert texts sent from `TWILIO_FROM_NUMBER` do, and app users get push instead.

## Running the app locally

```bash
cd mobile
npm install
EXPO_PUBLIC_API_URL=http://<your computer's LAN IP>:3000 npx expo start
```

Scan the QR code with Expo Go, or press `w` for a browser preview. Sign in with Apple and push only work in a real build.

`mobile/src/api/types.ts` is a copy of `src/lib/api-types.ts`. Copy it again after changing the API. A test fails when they drift.
