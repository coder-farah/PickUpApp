import { NextResponse } from "next/server";
import { env } from "@/server/env";

/** Universal links: game, crew and invite links open in the iPhone app when it's installed. */
export function GET() {
  const appIDs = env.apple.teamId ? env.apple.bundleIds.map((b) => `${env.apple.teamId}.${b}`) : [];
  return NextResponse.json({
    applinks: {
      details: appIDs.length
        ? [{ appIDs, components: ["/g/*", "/groups/*", "/join/*", "/i/*"].map((path) => ({ "/": path })) }]
        : [],
    },
  });
}
