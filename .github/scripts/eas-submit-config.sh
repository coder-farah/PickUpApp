#!/usr/bin/env bash
# Writes the App Store Connect API key to a file and adds the submit section to mobile/eas.json.
# eas.json has no submit section in git because EAS rejects one with empty values.
# The key never leaves the runner; *.p8 is gitignored. Runs from mobile/.
set -euo pipefail
for v in ASC_APP_ID APPLE_TEAM_ID ASC_API_KEY_P8 ASC_KEY_ID ASC_ISSUER_ID; do
  if [ -z "${!v:-}" ]; then echo "::error::$v isn't set. See docs/IOS.md."; exit 1; fi
done
printf '%s\n' "$ASC_API_KEY_P8" > asc-api-key.p8
jq --arg app "$ASC_APP_ID" --arg team "$APPLE_TEAM_ID" --arg key "$ASC_KEY_ID" --arg iss "$ASC_ISSUER_ID" \
  '.submit.production.ios += {ascApiKeyPath: "./asc-api-key.p8", ascAppId: $app, appleTeamId: $team, ascApiKeyId: $key, ascApiKeyIssuerId: $iss}' eas.json > eas.tmp && mv eas.tmp eas.json
