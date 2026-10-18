import { eq } from "drizzle-orm";
import { db, t } from "@/server/db";

/** Profile photos. URLs carry ?v={avatarVersion}, so each version can be cached forever. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response(null, { status: 404 });
  const [row] = await db.select({ avatar: t.users.avatar }).from(t.users).where(eq(t.users.id, id));
  if (!row?.avatar) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(row.avatar), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
