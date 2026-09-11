/**
 * vizsga.jegy_adando — opcionális jegy a vizsgaeredményre.
 * Futtatás: npm run db:migrate-vizsga-jegy -w backend
 */
import { sql } from "drizzle-orm";
import { db, pgClient } from "./index.js";

async function migrate() {
  await db.execute(sql`
    ALTER TABLE "vizsga" ADD COLUMN IF NOT EXISTS "jegy_adando" boolean NOT NULL DEFAULT false
  `);
  console.log("vizsga.jegy_adando oszlop kész.");
}

try {
  await migrate();
} finally {
  await pgClient.end();
}
