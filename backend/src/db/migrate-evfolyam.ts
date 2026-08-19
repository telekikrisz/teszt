/**
 * Évfolyam tábla (9–13) + meglévő feladatok/tesztek visszamenőleges 13-as évfolyamra állítása.
 * Adatvesztés nélkül futtatható — nem truncate-el.
 * Futtatás: npm run db:migrate-evfolyam
 */
import { sql } from "drizzle-orm";
import { EVFOLYAM_ERETEKEK } from "@oktateszt/shared";
import { db, pgClient } from "./index.js";
import { evfolyam, kerdes, teszt } from "./schema.js";
import { eq, isNull } from "drizzle-orm";

async function ensureSchema() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "evfolyam" (
      "evfolyam_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "evfolyam_ertek" integer NOT NULL,
      CONSTRAINT "chk_evfolyam_ertek" CHECK ("evfolyam_ertek" >= 9 AND "evfolyam_ertek" <= 13)
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "uq_evfolyam_ertek" ON "evfolyam" ("evfolyam_ertek")
  `);

  await db.execute(sql`
    ALTER TABLE "kerdes" ADD COLUMN IF NOT EXISTS "evfolyam_id" uuid
  `);
  await db.execute(sql`
    ALTER TABLE "teszt" ADD COLUMN IF NOT EXISTS "evfolyam_id" uuid
  `);
}

async function seedEvfolyamok() {
  for (const ertek of EVFOLYAM_ERETEKEK) {
    const existing = await db
      .select()
      .from(evfolyam)
      .where(eq(evfolyam.evfolyamErtek, ertek))
      .limit(1);
    if (!existing[0]) {
      await db.insert(evfolyam).values({ evfolyamErtek: ertek });
    }
  }
}

async function backfillEvfolyam13() {
  const [ev13] = await db.select().from(evfolyam).where(eq(evfolyam.evfolyamErtek, 13)).limit(1);
  if (!ev13) throw new Error("A 13. évfolyam rekord nem található.");

  const kerdesFriss = await db
    .update(kerdes)
    .set({ evfolyamId: ev13.evfolyamId })
    .where(isNull(kerdes.evfolyamId))
    .returning({ kerdesId: kerdes.kerdesId });

  const tesztFriss = await db
    .update(teszt)
    .set({ evfolyamId: ev13.evfolyamId })
    .where(isNull(teszt.evfolyamId))
    .returning({ tesztId: teszt.tesztId });

  return { kerdesFriss: kerdesFriss.length, tesztFriss: tesztFriss.length };
}

async function enforceConstraints() {
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "kerdes" ADD CONSTRAINT "kerdes_evfolyam_id_evfolyam_evfolyam_id_fk"
        FOREIGN KEY ("evfolyam_id") REFERENCES "evfolyam"("evfolyam_id") ON DELETE restrict;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `);
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "teszt" ADD CONSTRAINT "teszt_evfolyam_id_evfolyam_evfolyam_id_fk"
        FOREIGN KEY ("evfolyam_id") REFERENCES "evfolyam"("evfolyam_id") ON DELETE restrict;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `);

  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_kerdes_evfolyam" ON "kerdes" ("evfolyam_id")`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_teszt_evfolyam" ON "teszt" ("evfolyam_id")`);

  await db.execute(sql`ALTER TABLE "kerdes" ALTER COLUMN "evfolyam_id" SET NOT NULL`);
  await db.execute(sql`ALTER TABLE "teszt" ALTER COLUMN "evfolyam_id" SET NOT NULL`);
}

export async function migrateEvfolyam() {
  await ensureSchema();
  await seedEvfolyamok();
  const { kerdesFriss, tesztFriss } = await backfillEvfolyam13();
  await enforceConstraints();

  console.log("Évfolyam migráció kész.");
  console.log(`  Évfolyam rekordok: ${EVFOLYAM_ERETEKEK.length} db (9–13)`);
  console.log(`  Feladat frissítve: ${kerdesFriss}`);
  console.log(`  Teszt frissítve: ${tesztFriss}`);
}

try {
  await migrateEvfolyam();
} finally {
  await pgClient.end();
}
