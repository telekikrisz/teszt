/**
 * XP tételek és beváltott jegyek táblái.
 * Futtatás: npm run db:migrate-xp  (backend mappából)
 */
import { sql } from "drizzle-orm";
import { db, pgClient } from "./index.js";

async function migrateXp() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "xp_tetel" (
      "xp_tetel_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tanulo_id" uuid NOT NULL REFERENCES "felhasznalo"("felhasznalo_id") ON DELETE RESTRICT,
      "rogzito_id" uuid NOT NULL REFERENCES "felhasznalo"("felhasznalo_id") ON DELETE RESTRICT,
      "esemeny_kod" text NOT NULL,
      "cimke" text NOT NULL,
      "pont" integer NOT NULL,
      "letrehozva_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "chk_xp_tetel_pont" CHECK ("pont" <> 0)
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "idx_xp_tetel_tanulo" ON "xp_tetel" ("tanulo_id")
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "xp_jegy" (
      "xp_jegy_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tanulo_id" uuid NOT NULL REFERENCES "felhasznalo"("felhasznalo_id") ON DELETE RESTRICT,
      "ertek" integer NOT NULL,
      "letrehozva_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "chk_xp_jegy_ertek" CHECK ("ertek" IN (1, 5))
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "idx_xp_jegy_tanulo" ON "xp_jegy" ("tanulo_id")
  `);

  console.log("xp_tetel és xp_jegy táblák kész.");
}

try {
  await migrateXp();
} finally {
  await pgClient.end();
}
