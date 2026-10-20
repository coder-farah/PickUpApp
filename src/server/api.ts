import "server-only";
import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { AuthError, getCurrentUser } from "./auth";
import { GameError } from "./engine";
import { ProfileError } from "./profile";
import { dispatchPending } from "./notify";

/** Small helpers for the iPhone app's JSON API under /api/v1. */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Ctx<P> = { params: Promise<P> };

export function api<P = Record<string, never>>(fn: (req: NextRequest, params: P) => Promise<unknown>) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      const out = await fn(req, await ctx.params);
      return NextResponse.json(out ?? { ok: true }, { headers: { "Cache-Control": "no-store" } });
    } catch (err) {
      if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
      if (err instanceof GameError || err instanceof AuthError || err instanceof ProfileError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      if (err instanceof z.ZodError) {
        return NextResponse.json({ error: err.issues[0]?.message ?? "Check the form and try again." }, { status: 400 });
      }
      console.error("[api]", req.method, req.nextUrl.pathname, err);
      return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
    }
  };
}

export async function needUser() {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "Sign in first.");
  return user;
}

export async function readJson<T extends z.ZodTypeAny>(req: NextRequest, schema: T): Promise<z.infer<T>> {
  const raw = await req.json().catch(() => {
    throw new ApiError(400, "Send JSON.");
  });
  return schema.parse(raw);
}

/** Pushes and texts go out after the response, so taps feel instant. */
export function sendAlerts() {
  after(() => dispatchPending().catch((e) => console.error("[dispatch]", e)));
}
