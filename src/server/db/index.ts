import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

// Reuse one pool across hot reloads in development.
const globalForDb = globalThis as unknown as { __pg?: ReturnType<typeof postgres> };
const client = globalForDb.__pg ?? postgres(url, { max: 10 });
if (process.env.NODE_ENV !== "production") globalForDb.__pg = client;

export const db = drizzle(client, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;
export { client as sql };
export * as t from "./schema";
