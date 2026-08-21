/**
 * vizsga.allapot: fuggoben → felfuggesztett; aktív/archiv szabályok.
 * Futtatás: npm run db:migrate-vizsga-felfuggesztett
 */
import { sql } from "drizzle-orm";
import { db, pgClient } from "./index.js";

async function migrate() {
  // Régi enum érték átnevezése (ha még fuggoben)
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TYPE "vizsga_allapot" RENAME VALUE 'fuggoben' TO 'felfuggesztett';
    EXCEPTION
      WHEN undefined_object THEN null;
      WHEN invalid_parameter_value THEN null;
    END $$;
  `);

  // Ha az enum még a régi sorrenddel jött létre másképp: biztosítsuk a felfuggesztett értéket
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TYPE "vizsga_allapot" ADD VALUE IF NOT EXISTS 'felfuggesztett';
    EXCEPTION
      WHEN duplicate_object THEN null;
      WHEN undefined_object THEN null;
    END $$;
  `);

  // Felfüggesztett = aktív (nincs archivált időbélyeg)
  await db.execute(sql`
    UPDATE "vizsga"
    SET "archivalt_at" = NULL
    WHERE "allapot"::text = 'felfuggesztett'
  `);

  // Lezárt = archivált
  await db.execute(sql`
    UPDATE "vizsga"
    SET "archivalt_at" = COALESCE("archivalt_at", NOW())
    WHERE "allapot"::text = 'lezart'
  `);

  console.log("vizsga.allapot: felfuggesztett migráció kész.");
}

try {
  await migrate();
} finally {
  await pgClient.end();
}
