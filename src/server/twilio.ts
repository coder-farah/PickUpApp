import { env } from "./env";

/** A refused Twilio request, with Twilio's own error code (60200 bad number, 60203 too many tries, 60205 landline, 60410/60605 blocked). */
export class TwilioError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number,
  ) {
    super(message);
  }
}

async function twilioPost(url: string, body: Record<string, string>) {
  const auth = Buffer.from(`${env.twilio.accountSid}:${env.twilio.authToken}`).toString("base64");
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const code = typeof json.code === "number" ? json.code : undefined;
    throw new TwilioError(`Twilio ${res.status}${code ? ` (${code})` : ""}: ${String(json.message ?? "request failed")}`, res.status, code);
  }
  return json;
}

export async function sendSms(to: string, body: string) {
  await twilioPost(`https://api.twilio.com/2010-04-01/Accounts/${env.twilio.accountSid}/Messages.json`, {
    To: to,
    From: env.twilio.fromNumber,
    Body: body,
  });
}

export async function startVerification(to: string) {
  await twilioPost(`https://verify.twilio.com/v2/Services/${env.twilio.verifyServiceSid}/Verifications`, {
    To: to,
    Channel: "sms",
  });
}

export async function checkVerification(to: string, code: string): Promise<boolean> {
  try {
    const json = await twilioPost(`https://verify.twilio.com/v2/Services/${env.twilio.verifyServiceSid}/VerificationCheck`, {
      To: to,
      Code: code,
    });
    return json.status === "approved";
  } catch {
    return false;
  }
}
