/**
 * jelszo_valtast_ker oszlop hozzáadása (első belépéskor jelszócsere).
 * Futtatás: npm run db:migrate-jelszo-valtast
 */
import { sql } from "drizzle-orm";
import { db, pgClient } from "./index.js";

async function migrateJelszoValtastKer() {
  await db.execute(sql`
    ALTER TABLE "felhasznalo" ADD COLUMN IF NOT EXISTS "jelszo_valtast_ker" boolean NOT NULL DEFAULT false
  `);
  console.log("jelszo_valtast_ker oszlop kész.");
}

try {
  await migrateJelszoValtastKer();
} finally {
  await pgClient.end();
}
