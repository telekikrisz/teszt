/**
 * XP katalógus (xp_esemeny) + kiosztás (xp_kap). A régi xp_tetel sorait áttölti.
 * Futtatás: npm run db:migrate-xp-esemeny  (backend mappából)
 */
import { sql } from "drizzle-orm";
import { db, pgClient } from "./index.js";

async function migrateXpEsemeny() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "xp_esemeny" (
      "xp_esemeny_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "esemeny_kod" text NOT NULL,
      "cimke" text NOT NULL,
      "pont" integer NOT NULL,
      "csoport" text NOT NULL,
      CONSTRAINT "uq_xp_esemeny_kod" UNIQUE ("esemeny_kod"),
      CONSTRAINT "chk_xp_esemeny_pont" CHECK ("pont" <> 0),
      CONSTRAINT "chk_xp_esemeny_csoport" CHECK ("csoport" IN ('pozitiv', 'negativ'))
    )
  `);

  await db.execute(sql`
    INSERT INTO "xp_esemeny" ("esemeny_kod", "cimke", "pont", "csoport") VALUES
      ('github_feladat', 'Sikeresen megoldott, GitHubra feltöltött feladat', 10, 'pozitiv'),
      ('orai_reszvetel', 'Aktív tanórai részvétel', 10, 'pozitiv'),
      ('mentor_senior', 'Sikeres Senior mentorálás', 10, 'pozitiv'),
      ('mentor_junior', 'Juniorként mentorált feladat', 5, 'pozitiv'),
      ('elegans_kod', 'Kiemelkedően elegáns kód / plusz funkciók', 10, 'pozitiv'),
      ('zavaras', 'Tanórai zavaró tevékenység', -10, 'negativ'),
      ('nincs_mentes', 'Üres GitHub / nincs mentés', -30, 'negativ'),
      ('munkamegtagadas', 'Munkamegtagadás', -50, 'negativ'),
      ('szereptevesztes', 'Tanórai szereptévesztés', -5, 'negativ')
    ON CONFLICT ("esemeny_kod") DO UPDATE SET
      "cimke" = EXCLUDED."cimke",
      "pont" = EXCLUDED."pont",
      "csoport" = EXCLUDED."csoport"
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "xp_kap" (
      "xp_kap_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tanulo_id" uuid NOT NULL REFERENCES "felhasznalo"("felhasznalo_id") ON DELETE RESTRICT,
      "rogzito_id" uuid NOT NULL REFERENCES "felhasznalo"("felhasznalo_id") ON DELETE RESTRICT,
      "xp_esemeny_id" uuid NOT NULL REFERENCES "xp_esemeny"("xp_esemeny_id") ON DELETE RESTRICT,
      "tantargy_id" uuid NOT NULL REFERENCES "tantargy"("tantargy_id") ON DELETE RESTRICT,
      "pont" integer NOT NULL,
      "letrehozva_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "chk_xp_kap_pont" CHECK ("pont" <> 0)
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "idx_xp_kap_tanulo" ON "xp_kap" ("tanulo_id")
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "idx_xp_kap_tanulo_tantargy" ON "xp_kap" ("tanulo_id", "tantargy_id")
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "idx_xp_kap_rogzito" ON "xp_kap" ("rogzito_id")
  `);

  await db.execute(sql`
    DO $migr$
    BEGIN
      IF to_regclass('public.xp_tetel') IS NOT NULL THEN
        INSERT INTO "xp_kap" (
          "xp_kap_id", "tanulo_id", "rogzito_id", "xp_esemeny_id",
          "tantargy_id", "pont", "letrehozva_at"
        )
        SELECT
          t."xp_tetel_id",
          t."tanulo_id",
          t."rogzito_id",
          e."xp_esemeny_id",
          t."tantargy_id",
          t."pont",
          t."letrehozva_at"
        FROM "xp_tetel" t
        JOIN "xp_esemeny" e ON e."esemeny_kod" = t."esemeny_kod"
        WHERE t."tantargy_id" IS NOT NULL
        ON CONFLICT ("xp_kap_id") DO NOTHING;

        DROP TABLE "xp_tetel";
      END IF;
    END
    $migr$;
  `);

  console.log("xp_esemeny és xp_kap kész, xp_tetel áttöltve.");
}

try {
  await migrateXpEsemeny();
} finally {
  await pgClient.end();
}
