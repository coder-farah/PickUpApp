// Checks the App Store Connect API key (without printing it), then turns on the capabilities the app
// uses on its bundle ID. EAS's own capability sync fails on Associated Domains, so iOS setup skips it.
// Usage: node asc-prepare.mjs <key.p8> <bundle id>
import { createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";

const [keyPath, bundleId] = process.argv.slice(2);
const kid = (process.env.ASC_KEY_ID ?? "").trim();
const iss = (process.env.ASC_ISSUER_ID ?? "").trim();

let key;
try {
  key = createPrivateKey(readFileSync(keyPath, "utf8"));
} catch (e) {
  console.log(`::error::ASC_API_KEY_P8 isn't a readable .p8 key (${e.message}). Paste the whole file, BEGIN and END lines included.`);
  process.exit(1);
}
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const head = `${b64({ alg: "ES256", kid, typ: "JWT" })}.${b64({ iss, iat: now, exp: now + 900, aud: "appstoreconnect-v1" })}`;
const token = `${head}.${sign("sha256", Buffer.from(head), { key, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;

async function asc(method, path, body) {
  const r = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body && JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, json: j, error: (j.errors ?? []).map((e) => `${e.title}: ${e.detail}`).join(" | ") };
}

const found = await asc("GET", `/v1/bundleIds?filter[identifier]=${encodeURIComponent(bundleId)}&include=bundleIdCapabilities&limit=1`);
if (found.status === 401) {
  console.log("::error::Apple rejected the App Store Connect API key. Check that ASC_KEY_ID, ASC_ISSUER_ID and ASC_API_KEY_P8 all belong to the same team key.");
  process.exit(1);
}
const bundle = found.json.data?.find((b) => b.attributes.identifier === bundleId);
if (!bundle) {
  console.log(`Bundle ID ${bundleId} isn't registered yet; EAS will register it.`);
  process.exit(0);
}
const have = new Set((found.json.included ?? []).map((c) => c.attributes.capabilityType));
const wanted = {
  ASSOCIATED_DOMAINS: [],
  PUSH_NOTIFICATIONS: [],
  APPLE_ID_AUTH: [{ key: "APPLE_ID_AUTH_APP_CONSENT", options: [{ key: "PRIMARY_APP_CONSENT" }] }],
};
for (const [type, settings] of Object.entries(wanted)) {
  if (have.has(type)) {
    console.log(`${type}: already on`);
    continue;
  }
  const r = await asc("POST", "/v1/bundleIdCapabilities", {
    data: {
      type: "bundleIdCapabilities",
      attributes: { capabilityType: type, settings },
      relationships: { bundleId: { data: { type: "bundleIds", id: bundle.id } } },
    },
  });
  if (r.status >= 300) {
    console.log(`::error::Couldn't turn on ${type} (${r.status}): ${r.error}`);
    process.exit(1);
  }
  console.log(`${type}: turned on`);
}
