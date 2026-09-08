/**
 * XP tételek és jegyek tantárgyanként.
 * Futtatás: npm run db:migrate-xp-tantargy  (backend mappából)
 */
import { sql } from "drizzle-orm";
import { db, pgClient } from "./index.js";

async function migrateXpTantargy() {
  await db.execute(sql`
    ALTER TABLE "xp_tetel"
      ADD COLUMN IF NOT EXISTS "tantargy_id" uuid REFERENCES "tantargy"("tantargy_id") ON DELETE RESTRICT
  `);
  await db.execute(sql`
    ALTER TABLE "xp_jegy"
      ADD COLUMN IF NOT EXISTS "tantargy_id" uuid REFERENCES "tantargy"("tantargy_id") ON DELETE RESTRICT
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "idx_xp_tetel_tanulo_tantargy"
      ON "xp_tetel" ("tanulo_id", "tantargy_id")
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "idx_xp_jegy_tanulo_tantargy"
      ON "xp_jegy" ("tanulo_id", "tantargy_id")
  `);
  console.log("xp_tetel.tantargy_id és xp_jegy.tantargy_id oszlopok kész.");
}

try {
  await migrateXpTantargy();
} finally {
  await pgClient.end();
}
