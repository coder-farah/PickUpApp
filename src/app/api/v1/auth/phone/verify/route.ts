import { z } from "zod";
import { api, ApiError, readJson } from "@/server/api";
import { checkLoginCode, issueSessionToken } from "@/server/auth";
import { userView } from "@/server/views";
import { normalizePhone } from "@/lib/phone";
import type { SessionView } from "@/lib/api-types";

/** Check the code and hand the app a session token. */
export const POST = api(async (req): Promise<SessionView> => {
  const body = await readJson(req, z.object({ phone: z.string().max(30), code: z.string().max(12) }));
  const phone = normalizePhone(body.phone);
  if (!phone) throw new ApiError(400, "Start again with your phone number.");
  const user = await checkLoginCode(phone, body.code.replace(/\s/g, ""));
  const session = await issueSessionToken(user.id);
  return { token: session.token, expiresAt: session.expiresAt.toISOString(), user: userView(user) };
});
