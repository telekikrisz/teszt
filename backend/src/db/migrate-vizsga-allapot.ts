/**
 * vizsga.allapot enum oszlop (kiirt | felfuggesztett | lezart).
 * Futtatás: npm run db:migrate-vizsga-allapot
 */
import { sql } from "drizzle-orm";
import { db, pgClient } from "./index.js";

async function migrateVizsgaAllapot() {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "vizsga_allapot" AS ENUM ('kiirt', 'felfuggesztett', 'lezart');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  await db.execute(sql`
    ALTER TABLE "vizsga" ADD COLUMN IF NOT EXISTS "allapot" "vizsga_allapot" NOT NULL DEFAULT 'kiirt'
  `);

  await db.execute(sql`
    UPDATE "vizsga"
    SET "allapot" = 'lezart'
    WHERE "archivalt_at" IS NOT NULL AND "allapot" = 'kiirt'
  `);

  console.log("vizsga.allapot oszlop kész.");
}

try {
  await migrateVizsgaAllapot();
} finally {
  await pgClient.end();
}
