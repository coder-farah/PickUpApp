import "dotenv/config";
import { runTick } from "../src/server/scheduler";
import { sql } from "../src/server/db";

const report = await runTick(new Date());
console.log(report);
await sql.end();
