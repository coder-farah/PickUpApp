// Checks the App Store Connect API key without printing it: shape of each value, then one API call.
import { createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";

const { ASC_KEY_ID: kid = "", ASC_ISSUER_ID: iss = "" } = process.env;
const pem = readFileSync(process.argv[2], "utf8");
console.log("Key ID is 10 letters/digits:", /^[A-Z0-9]{10}$/.test(kid.trim()), "| has stray whitespace:", kid !== kid.trim());
if (process.env.EXPECT_KEY_ID) console.log("Key ID matches", process.env.EXPECT_KEY_ID + ":", kid.trim() === process.env.EXPECT_KEY_ID);
console.log("Issuer ID is a UUID:", /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(iss.trim()), "| has stray whitespace:", iss !== iss.trim());
console.log("Key file has BEGIN/END PRIVATE KEY lines:", pem.includes("-----BEGIN PRIVATE KEY-----") && pem.includes("-----END PRIVATE KEY-----"), "| lines:", pem.trim().split("\n").length);
let key;
try {
  key = createPrivateKey(pem);
  console.log("Key parses:", true, "| type:", key.asymmetricKeyType);
} catch (e) {
  console.log("Key parses:", false, "|", e.message);
  process.exit(1);
}
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
// A team key signs with the issuer ID; an individual key signs with sub "user" instead.
for (const [label, claims] of [["as a team key", { iss: iss.trim() }], ["as an individual key", { sub: "user" }]]) {
  const body = `${b64({ alg: "ES256", kid: kid.trim(), typ: "JWT" })}.${b64({ ...claims, iat: now, exp: now + 600, aud: "appstoreconnect-v1" })}`;
  const sig = sign("sha256", Buffer.from(body), { key, dsaEncoding: "ieee-p1363" }).toString("base64url");
  for (const path of ["/v1/apps?limit=1", "/v1/certificates?limit=1"]) {
    const r = await fetch(`https://api.appstoreconnect.apple.com${path}`, { headers: { Authorization: `Bearer ${body}.${sig}` } });
    const j = await r.json().catch(() => ({}));
    console.log(label, path, "->", r.status, (j.errors ?? []).map((e) => `${e.code}: ${e.title}`).join(" | "));
  }
}
