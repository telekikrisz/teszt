/**
 * Kérdéshez csatolható kép (kerdes + vizsga_kerdes).
 * Futtatás: npm run db:migrate-kerdes-kep  (backend mappából)
 */
import { sql } from "drizzle-orm";
import { db, pgClient } from "./index.js";

async function migrateKerdesKep() {
  await db.execute(sql`
    ALTER TABLE "kerdes" ADD COLUMN IF NOT EXISTS "kep_fajl" text
  `);
  await db.execute(sql`
    ALTER TABLE "vizsga_kerdes" ADD COLUMN IF NOT EXISTS "kep_fajl" text
  `);
  console.log("kerdes.kep_fajl és vizsga_kerdes.kep_fajl oszlopok kész.");
}

try {
  await migrateKerdesKep();
} finally {
  await pgClient.end();
}
