#!/usr/bin/env bash
# Overrides the server address in mobile/eas.json with the repository's Actions variables, when set,
# and writes the App Store Connect key for --auto-submit. Runs from mobile/.
set -euo pipefail
if [ -n "${API_URL:-}" ]; then
  jq --arg p "$PROFILE" --arg v "$API_URL" '.build[$p].env.EXPO_PUBLIC_API_URL = $v' eas.json > eas.tmp && mv eas.tmp eas.json
fi
if [ -n "${APP_LINK_DOMAIN:-}" ]; then
  jq --arg p "$PROFILE" --arg v "$APP_LINK_DOMAIN" '.build[$p].env.APP_LINK_DOMAIN = $v' eas.json > eas.tmp && mv eas.tmp eas.json
fi
jq -r --arg p "$PROFILE" '"Building against " + .build[$p].env.EXPO_PUBLIC_API_URL' eas.json
