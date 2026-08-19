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
import { getUser, requireTanulo } from "../middleware/requireAuth.js";
import type { AppEnv } from "../types.js";

const valaszValasztasSchema = z.object({
  vizsgaKerdesId: z.string().uuid(),
  vizsgaValaszId: z.string().uuid(),
  kijelolt: z.boolean(),
});

async function loadKitoltesPayload(kitoltesId: string, tanuloId: string) {
  const row = await db
    .select({
      kitoltesId: kitoltes.kitoltesId,
      allapot: kitoltes.allapot,
      kerdesSorrend: kitoltes.kerdesSorrend,
      valaszSorrendek: kitoltes.valaszSorrendek,
      vizsgaId: kitoltes.vizsgaId,
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

  const kerdesRows = await db
    .select({
      vizsgaKerdesId: vizsgaKerdes.vizsgaKerdesId,
      szoveg: vizsgaKerdes.szoveg,
      joValaszDb: sql<number>`(
        select count(*)::int from ${vizsgaValasz}
        where ${vizsgaValasz.vizsgaKerdesId} = ${vizsgaKerdes.vizsgaKerdesId}
          and ${vizsgaValasz.jo} = true
      )`,
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
          })
          .from(vizsgaValasz)
          .where(inArray(vizsgaValasz.vizsgaKerdesId, kerdesIds));

  const valaszokByKerdes = new Map<string, typeof valaszRows>();
  for (const v of valaszRows) {
    const list = valaszokByKerdes.get(v.vizsgaKerdesId) ?? [];
    list.push(v);
    valaszokByKerdes.set(v.vizsgaKerdesId, list);
  }

  const kijeloltRows = await db
    .select({
      vizsgaKerdesId: kitoltesValasz.vizsgaKerdesId,
      vizsgaValaszId: kitoltesValasz.vizsgaValaszId,
    })
    .from(kitoltesValasz)
    .where(eq(kitoltesValasz.kitoltesId, kitoltesId));

  const kijeloltByKerdes = new Map<string, string[]>();
  for (const k of kijeloltRows) {
    const list = kijeloltByKerdes.get(k.vizsgaKerdesId) ?? [];
    list.push(k.vizsgaValaszId);
    kijeloltByKerdes.set(k.vizsgaKerdesId, list);
  }

  return {
    kitoltesId: fejlec.kitoltesId,
    allapot: fejlec.allapot,
    vizsgaCim: fejlec.tesztCim,
    kerdesek: kerdesek.map((k, index) => {
      const sorrend = fejlec.valaszSorrendek[k.vizsgaKerdesId] ?? [];
      const valaszokRaw = valaszokByKerdes.get(k.vizsgaKerdesId) ?? [];
      const valaszMap = new Map(valaszokRaw.map((v) => [v.vizsgaValaszId, v]));
      const valaszok = sorrend
        .map((id) => valaszMap.get(id))
        .filter((v): v is NonNullable<typeof v> => Boolean(v))
        .map((v) => ({ vizsgaValaszId: v.vizsgaValaszId, szoveg: v.szoveg }));

      return {
        vizsgaKerdesId: k.vizsgaKerdesId,
        index: index + 1,
        szoveg: k.szoveg,
        joValaszDb: Number(k.joValaszDb) || 1,
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

    const fejlec = await db
      .select({
        allapot: kitoltes.allapot,
        tanuloId: kitoltes.tanuloId,
      })
      .from(kitoltes)
      .where(eq(kitoltes.kitoltesId, kitoltesId))
      .limit(1);
    const row = fejlec[0];
    if (!row) throw new NotFoundError("A kitöltés nem található.");
    if (row.tanuloId !== user.id) throw new ForbiddenError();
    if (row.allapot !== "folyamatban") {
      throw new ValidationAppError("A kitöltés már lezárult, a válaszok nem módosíthatók.");
    }

    const kerdesInfo = await db
      .select({
        vizsgaKerdesId: vizsgaKerdes.vizsgaKerdesId,
        joValaszDb: sql<number>`(
          select count(*)::int from ${vizsgaValasz}
          where ${vizsgaValasz.vizsgaKerdesId} = ${vizsgaKerdes.vizsgaKerdesId}
            and ${vizsgaValasz.jo} = true
        )`,
      })
      .from(vizsgaKerdes)
      .where(eq(vizsgaKerdes.vizsgaKerdesId, body.vizsgaKerdesId))
      .limit(1);
    const kerdes = kerdesInfo[0];
    if (!kerdes) throw new NotFoundError("A kérdés nem található.");

    const valaszInfo = await db
      .select({ vizsgaValaszId: vizsgaValasz.vizsgaValaszId, jo: vizsgaValasz.jo })
      .from(vizsgaValasz)
      .where(
        and(
          eq(vizsgaValasz.vizsgaValaszId, body.vizsgaValaszId),
          eq(vizsgaValasz.vizsgaKerdesId, body.vizsgaKerdesId),
        ),
      )
      .limit(1);
    const valasz = valaszInfo[0];
    if (!valasz) throw new NotFoundError("A válaszlehetőség nem található.");

    const joValaszDb = Number(kerdes.joValaszDb) || 1;

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
      }
      await db.insert(kitoltesValasz).values({
        kitoltesId,
        vizsgaKerdesId: body.vizsgaKerdesId,
        vizsgaValaszId: body.vizsgaValaszId,
        helyes: valasz.jo,
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
  });
