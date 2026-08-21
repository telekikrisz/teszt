/**
 * vizsgazik.hosszabbitas_perc oszlop (extra kitöltési idő tanulónként).
 * Futtatás: npm run db:migrate-vizsgazik-hosszabbitas
 */
import { sql } from "drizzle-orm";
import { db, pgClient } from "./index.js";

async function migrate() {
  await db.execute(sql`
    ALTER TABLE "vizsgazik" ADD COLUMN IF NOT EXISTS "hosszabbitas_perc" integer NOT NULL DEFAULT 0
  `);
  console.log("vizsgazik.hosszabbitas_perc oszlop kész.");
}

try {
  await migrate();
} finally {
  await pgClient.end();
}
