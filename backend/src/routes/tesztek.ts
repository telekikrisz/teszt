import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { createTesztSchema, bulkTesztTorlesSchema, tesztSzuroSchema, updateTesztSchema } from "@oktateszt/shared";
import { db } from "../db/index.js";
import {
  agazat,
  evfolyam,
  kerdes,
  tantargy,
  temakor,
  teszt,
  tesztkerdes,
  valasz,
  vizsga,
} from "../db/schema.js";
import { assertAktivTantargy, assertAktivTemakor } from "../lib/bank.js";
import { AppError, NotFoundError, ValidationAppError } from "../lib/errors.js";
import { requireStaff } from "../middleware/requireAuth.js";
import { assertEvfolyamId } from "./evfolyamok.js";
import type { AppEnv } from "../types.js";

function tarhelyFeltetel(aktiv: boolean, archivalt: boolean) {
  const res = [];
  if (aktiv) res.push(isNull(teszt.archivaltAt));
  if (archivalt) res.push(isNotNull(teszt.archivaltAt));
  if (res.length === 0) return sql`false`;
  if (res.length === 1) return res[0];
  return or(...res)!;
}

function allapotFeltetel(piszkozat: boolean, jovahagyott: boolean) {
  const res = [];
  if (piszkozat) res.push(eq(teszt.allapot, "piszkozat"));
  if (jovahagyott) res.push(eq(teszt.allapot, "kesz"));
  if (res.length === 0) return sql`false`;
  if (res.length === 1) return res[0];
  return or(...res)!;
}

export const tesztRoutes = new Hono<AppEnv>()
  .use("*", requireStaff)
  .get("/", zValidator("query", tesztSzuroSchema), async (c) => {
    const filters = c.req.valid("query");
    const conditions = [
      tarhelyFeltetel(filters.aktiv, filters.archivalt),
      allapotFeltetel(filters.piszkozat, filters.jovahagyott),
    ];
    if (filters.evfolyamId) conditions.push(eq(teszt.evfolyamId, filters.evfolyamId));
    if (filters.tantargyId) conditions.push(eq(teszt.tantargyId, filters.tantargyId));
    if (filters.temakorId) conditions.push(eq(teszt.temakorId, filters.temakorId));
    if (filters.agazatId) conditions.push(eq(tantargy.agazatId, filters.agazatId));

    const rows = await db
      .select({
        tesztId: teszt.tesztId,
        cim: teszt.cim,
        allapot: teszt.allapot,
        archivaltAt: teszt.archivaltAt,
        javasoltPerc: teszt.javasoltPerc,
        tantargyId: teszt.tantargyId,
        tantargyNev: tantargy.tantargyNev,
        agazatId: agazat.agazatId,
        agazatNev: agazat.agazatNev,
        temakorId: teszt.temakorId,
        temakorNev: temakor.temakorNev,
        evfolyamId: teszt.evfolyamId,
        evfolyamErtek: evfolyam.evfolyamErtek,
        kerdesDb: sql<number>`(
          select count(*)::int from ${tesztkerdes}
          where ${tesztkerdes.tesztId} = ${teszt.tesztId}
        )`,
        osszPont: sql<number>`(
          select coalesce(sum(${kerdes.pontszam}), 0)::int
          from ${tesztkerdes}
          inner join ${kerdes} on ${kerdes.kerdesId} = ${tesztkerdes.kerdesId}
          where ${tesztkerdes.tesztId} = ${teszt.tesztId}
            and ${kerdes.archivaltAt} is null
        )`,
      })
      .from(teszt)
      .innerJoin(tantargy, eq(teszt.tantargyId, tantargy.tantargyId))
      .innerJoin(agazat, eq(tantargy.agazatId, agazat.agazatId))
      .innerJoin(evfolyam, eq(teszt.evfolyamId, evfolyam.evfolyamId))
      .leftJoin(temakor, eq(teszt.temakorId, temakor.temakorId))
      .where(and(...conditions))
      .orderBy(desc(teszt.tesztId));

    return c.json({
      tesztek: rows.map((row) => ({
        ...row,
        temakorNev: row.temakorNev ?? null,
        archivalt: row.archivaltAt !== null,
      })),
    });
  })
  .get("/:id", async (c) => {
    return c.json({ teszt: await loadTeszt(c.req.param("id"), true) });
  })
  .post("/", zValidator("json", createTesztSchema), async (c) => {
    const input = c.req.valid("json");
    await assertEvfolyamId(input.evfolyamId);
    await assertKerdesIdk(input.evfolyamId, input.tantargyId, input.temakorId ?? null, input.kerdesIdk);

    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(teszt)
        .values({
          cim: input.cim,
          evfolyamId: input.evfolyamId,
          tantargyId: input.tantargyId,
          temakorId: input.temakorId ?? null,
          javasoltPerc: input.javasoltPerc ?? null,
          allapot: input.allapot ?? "piszkozat",
        })
        .returning();
      if (!row) throw new ValidationAppError("A teszt mentése sikertelen.");

      await tx.insert(tesztkerdes).values(
        input.kerdesIdk.map((kerdesId) => ({
          tesztId: row.tesztId,
          kerdesId,
        })),
      );
      return row;
    });

    return c.json({ teszt: await loadTeszt(created.tesztId, true) }, 201);
  })
  .patch("/:id", zValidator("json", updateTesztSchema), async (c) => {
    const id = c.req.param("id");
    const input = c.req.valid("json");
    const existing = await loadTesztMeta(id, true);
    if (existing.archivaltAt) {
      throw new ValidationAppError("Archivált teszt nem szerkeszthető — előbb aktiváld.");
    }

    const tantargyId = existing.tantargyId;
    const evfolyamId = input.evfolyamId ?? existing.evfolyamId;
    const temakorId =
      input.kerdesIdk !== undefined
        ? existing.temakorId
        : (existing.temakorId ?? null);

    if (input.evfolyamId) await assertEvfolyamId(input.evfolyamId);

    if (input.kerdesIdk) {
      await assertKerdesIdk(evfolyamId, tantargyId, temakorId, input.kerdesIdk);
    }

    await db.transaction(async (tx) => {
      const patch: Partial<typeof teszt.$inferInsert> = {};
      if (input.cim !== undefined) patch.cim = input.cim;
      if (input.evfolyamId !== undefined) patch.evfolyamId = input.evfolyamId;
      if (input.javasoltPerc !== undefined) patch.javasoltPerc = input.javasoltPerc;
      if (input.allapot !== undefined) patch.allapot = input.allapot;
      if (Object.keys(patch).length > 0) {
        await tx.update(teszt).set(patch).where(eq(teszt.tesztId, id));
      }
      if (input.kerdesIdk) {
        await tx.delete(tesztkerdes).where(eq(tesztkerdes.tesztId, id));
        await tx.insert(tesztkerdes).values(
          input.kerdesIdk.map((kerdesId) => ({
            tesztId: id,
            kerdesId,
          })),
        );
      }
    });

    return c.json({ teszt: await loadTeszt(id, true) });
  })
  .post("/:id/aktivalas", async (c) => {
    const id = c.req.param("id");
    const [restored] = await db
      .update(teszt)
      .set({ archivaltAt: null })
      .where(and(eq(teszt.tesztId, id), isNotNull(teszt.archivaltAt)))
      .returning();
    if (!restored) throw new NotFoundError("Archivált teszt nem található.");
    return c.json({ teszt: await loadTeszt(id, true) });
  })
  .post("/torles", zValidator("json", bulkTesztTorlesSchema), async (c) => {
    const { ids } = c.req.valid("json");
    const uniqueIds = [...new Set(ids)];

    const archived = await db
      .select({ id: teszt.tesztId })
      .from(teszt)
      .where(and(inArray(teszt.tesztId, uniqueIds), isNotNull(teszt.archivaltAt)));

    const torolhetoIds = archived.map((r) => r.id);
    if (torolhetoIds.length === 0) {
      throw new AppError(400, "Csak archivált teszt törölhető.", "NOT_ARCHIVED");
    }

    const linked = await db
      .select({ id: vizsga.tesztId })
      .from(vizsga)
      .where(inArray(vizsga.tesztId, torolhetoIds));
    const blocked = new Set(linked.map((r) => r.id));
    const freeIds = torolhetoIds.filter((id) => !blocked.has(id));

    if (freeIds.length === 0) {
      throw new AppError(
        409,
        "A kijelölt tesztek nem törölhetők, mert van belőlük kiírt vizsga.",
        "HAS_RELATED_VIZSGA",
      );
    }

    await db.transaction(async (tx) => {
      await tx.delete(tesztkerdes).where(inArray(tesztkerdes.tesztId, freeIds));
      await tx.delete(teszt).where(inArray(teszt.tesztId, freeIds));
    });

    return c.json({
      ok: true,
      torolt: freeIds.length,
      kihagyott: uniqueIds.length - freeIds.length,
      vizsgaMiatt: blocked.size,
    });
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    const [archived] = await db
      .update(teszt)
      .set({ archivaltAt: new Date() })
      .where(and(eq(teszt.tesztId, id), isNull(teszt.archivaltAt)))
      .returning();
    if (!archived) throw new NotFoundError("A teszt nem található vagy már archivált.");
    return c.json({ ok: true });
  });

async function loadTesztMeta(id: string, allowArchived = false) {
  const [row] = await db
    .select({
      tesztId: teszt.tesztId,
      cim: teszt.cim,
      allapot: teszt.allapot,
      javasoltPerc: teszt.javasoltPerc,
      evfolyamId: teszt.evfolyamId,
      tantargyId: teszt.tantargyId,
      temakorId: teszt.temakorId,
      archivaltAt: teszt.archivaltAt,
    })
    .from(teszt)
    .where(eq(teszt.tesztId, id))
    .limit(1);
  if (!row) throw new NotFoundError("A teszt nem található.");
  if (!allowArchived && row.archivaltAt) throw new NotFoundError("A teszt nem található.");
  return row;
}

async function loadTeszt(id: string, allowArchived = false) {
  const meta = await loadTesztMeta(id, allowArchived);

  const [hely] = await db
    .select({
      tantargyNev: tantargy.tantargyNev,
      agazatId: agazat.agazatId,
      agazatNev: agazat.agazatNev,
      temakorNev: temakor.temakorNev,
      evfolyamErtek: evfolyam.evfolyamErtek,
    })
    .from(teszt)
    .innerJoin(tantargy, eq(teszt.tantargyId, tantargy.tantargyId))
    .innerJoin(agazat, eq(tantargy.agazatId, agazat.agazatId))
    .innerJoin(evfolyam, eq(teszt.evfolyamId, evfolyam.evfolyamId))
    .leftJoin(temakor, eq(teszt.temakorId, temakor.temakorId))
    .where(eq(teszt.tesztId, id))
    .limit(1);

  const links = await db
    .select({
      tesztkerdesId: tesztkerdes.tesztkerdesId,
      kerdesId: tesztkerdes.kerdesId,
    })
    .from(tesztkerdes)
    .where(eq(tesztkerdes.tesztId, id))
    .orderBy(tesztkerdes.tesztkerdesId);

  const kerdesIds = links.map((l) => l.kerdesId);
  const kerdesek =
    kerdesIds.length === 0
      ? []
      : await db
          .select({
            kerdesId: kerdes.kerdesId,
            szoveg: kerdes.szoveg,
            pontszam: kerdes.pontszam,
            temakorId: kerdes.temakorId,
            tantargyId: tantargy.tantargyId,
            agazatId: agazat.agazatId,
            evfolyamId: kerdes.evfolyamId,
            evfolyamErtek: evfolyam.evfolyamErtek,
            temakorNev: temakor.temakorNev,
            tantargyNev: tantargy.tantargyNev,
            agazatNev: agazat.agazatNev,
            joDb: sql<number>`(
              select count(*)::int from ${valasz}
              where ${valasz.kerdesId} = ${kerdes.kerdesId} and ${valasz.jo} = true
            )`,
          })
          .from(kerdes)
          .innerJoin(temakor, eq(kerdes.temakorId, temakor.temakorId))
          .innerJoin(tantargy, eq(temakor.tantargyId, tantargy.tantargyId))
          .innerJoin(agazat, eq(tantargy.agazatId, agazat.agazatId))
          .innerJoin(evfolyam, eq(kerdes.evfolyamId, evfolyam.evfolyamId))
          .where(and(inArray(kerdes.kerdesId, kerdesIds), isNull(kerdes.archivaltAt)));

  const kerdesMap = new Map(kerdesek.map((k) => [k.kerdesId, k]));

  return {
    ...meta,
    archivalt: meta.archivaltAt !== null,
    agazatId: hely?.agazatId ?? "",
    agazatNev: hely?.agazatNev ?? "",
    tantargyNev: hely?.tantargyNev ?? "",
    temakorNev: hely?.temakorNev ?? null,
    evfolyamErtek: hely?.evfolyamErtek ?? 0,
    kerdesek: kerdesIds
      .map((kerdesId) => {
        const k = kerdesMap.get(kerdesId);
        if (!k) return null;
        return {
          ...k,
          tipus: Number(k.joDb) > 1 ? ("tobb_jo" as const) : ("egyvalasztos" as const),
        };
      })
      .filter((k): k is NonNullable<typeof k> => Boolean(k)),
    osszPont: kerdesek.reduce((sum, k) => sum + k.pontszam, 0),
  };
}

async function assertKerdesIdk(
  evfolyamId: string,
  tantargyId: string,
  temakorId: string | null,
  kerdesIdk: string[],
) {
  await assertAktivTantargy(tantargyId);
  if (temakorId) await assertAktivTemakor(temakorId);

  const unique = [...new Set(kerdesIdk)];
  if (unique.length !== kerdesIdk.length) {
    throw new ValidationAppError("Ugyanaz a feladat csak egyszer szerepelhet a tesztben.");
  }

  const rows = await db
    .select({
      kerdesId: kerdes.kerdesId,
      temakorId: kerdes.temakorId,
      tantargyId: temakor.tantargyId,
      evfolyamId: kerdes.evfolyamId,
      archivaltAt: kerdes.archivaltAt,
    })
    .from(kerdes)
    .innerJoin(temakor, eq(kerdes.temakorId, temakor.temakorId))
    .where(inArray(kerdes.kerdesId, kerdesIdk));

  if (rows.length !== kerdesIdk.length) {
    throw new ValidationAppError("Egy vagy több kiválasztott feladat nem található.");
  }

  for (const row of rows) {
    if (row.archivaltAt) throw new ValidationAppError("Archivált feladat nem adható a teszthez.");
    if (row.evfolyamId !== evfolyamId) {
      throw new ValidationAppError("Minden feladat a teszt évfolyamához tartozzon.");
    }
    if (row.tantargyId !== tantargyId) {
      throw new ValidationAppError("Minden feladat a teszt tantárgyához tartozzon.");
    }
    if (temakorId && row.temakorId !== temakorId) {
      throw new ValidationAppError("Témakörös tesztnél minden feladat ugyanabból a témakörből legyen.");
    }
  }
}
