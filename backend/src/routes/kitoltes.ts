import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/index.js";
import {
  kitoltes,
  kitoltesValasz,
  teszt,
  vizsga,
  vizsgaKerdes,
  vizsgaValasz,
} from "../db/schema.js";
import { ForbiddenError, NotFoundError, ValidationAppError } from "../lib/errors.js";
import {
  ensureKitoltesIdo,
  ertekelEsLezarKitoltes,
  hatralevoMp,
  kitoltesVegeAt,
} from "../services/kitoltesFlow.js";
import { getUser, requireTanulo } from "../middleware/requireAuth.js";
import type { AppEnv } from "../types.js";

const valaszValasztasSchema = z.object({
  vizsgaKerdesId: z.string().uuid(),
  vizsgaValaszId: z.string().uuid(),
  kijelolt: z.boolean(),
});

async function loadOsszPont(kitoltesId: string): Promise<number> {
  const [row] = await db
    .select({
      osszPont: sql<number>`coalesce(sum(${kitoltesValasz.kapottPont}), 0)::int`,
    })
    .from(kitoltesValasz)
    .where(eq(kitoltesValasz.kitoltesId, kitoltesId));
  return Number(row?.osszPont ?? 0);
}

async function loadMaxPont(vizsgaId: string): Promise<number> {
  const [row] = await db
    .select({
      maxPont: sql<number>`coalesce(sum(${vizsgaKerdes.pontszam}), 0)::int`,
    })
    .from(vizsgaKerdes)
    .where(eq(vizsgaKerdes.vizsgaId, vizsgaId));
  return Number(row?.maxPont ?? 0);
}

async function loadKitoltesPayload(kitoltesId: string, tanuloId: string) {
  await ensureKitoltesIdo(kitoltesId);

  const row = await db
    .select({
      kitoltesId: kitoltes.kitoltesId,
      allapot: kitoltes.allapot,
      kerdesSorrend: kitoltes.kerdesSorrend,
      valaszSorrendek: kitoltes.valaszSorrendek,
      vizsgaId: kitoltes.vizsgaId,
      elkezdveAt: kitoltes.elkezdveAt,
      hosszabbitasPerc: kitoltes.hosszabbitasPerc,
      perc: vizsga.perc,
      vizsgaAllapot: vizsga.allapot,
      tesztCim: teszt.cim,
    })
    .from(kitoltes)
    .innerJoin(vizsga, eq(vizsga.vizsgaId, kitoltes.vizsgaId))
    .innerJoin(teszt, eq(teszt.tesztId, vizsga.tesztId))
    .where(eq(kitoltes.kitoltesId, kitoltesId))
    .limit(1);

  const fejlec = row[0];
  if (!fejlec) throw new NotFoundError("A kitöltés nem található.");

  const owner = await db
    .select({ tanuloId: kitoltes.tanuloId })
    .from(kitoltes)
    .where(eq(kitoltes.kitoltesId, kitoltesId))
    .limit(1);
  if (owner[0]?.tanuloId !== tanuloId) throw new ForbiddenError();

  const maxPont = await loadMaxPont(fejlec.vizsgaId);
  const osszPont =
    fejlec.allapot === "folyamatban" ? null : await loadOsszPont(kitoltesId);
  const szazalek =
    osszPont !== null && maxPont > 0 ? Math.round((osszPont / maxPont) * 100) : null;

  const visszanezheto = fejlec.vizsgaAllapot === "lezart";
  const kesz = fejlec.allapot === "bekuldve" || fejlec.allapot === "lejart";
  const nezettMod: "kitoltes" | "eredmeny" | "attekintes" = !kesz
    ? "kitoltes"
    : visszanezheto
      ? "attekintes"
      : "eredmeny";

  if (nezettMod === "eredmeny") {
    return {
      kitoltesId: fejlec.kitoltesId,
      allapot: fejlec.allapot,
      vizsgaCim: fejlec.tesztCim,
      vizsgaAllapot: fejlec.vizsgaAllapot,
      nezettMod,
      visszanezheto: false,
      perc: fejlec.perc,
      hosszabbitasPerc: fejlec.hosszabbitasPerc,
      vegeAt: null,
      hatralevoMp: 0,
      osszPont,
      maxPont,
      szazalek,
      kerdesek: [],
    };
  }

  const kerdesRows = await db
    .select({
      vizsgaKerdesId: vizsgaKerdes.vizsgaKerdesId,
      szoveg: vizsgaKerdes.szoveg,
      pontszam: vizsgaKerdes.pontszam,
      kepFajl: vizsgaKerdes.kepFajl,
    })
    .from(vizsgaKerdes)
    .where(eq(vizsgaKerdes.vizsgaId, fejlec.vizsgaId));

  const kerdesMap = new Map(kerdesRows.map((k) => [k.vizsgaKerdesId, k]));
  const kerdesek = fejlec.kerdesSorrend
    .map((id) => kerdesMap.get(id))
    .filter((k): k is NonNullable<typeof k> => Boolean(k));

  const kerdesIds = kerdesek.map((k) => k.vizsgaKerdesId);
  const valaszRows =
    kerdesIds.length === 0
      ? []
      : await db
          .select({
            vizsgaValaszId: vizsgaValasz.vizsgaValaszId,
            vizsgaKerdesId: vizsgaValasz.vizsgaKerdesId,
            szoveg: vizsgaValasz.szoveg,
            jo: vizsgaValasz.jo,
          })
          .from(vizsgaValasz)
          .where(inArray(vizsgaValasz.vizsgaKerdesId, kerdesIds));

  const joDbByKerdes = new Map<string, number>();
  const valaszokByKerdes = new Map<string, typeof valaszRows>();
  for (const v of valaszRows) {
    const list = valaszokByKerdes.get(v.vizsgaKerdesId) ?? [];
    list.push(v);
    valaszokByKerdes.set(v.vizsgaKerdesId, list);
    if (v.jo) {
      joDbByKerdes.set(v.vizsgaKerdesId, (joDbByKerdes.get(v.vizsgaKerdesId) ?? 0) + 1);
    }
  }

  const kijeloltRows = await db
    .select({
      vizsgaKerdesId: kitoltesValasz.vizsgaKerdesId,
      vizsgaValaszId: kitoltesValasz.vizsgaValaszId,
      helyes: kitoltesValasz.helyes,
      kapottPont: kitoltesValasz.kapottPont,
    })
    .from(kitoltesValasz)
    .where(eq(kitoltesValasz.kitoltesId, kitoltesId));

  const kijeloltByKerdes = new Map<string, string[]>();
  const helyesByValasz = new Map<string, boolean>();
  const pontByKerdes = new Map<string, number>();
  for (const k of kijeloltRows) {
    const list = kijeloltByKerdes.get(k.vizsgaKerdesId) ?? [];
    list.push(k.vizsgaValaszId);
    kijeloltByKerdes.set(k.vizsgaKerdesId, list);
    helyesByValasz.set(k.vizsgaValaszId, k.helyes);
    pontByKerdes.set(k.vizsgaKerdesId, (pontByKerdes.get(k.vizsgaKerdesId) ?? 0) + k.kapottPont);
  }

  const folyamatban = fejlec.allapot === "folyamatban";
  const vegeAt =
    folyamatban && fejlec.elkezdveAt
      ? kitoltesVegeAt(fejlec.elkezdveAt, fejlec.perc, fejlec.hosszabbitasPerc)
      : null;

  return {
    kitoltesId: fejlec.kitoltesId,
    allapot: fejlec.allapot,
    vizsgaCim: fejlec.tesztCim,
    vizsgaAllapot: fejlec.vizsgaAllapot,
    nezettMod,
    visszanezheto,
    perc: fejlec.perc,
    hosszabbitasPerc: fejlec.hosszabbitasPerc,
    vegeAt: vegeAt?.toISOString() ?? null,
    hatralevoMp: folyamatban
      ? hatralevoMp(fejlec.elkezdveAt, fejlec.perc, fejlec.hosszabbitasPerc)
      : 0,
    osszPont,
    maxPont,
    szazalek,
    kerdesek: kerdesek.map((k, index) => {
      const sorrend = fejlec.valaszSorrendek[k.vizsgaKerdesId] ?? [];
      const valaszokRaw = valaszokByKerdes.get(k.vizsgaKerdesId) ?? [];
      const valaszMap = new Map(valaszokRaw.map((v) => [v.vizsgaValaszId, v]));
      const joValaszDb = joDbByKerdes.get(k.vizsgaKerdesId) ?? 1;

      const valaszok = sorrend
        .map((id) => valaszMap.get(id))
        .filter((v): v is NonNullable<typeof v> => Boolean(v))
        .map((v) => ({
          vizsgaValaszId: v.vizsgaValaszId,
          szoveg: v.szoveg,
          kijelolt: (kijeloltByKerdes.get(k.vizsgaKerdesId) ?? []).includes(v.vizsgaValaszId),
          ...(nezettMod === "attekintes"
            ? {
                jo: v.jo,
                helyesValasztas: helyesByValasz.get(v.vizsgaValaszId) ?? false,
              }
            : {}),
        }));

      return {
        vizsgaKerdesId: k.vizsgaKerdesId,
        index: index + 1,
        szoveg: k.szoveg,
        kepFajl: k.kepFajl,
        pontszam: k.pontszam,
        kapottPont: nezettMod === "attekintes" ? (pontByKerdes.get(k.vizsgaKerdesId) ?? 0) : null,
        joValaszDb,
        valaszok,
        kijeloltValaszIds: kijeloltByKerdes.get(k.vizsgaKerdesId) ?? [],
      };
    }),
  };
}

export const kitoltesRoutes = new Hono<AppEnv>()
  .use("*", requireTanulo)
  .get("/:kitoltesId", async (c) => {
    const user = getUser(c);
    const kitoltesId = c.req.param("kitoltesId");
    const payload = await loadKitoltesPayload(kitoltesId, user.id);
    return c.json({ kitoltes: payload });
  })
  .post("/:kitoltesId/valasz", zValidator("json", valaszValasztasSchema), async (c) => {
    const user = getUser(c);
    const kitoltesId = c.req.param("kitoltesId");
    const body = c.req.valid("json");

    await ensureKitoltesIdo(kitoltesId);

    const fejlec = await db
      .select({
        allapot: kitoltes.allapot,
        tanuloId: kitoltes.tanuloId,
        vizsgaAllapot: vizsga.allapot,
      })
      .from(kitoltes)
      .innerJoin(vizsga, eq(vizsga.vizsgaId, kitoltes.vizsgaId))
      .where(eq(kitoltes.kitoltesId, kitoltesId))
      .limit(1);
    const row = fejlec[0];
    if (!row) throw new NotFoundError("A kitöltés nem található.");
    if (row.tanuloId !== user.id) throw new ForbiddenError();
    if (row.vizsgaAllapot !== "kiirt") {
      throw new ValidationAppError("A vizsga már nem aktív.");
    }
    if (row.allapot !== "folyamatban") {
      throw new ValidationAppError("A kitöltés már lezárult, a válaszok nem módosíthatók.");
    }

    const valaszok = await db
      .select({
        vizsgaValaszId: vizsgaValasz.vizsgaValaszId,
        jo: vizsgaValasz.jo,
      })
      .from(vizsgaValasz)
      .where(eq(vizsgaValasz.vizsgaKerdesId, body.vizsgaKerdesId));

    const joValaszDb = valaszok.filter((v) => v.jo).length || 1;

    const valaszInfo = valaszok.find((v) => v.vizsgaValaszId === body.vizsgaValaszId);
    if (!valaszInfo) throw new NotFoundError("A válaszlehetőség nem található.");

    if (body.kijelolt) {
      if (joValaszDb === 1) {
        await db
          .delete(kitoltesValasz)
          .where(
            and(
              eq(kitoltesValasz.kitoltesId, kitoltesId),
              eq(kitoltesValasz.vizsgaKerdesId, body.vizsgaKerdesId),
            ),
          );
      } else {
        const kijeloltDb = await db
          .select({ db: sql<number>`count(*)::int` })
          .from(kitoltesValasz)
          .where(
            and(
              eq(kitoltesValasz.kitoltesId, kitoltesId),
              eq(kitoltesValasz.vizsgaKerdesId, body.vizsgaKerdesId),
            ),
          );
        const marKijelolt = Number(kijeloltDb[0]?.db ?? 0);
        const marVan = await db
          .select({ id: kitoltesValasz.kitoltesValaszId })
          .from(kitoltesValasz)
          .where(
            and(
              eq(kitoltesValasz.kitoltesId, kitoltesId),
              eq(kitoltesValasz.vizsgaKerdesId, body.vizsgaKerdesId),
              eq(kitoltesValasz.vizsgaValaszId, body.vizsgaValaszId),
            ),
          )
          .limit(1);
        if (marKijelolt >= joValaszDb && marVan.length === 0) {
          throw new ValidationAppError(`Legfeljebb ${joValaszDb} választ jelölhetsz meg.`);
        }
      }
      await db.insert(kitoltesValasz).values({
        kitoltesId,
        vizsgaKerdesId: body.vizsgaKerdesId,
        vizsgaValaszId: body.vizsgaValaszId,
        helyes: valaszInfo.jo,
        kapottPont: 0,
      });
    } else {
      await db
        .delete(kitoltesValasz)
        .where(
          and(
            eq(kitoltesValasz.kitoltesId, kitoltesId),
            eq(kitoltesValasz.vizsgaKerdesId, body.vizsgaKerdesId),
            eq(kitoltesValasz.vizsgaValaszId, body.vizsgaValaszId),
          ),
        );
    }

    const payload = await loadKitoltesPayload(kitoltesId, user.id);
    return c.json({ kitoltes: payload });
  })
  .post("/:kitoltesId/bekuldes", async (c) => {
    const user = getUser(c);
    const kitoltesId = c.req.param("kitoltesId");

    const fejlec = await db
      .select({ tanuloId: kitoltes.tanuloId, allapot: kitoltes.allapot })
      .from(kitoltes)
      .where(eq(kitoltes.kitoltesId, kitoltesId))
      .limit(1);
    const row = fejlec[0];
    if (!row) throw new NotFoundError("A kitöltés nem található.");
    if (row.tanuloId !== user.id) throw new ForbiddenError();
    if (row.allapot !== "folyamatban") {
      const payload = await loadKitoltesPayload(kitoltesId, user.id);
      return c.json({ kitoltes: payload });
    }

    await ertekelEsLezarKitoltes(kitoltesId, "bekuldve");
    const payload = await loadKitoltesPayload(kitoltesId, user.id);
    return c.json({ kitoltes: payload });
  });
