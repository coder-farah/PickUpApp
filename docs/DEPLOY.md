# Deploying the server on Railway

The website and the app's API are one Next.js server. It needs its database migrated before each deploy. Railway no longer reads `railway.json` for new services, so set these in the service's **Settings > Deploy** instead:

- **Pre-deploy Command**: `npm run db:migrate`. Without it the server starts on an empty database and every login fails.
- **Healthcheck Path**: `/api/health`.

1. **New project > Deploy from GitHub repo**, pick this repository, then set the pre-deploy command and healthcheck above.
2. **+ New > Database > PostgreSQL**. In the web service's variables, set `DATABASE_URL=${{Postgres.DATABASE_URL}}`.
3. **Settings > Networking**: generate a domain, or add your own (like `pitchin.app`) and point its DNS at Railway.
4. Set the variables below and deploy.
5. For staging, add a second environment (Environments > New) with its own database and domain.

| Variable | Value |
| --- | --- |
| `APP_URL` | the public URL, like `https://pitchin.app` |
| `TICK_IN_PROCESS` | `1`, so the scheduler runs inside the server every minute. Keep one replica. |
| `CRON_SECRET` | any long random string (only used if something outside calls `/api/cron/tick`) |
| `SUPPORT_EMAIL` | where people write in |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` | login codes |
| `TWILIO_FROM_NUMBER` | alert texts for people without the app |
| `APPLE_CLIENT_ID` | Services ID for the website's Apple button |
| `APPLE_BUNDLE_IDS`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | the iPhone app's Apple sign-in, see [IOS.md](IOS.md) |
| `AUTH_DEMO_PHONE`, `AUTH_DEMO_CODE` | App Review login: any US number (written any way) and a code of at least 6 digits. Works without Twilio. |

`npm run db:seed` loads demo games. Only run it on staging.
