import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, exists, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { createKerdesSchema, kerdesSzuroSchema, updateKerdesSchema } from "@oktateszt/shared";
import { z } from "zod";
import { db } from "../db/index.js";
import { agazat, kerdes, tantargy, temakor, valasz, evfolyam } from "../db/schema.js";
import { assertEvfolyamId } from "./evfolyamok.js";
import { NotFoundError, ValidationAppError } from "../lib/errors.js";
import { assertAktivTemakor, assertKerdesKorlatok } from "../lib/bank.js";
import { requireStaff } from "../middleware/requireAuth.js";
import type { AppEnv } from "../types.js";

const kerdesKorlatQuerySchema = z.object({
  lockAgazatId: z.string().uuid().optional(),
  lockTantargyId: z.string().uuid().optional(),
  lockTemakorId: z.string().uuid().optional(),
});

function tarhelyFeltetel(aktiv: boolean, archivalt: boolean) {
  const res = [];
  if (aktiv) res.push(isNull(kerdes.archivaltAt));
  if (archivalt) res.push(isNotNull(kerdes.archivaltAt));
  if (res.length === 0) return sql`false`;
  if (res.length === 1) return res[0];
  return or(...res)!;
}

export const kerdesRoutes = new Hono<AppEnv>()
  .use("*", requireStaff)
  .get("/", zValidator("query", kerdesSzuroSchema), async (c) => {
    const filters = c.req.valid("query");
    const conditions = [tarhelyFeltetel(filters.aktiv, filters.archivalt)];
    if (filters.evfolyamId) conditions.push(eq(kerdes.evfolyamId, filters.evfolyamId));
    if (filters.temakorId) conditions.push(eq(kerdes.temakorId, filters.temakorId));
    if (filters.tantargyId) conditions.push(eq(temakor.tantargyId, filters.tantargyId));
    if (filters.agazatId) conditions.push(eq(tantargy.agazatId, filters.agazatId));
    if (filters.q) {
      const minta = `%${filters.q}%`;
      if (filters.valaszokban) {
        conditions.push(
          or(
            ilike(kerdes.szoveg, minta),
            exists(
              db
                .select({ egy: sql`1` })
                .from(valasz)
                .where(and(eq(valasz.kerdesId, kerdes.kerdesId), ilike(valasz.szoveg, minta))),
            ),
          )!,
        );
      } else {
        conditions.push(ilike(kerdes.szoveg, minta));
      }
    }

    const rows = await db
      .select({
        kerdesId: kerdes.kerdesId,
        szoveg: kerdes.szoveg,
        pontszam: kerdes.pontszam,
        temakorId: kerdes.temakorId,
        temakorNev: temakor.temakorNev,
        tantargyId: tantargy.tantargyId,
        tantargyNev: tantargy.tantargyNev,
        agazatId: agazat.agazatId,
        agazatNev: agazat.agazatNev,
        evfolyamId: kerdes.evfolyamId,
        evfolyamErtek: evfolyam.evfolyamErtek,
        archivaltAt: kerdes.archivaltAt,
        joDb: sql<number>`(select count(*)::int from ${valasz} where ${valasz.kerdesId} = ${kerdes.kerdesId} and ${valasz.jo} = true)`,
        valaszDb: sql<number>`(select count(*)::int from ${valasz} where ${valasz.kerdesId} = ${kerdes.kerdesId})`,
      })
      .from(kerdes)
      .innerJoin(temakor, eq(kerdes.temakorId, temakor.temakorId))
      .innerJoin(tantargy, eq(temakor.tantargyId, tantargy.tantargyId))
      .innerJoin(agazat, eq(tantargy.agazatId, agazat.agazatId))
      .innerJoin(evfolyam, eq(kerdes.evfolyamId, evfolyam.evfolyamId))
      .where(and(...conditions))
      .orderBy(desc(kerdes.kerdesId));

    return c.json({
      kerdesek: rows.map((row) => ({
        ...row,
        archivalt: row.archivaltAt !== null,
        tipus: Number(row.joDb) > 1 ? "tobb_jo" : "egyvalasztos",
      })),
    });
  })
  .get("/:id", async (c) => {
    return c.json({ kerdes: await loadKerdes(c.req.param("id"), true) });
  })
  .post("/", zValidator("json", createKerdesSchema), async (c) => {
    const input = c.req.valid("json");
    await assertEvfolyamId(input.evfolyamId);
    await assertAktivTemakor(input.temakorId);
    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(kerdes)
        .values({
          evfolyamId: input.evfolyamId,
          temakorId: input.temakorId,
          szoveg: input.szoveg,
          pontszam: input.pontszam,
        })
        .returning();
      if (!row) throw new ValidationAppError("A kérdés mentése sikertelen.");
      await tx.insert(valasz).values(
        input.valaszok.map((v) => ({
          kerdesId: row.kerdesId,
          szoveg: v.szoveg,
          jo: v.jo,
        })),
      );
      return row;
    });
    return c.json({ kerdes: await loadKerdes(created.kerdesId) }, 201);
  })
  .patch("/:id", zValidator("query", kerdesKorlatQuerySchema), zValidator("json", updateKerdesSchema), async (c) => {
    const id = c.req.param("id");
    const input = c.req.valid("json");
    const korlatok = c.req.valid("query");
    await assertEvfolyamId(input.evfolyamId);
    await assertAktivTemakor(input.temakorId);
    await assertKerdesKorlatok(input.temakorId, korlatok);
    const existing = await db
      .select({ kerdesId: kerdes.kerdesId, archivaltAt: kerdes.archivaltAt })
      .from(kerdes)
      .where(eq(kerdes.kerdesId, id))
      .limit(1);
    if (!existing[0] || existing[0].archivaltAt) throw new NotFoundError("A kérdés nem található.");

    await db.transaction(async (tx) => {
      await tx
        .update(kerdes)
        .set({
          evfolyamId: input.evfolyamId,
          temakorId: input.temakorId,
          szoveg: input.szoveg,
          pontszam: input.pontszam,
        })
        .where(eq(kerdes.kerdesId, id));
      await tx.delete(valasz).where(eq(valasz.kerdesId, id));
      await tx.insert(valasz).values(
        input.valaszok.map((v) => ({
          kerdesId: id,
          szoveg: v.szoveg,
          jo: v.jo,
        })),
      );
    });
    return c.json({ kerdes: await loadKerdes(id) });
  })
  .post("/:id/aktivalas", async (c) => {
    const id = c.req.param("id");
    const [restored] = await db
      .update(kerdes)
      .set({ archivaltAt: null })
      .where(and(eq(kerdes.kerdesId, id), isNotNull(kerdes.archivaltAt)))
      .returning();
    if (!restored) throw new NotFoundError("Archivált kérdés nem található.");
    return c.json({ kerdes: await loadKerdes(id) });
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    const [archived] = await db
      .update(kerdes)
      .set({ archivaltAt: new Date() })
      .where(eq(kerdes.kerdesId, id))
      .returning();
    if (!archived) throw new NotFoundError("A kérdés nem található.");
    return c.json({ ok: true });
  });

async function loadKerdes(id: string, allowArchived = false) {
  const [row] = await db
    .select({
      kerdesId: kerdes.kerdesId,
      szoveg: kerdes.szoveg,
      pontszam: kerdes.pontszam,
      temakorId: kerdes.temakorId,
      temakorNev: temakor.temakorNev,
      tantargyId: tantargy.tantargyId,
      tantargyNev: tantargy.tantargyNev,
      agazatId: agazat.agazatId,
      agazatNev: agazat.agazatNev,
      evfolyamId: kerdes.evfolyamId,
      evfolyamErtek: evfolyam.evfolyamErtek,
      archivaltAt: kerdes.archivaltAt,
    })
    .from(kerdes)
    .innerJoin(temakor, eq(kerdes.temakorId, temakor.temakorId))
    .innerJoin(tantargy, eq(temakor.tantargyId, tantargy.tantargyId))
    .innerJoin(agazat, eq(tantargy.agazatId, agazat.agazatId))
    .innerJoin(evfolyam, eq(kerdes.evfolyamId, evfolyam.evfolyamId))
    .where(eq(kerdes.kerdesId, id))
    .limit(1);

  if (!row) throw new NotFoundError("A kérdés nem található.");
  if (!allowArchived && row.archivaltAt) throw new NotFoundError("A kérdés nem található.");

  const valaszok = await db
    .select({
      valaszId: valasz.valaszId,
      szoveg: valasz.szoveg,
      jo: valasz.jo,
    })
    .from(valasz)
    .where(eq(valasz.kerdesId, id));

  const joDb = valaszok.filter((v) => v.jo).length;
  return {
    ...row,
    archivalt: row.archivaltAt !== null,
    tipus: joDb > 1 ? "tobb_jo" : "egyvalasztos",
    valaszok,
  };
}
