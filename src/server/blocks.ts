import "server-only";
import { and, eq, sql as dsql, type AnyColumn } from "drizzle-orm";
import { db, t } from "./db";
import { GameError } from "./engine";

/** Block a player: they can't join your games or crews, and their games stop showing up for you. */
export async function blockPlayer(blockerId: string, blockedId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(blockedId)) throw new GameError("That player doesn't exist.");
  if (blockerId === blockedId) throw new GameError("You can't block yourself.");
  const [u] = await db.select({ id: t.users.id }).from(t.users).where(eq(t.users.id, blockedId));
  if (!u) throw new GameError("That player doesn't exist.");
  await db.insert(t.blocks).values({ blockerId, blockedId }).onConflictDoNothing();
}

export async function unblockPlayer(blockerId: string, blockedId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(blockedId)) return;
  await db.delete(t.blocks).where(and(eq(t.blocks.blockerId, blockerId), eq(t.blocks.blockedId, blockedId)));
}

/** Everyone `viewerId` has blocked. */
export async function blockedBy(viewerId: string | null) {
  if (!viewerId) return new Set<string>();
  const rows = await db.select({ id: t.blocks.blockedId }).from(t.blocks).where(eq(t.blocks.blockerId, viewerId));
  return new Set(rows.map((r) => r.id));
}

/** SQL: `col` isn't someone `viewerId` blocked. */
export const notBlockedBy = (viewerId: string, col: AnyColumn) =>
  dsql`${col} not in (select ${t.blocks.blockedId} from ${t.blocks} where ${t.blocks.blockerId} = ${viewerId})`;
