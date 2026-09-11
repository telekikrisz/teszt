import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import {
  VIZSGA_AKTIV_ALLAPOTOK,
  VIZSGA_ARCHIV_ALLAPOTOK,
  bulkVizsgaTorlesSchema,
  createVizsgaSchema,
  vizsgaJegyMezok,
  vizsgaSzuroSchema,
  vizsgaTanuloHosszabbitasSchema,
  type VizsgaAllapot,
} from "@oktateszt/shared";
import { db } from "../db/index.js";
import {
  evfolyam,
  felhasznalo,
  kitoltes,
  kitoltesValasz,
  tantargy,
  teszt,
  vizsga,
  vizsgaKerdes,
  vizsgazik,
} from "../db/schema.js";
import { AppError, NotFoundError, ValidationAppError } from "../lib/errors.js";
import { requireStaff } from "../middleware/requireAuth.js";
import { createVizsgaFromTeszt } from "../services/vizsgaCreate.js";
import { ertekelEsLezarKitoltes, syncVizsgaKitoltesek } from "../services/kitoltesFlow.js";
import type { AppEnv } from "../types.js";

function tarhelyFeltetel(aktiv: boolean, archivalt: boolean) {
  const res = [];
  if (aktiv) res.push(inArray(vizsga.allapot, [...VIZSGA_AKTIV_ALLAPOTOK]));
  if (archivalt) res.push(inArray(vizsga.allapot, [...VIZSGA_ARCHIV_ALLAPOTOK]));
  if (res.length === 0) return sql`false`;
  if (res.length === 1) return res[0];
  return or(...res)!;
}

async function hardDeleteVizsga(vizsgaId: string) {
  const kitoltesek = await db
    .select({ kitoltesId: kitoltes.kitoltesId })
    .from(kitoltes)
    .where(eq(kitoltes.vizsgaId, vizsgaId));
  const kitoltesIds = kitoltesek.map((k) => k.kitoltesId);
  if (kitoltesIds.length > 0) {
    await db.delete(kitoltesValasz).where(inArray(kitoltesValasz.kitoltesId, kitoltesIds));
    await db.delete(kitoltes).where(inArray(kitoltes.kitoltesId, kitoltesIds));
  }
  await db.delete(vizsgazik).where(eq(vizsgazik.vizsgaId, vizsgaId));
  // vizsga_kerdes (+ vizsga_valasz cascade) a vizsga törlésekor
  const [deleted] = await db.delete(vizsga).where(eq(vizsga.vizsgaId, vizsgaId)).returning({
    vizsgaId: vizsga.vizsgaId,
  });
  if (!deleted) throw new NotFoundError("A vizsga nem található.");
}

export const vizsgaRoutes = new Hono<AppEnv>()
  .use("*", requireStaff)
  .get("/", zValidator("query", vizsgaSzuroSchema), async (c) => {
    const filters = c.req.valid("query");
    const conditions = [tarhelyFeltetel(filters.aktiv, filters.archivalt)];
    if (filters.allapot) conditions.push(eq(vizsga.allapot, filters.allapot));
    if (filters.evfolyamId) conditions.push(eq(teszt.evfolyamId, filters.evfolyamId));
    if (filters.tantargyId) conditions.push(eq(teszt.tantargyId, filters.tantargyId));
    if (filters.temakorId) conditions.push(eq(teszt.temakorId, filters.temakorId));
    if (filters.agazatId) conditions.push(eq(tantargy.agazatId, filters.agazatId));
    if (filters.q) {
      const like = `%${filters.q}%`;
      conditions.push(
        or(
          ilike(teszt.cim, like),
          ilike(vizsga.agazatNev, like),
          ilike(vizsga.tantargyNev, like),
          ilike(vizsga.temakorNev, like),
        )!,
      );
    }

    const rows = await db
      .select({
        vizsgaId: vizsga.vizsgaId,
        tesztId: vizsga.tesztId,
        tesztCim: teszt.cim,
        agazatNev: vizsga.agazatNev,
        tantargyNev: vizsga.tantargyNev,
        temakorNev: vizsga.temakorNev,
        idoablakEleje: vizsga.idoablakEleje,
        idoablakVege: vizsga.idoablakVege,
        perc: vizsga.perc,
        jegyAdando: vizsga.jegyAdando,
        letrehozvaAt: vizsga.letrehozvaAt,
        archivaltAt: vizsga.archivaltAt,
        allapot: vizsga.allapot,
        evfolyamErtek: evfolyam.evfolyamErtek,
        tanuloDb: sql<number>`(
          select count(*)::int from ${vizsgazik}
          where ${vizsgazik.vizsgaId} = ${vizsga.vizsgaId}
        )`,
        kitoltesDb: sql<number>`(
          select count(*)::int from ${kitoltes}
          where ${kitoltes.vizsgaId} = ${vizsga.vizsgaId}
            and ${kitoltes.allapot} in ('bekuldve', 'lejart')
        )`,
        maxPont: sql<number>`(
          select coalesce(sum(${vizsgaKerdes.pontszam}), 0)::int
          from ${vizsgaKerdes}
          where ${vizsgaKerdes.vizsgaId} = ${vizsga.vizsgaId}
        )`,
      })
      .from(vizsga)
      .innerJoin(teszt, eq(vizsga.tesztId, teszt.tesztId))
      .innerJoin(tantargy, eq(teszt.tantargyId, tantargy.tantargyId))
      .innerJoin(evfolyam, eq(teszt.evfolyamId, evfolyam.evfolyamId))
      .where(and(...conditions))
      .orderBy(desc(vizsga.idoablakEleje));

    return c.json({
      vizsgak: rows.map((row) => ({
        ...row,
        temakorNev: row.temakorNev || null,
        archivalt: row.allapot === "lezart",
      })),
    });
  })
  .get("/:id", async (c) => {
    const vizsgaId = c.req.param("id");
    await syncVizsgaKitoltesek(vizsgaId);
    const meta = await loadVizsgaMeta(vizsgaId);
    const eredmenyek = await loadEredmenyek(vizsgaId, meta.maxPont, meta.jegyAdando);
    return c.json({ vizsga: { ...meta, eredmenyek } });
  })
  .post("/", zValidator("json", createVizsgaSchema), async (c) => {
    const input = c.req.valid("json");
    const vizsgaId = await createVizsgaFromTeszt(input);
    const meta = await loadVizsgaMeta(vizsgaId);
    return c.json({ vizsga: { ...meta, eredmenyek: [] } }, 201);
  })
  .patch(
    "/:vizsgaId/tanulok/:tanuloId/hosszabbitas",
    zValidator("json", vizsgaTanuloHosszabbitasSchema),
    async (c) => {
      const vizsgaId = c.req.param("vizsgaId");
      const tanuloId = c.req.param("tanuloId");
      const body = c.req.valid("json");

      const [vizsgaRow] = await db
        .select({ allapot: vizsga.allapot })
        .from(vizsga)
        .where(eq(vizsga.vizsgaId, vizsgaId))
        .limit(1);
      if (!vizsgaRow) throw new NotFoundError("A vizsga nem található.");
      if (vizsgaRow.allapot !== "kiirt") {
        throw new ValidationAppError("Csak kiírt vizsgánál adható extra idő.");
      }

      const [kitoltesRow] = await db
        .select({ kitoltesId: kitoltes.kitoltesId, allapot: kitoltes.allapot })
        .from(kitoltes)
        .where(and(eq(kitoltes.vizsgaId, vizsgaId), eq(kitoltes.tanuloId, tanuloId)))
        .limit(1);

      if (kitoltesRow && (kitoltesRow.allapot === "bekuldve" || kitoltesRow.allapot === "lejart")) {
        throw new ValidationAppError("A tanuló már befejezte a vizsgát — az extra idő nem módosítható.");
      }

      const [updated] = await db
        .update(vizsgazik)
        .set({ hosszabbitasPerc: body.hosszabbitasPerc })
        .where(and(eq(vizsgazik.vizsgaId, vizsgaId), eq(vizsgazik.tanuloId, tanuloId)))
        .returning({ hosszabbitasPerc: vizsgazik.hosszabbitasPerc });

      if (!updated) throw new NotFoundError("A tanuló nem szerepel a vizsgán.");

      // Folyamatban lévő kitöltésnél a hátralévő időt is frissítjük
      if (kitoltesRow?.allapot === "folyamatban") {
        await db
          .update(kitoltes)
          .set({ hosszabbitasPerc: body.hosszabbitasPerc })
          .where(eq(kitoltes.kitoltesId, kitoltesRow.kitoltesId));
      }

      return c.json({ hosszabbitasPerc: updated.hosszabbitasPerc });
    },
  )
  .post("/:id/felfuggesztes", async (c) => {
    const id = c.req.param("id");
    const [existing] = await db
      .select({ allapot: vizsga.allapot })
      .from(vizsga)
      .where(eq(vizsga.vizsgaId, id))
      .limit(1);
    if (!existing) throw new NotFoundError("A vizsga nem található.");
    if (existing.allapot !== "kiirt") {
      throw new ValidationAppError("Csak kiírt vizsga függeszthető fel.");
    }

    const folyamatban = await db
      .select({ kitoltesId: kitoltes.kitoltesId })
      .from(kitoltes)
      .where(and(eq(kitoltes.vizsgaId, id), eq(kitoltes.allapot, "folyamatban")));
    for (const k of folyamatban) {
      await ertekelEsLezarKitoltes(k.kitoltesId, "lejart");
    }

    const [updated] = await db
      .update(vizsga)
      .set({ allapot: "felfuggesztett", archivaltAt: null })
      .where(eq(vizsga.vizsgaId, id))
      .returning();
    if (!updated) throw new NotFoundError("A vizsga nem található.");

    const meta = await loadVizsgaMeta(id);
    const eredmenyek = await loadEredmenyek(id, meta.maxPont, meta.jegyAdando);
    return c.json({ vizsga: { ...meta, eredmenyek } });
  })
  .post("/torles", zValidator("json", bulkVizsgaTorlesSchema), async (c) => {
    const { ids } = c.req.valid("json");
    const uniqueIds = [...new Set(ids)];

    const rows = await db
      .select({ id: vizsga.vizsgaId, allapot: vizsga.allapot })
      .from(vizsga)
      .where(inArray(vizsga.vizsgaId, uniqueIds));

    const torolhetoIds = rows.map((r) => r.id);
    if (torolhetoIds.length === 0) {
      throw new AppError(400, "Nincs törölhető kijelölt vizsga.", "EMPTY_SELECTION");
    }

    for (const id of torolhetoIds) {
      await hardDeleteVizsga(id);
    }

    return c.json({
      ok: true,
      torolt: torolhetoIds.length,
      kihagyott: uniqueIds.length - torolhetoIds.length,
    });
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    const [existing] = await db
      .select({ allapot: vizsga.allapot })
      .from(vizsga)
      .where(eq(vizsga.vizsgaId, id))
      .limit(1);
    if (!existing) throw new NotFoundError("A vizsga nem található.");

    await hardDeleteVizsga(id);
    return c.json({ ok: true });
  });

async function loadVizsgaMeta(vizsgaId: string) {
  const [row] = await db
    .select({
      vizsgaId: vizsga.vizsgaId,
      tesztId: vizsga.tesztId,
      tesztCim: teszt.cim,
      agazatNev: vizsga.agazatNev,
      tantargyNev: vizsga.tantargyNev,
      temakorNev: vizsga.temakorNev,
      idoablakEleje: vizsga.idoablakEleje,
      idoablakVege: vizsga.idoablakVege,
      perc: vizsga.perc,
      jegyAdando: vizsga.jegyAdando,
      letrehozvaAt: vizsga.letrehozvaAt,
      archivaltAt: vizsga.archivaltAt,
      allapot: vizsga.allapot,
      evfolyamErtek: evfolyam.evfolyamErtek,
      tanuloDb: sql<number>`(
        select count(*)::int from ${vizsgazik}
        where ${vizsgazik.vizsgaId} = ${vizsga.vizsgaId}
      )`,
      maxPont: sql<number>`(
        select coalesce(sum(${vizsgaKerdes.pontszam}), 0)::int
        from ${vizsgaKerdes}
        where ${vizsgaKerdes.vizsgaId} = ${vizsga.vizsgaId}
      )`,
    })
    .from(vizsga)
    .innerJoin(teszt, eq(vizsga.tesztId, teszt.tesztId))
    .innerJoin(evfolyam, eq(teszt.evfolyamId, evfolyam.evfolyamId))
    .where(eq(vizsga.vizsgaId, vizsgaId))
    .limit(1);

  if (!row) throw new NotFoundError("A vizsga nem található.");

  return {
    ...row,
    temakorNev: row.temakorNev || null,
    archivalt: (row.allapot as VizsgaAllapot) === "lezart",
  };
}

async function loadEredmenyek(vizsgaId: string, maxPont: number, jegyAdando: boolean) {
  const rows = await db
    .select({
      tanuloId: vizsgazik.tanuloId,
      tanuloNev: felhasznalo.nev,
      osztaly: felhasznalo.osztaly,
      hosszabbitasPerc: vizsgazik.hosszabbitasPerc,
      kitoltesId: kitoltes.kitoltesId,
      allapot: kitoltes.allapot,
      elkezdveAt: kitoltes.elkezdveAt,
      bekuldveAt: kitoltes.bekuldveAt,
      osszPont: sql<number>`coalesce((
        select sum(${kitoltesValasz.kapottPont})::int
        from ${kitoltesValasz}
        where ${kitoltesValasz.kitoltesId} = ${kitoltes.kitoltesId}
      ), 0)`,
    })
    .from(vizsgazik)
    .innerJoin(felhasznalo, eq(vizsgazik.tanuloId, felhasznalo.felhasznaloId))
    .leftJoin(
      kitoltes,
      and(eq(kitoltes.vizsgaId, vizsgazik.vizsgaId), eq(kitoltes.tanuloId, vizsgazik.tanuloId)),
    )
    .where(eq(vizsgazik.vizsgaId, vizsgaId))
    .orderBy(felhasznalo.nev);

  return rows.map((r) => {
    const kesz = r.allapot === "bekuldve" || r.allapot === "lejart";
    const szazalek =
      r.kitoltesId && maxPont > 0 ? Math.round((Number(r.osszPont) / maxPont) * 100) : null;
    return {
      tanuloId: r.tanuloId,
      tanuloNev: r.tanuloNev,
      osztaly: r.osztaly ?? "—",
      hosszabbitasPerc: Number(r.hosszabbitasPerc),
      allapot: r.kitoltesId ? r.allapot : ("nem_kezdte" as const),
      elkezdveAt: r.elkezdveAt,
      bekuldveAt: r.bekuldveAt,
      osszPont: r.kitoltesId ? Number(r.osszPont) : null,
      maxPont: r.kitoltesId ? maxPont : null,
      szazalek,
      ...vizsgaJegyMezok(Boolean(jegyAdando) && Boolean(kesz), kesz ? szazalek : null),
      kitoltesId: r.kitoltesId,
    };
  });
}
