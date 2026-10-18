import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { checkUsername } from "@/server/profile";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  return NextResponse.json(await checkUsername(req.nextUrl.searchParams.get("u") ?? "", user));
}
