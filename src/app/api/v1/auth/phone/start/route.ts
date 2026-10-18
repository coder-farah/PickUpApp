import { z } from "zod";
import { api, ApiError, readJson } from "@/server/api";
import { sendLoginCode } from "@/server/auth";
import { normalizePhone } from "@/lib/phone";

/** Text a 6-digit code. */
export const POST = api(async (req) => {
  const { phone: raw } = await readJson(req, z.object({ phone: z.string().max(30) }));
  const phone = normalizePhone(raw);
  if (!phone) throw new ApiError(400, "Enter a mobile number, like (415) 555-0123.");
  await sendLoginCode(phone);
  return { phone };
});
