import "dotenv/config";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, sql } from "../src/server/db";

await migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migrations applied");
await sql.end();
