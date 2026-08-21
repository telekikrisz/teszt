import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/index.js";
import {
  evfolyam,
  kitoltes,
  kitoltesValasz,
  tantargy,
  teszt,
  vizsga,
  vizsgaKerdes,
  vizsgazik,
} from "../db/schema.js";
import { getUser, requireTanulo } from "../middleware/requireAuth.js";
import type { AppEnv } from "../types.js";

const eredmenySzuroSchema = z.object({
  evfolyamId: z.string().uuid().optional(),
  tantargyId: z.string().uuid().optional(),
  temakorId: z.string().uuid().optional(),
});

export const tanuloEredmenyRoutes = new Hono<AppEnv>()
  .use("*", requireTanulo)
  .get("/", zValidator("query", eredmenySzuroSchema), async (c) => {
    const user = getUser(c);
    const filters = c.req.valid("query");
    const conditions = [eq(vizsgazik.tanuloId, user.id), eq(vizsga.allapot, "lezart")];

    if (filters.evfolyamId) conditions.push(eq(teszt.evfolyamId, filters.evfolyamId));
    if (filters.tantargyId) conditions.push(eq(teszt.tantargyId, filters.tantargyId));
    if (filters.temakorId) conditions.push(eq(teszt.temakorId, filters.temakorId));
    if (user.agazatId) conditions.push(eq(tantargy.agazatId, user.agazatId));

    const rows = await db
      .select({
        vizsgaId: vizsga.vizsgaId,
        kitoltesId: kitoltes.kitoltesId,
        tesztCim: teszt.cim,
        agazatNev: vizsga.agazatNev,
        tantargyNev: vizsga.tantargyNev,
        temakorNev: vizsga.temakorNev,
        evfolyamErtek: evfolyam.evfolyamErtek,
        idoablakEleje: vizsga.idoablakEleje,
        bekuldveAt: kitoltes.bekuldveAt,
        kitoltesAllapot: kitoltes.allapot,
        maxPont: sql<number>`(
          select coalesce(sum(${vizsgaKerdes.pontszam}), 0)::int
          from ${vizsgaKerdes}
          where ${vizsgaKerdes.vizsgaId} = ${vizsga.vizsgaId}
        )`,
        osszPont: sql<number>`coalesce((
          select sum(${kitoltesValasz.kapottPont})::int
          from ${kitoltesValasz}
          where ${kitoltesValasz.kitoltesId} = ${kitoltes.kitoltesId}
        ), 0)`,
      })
      .from(vizsgazik)
      .innerJoin(vizsga, eq(vizsgazik.vizsgaId, vizsga.vizsgaId))
      .innerJoin(teszt, eq(vizsga.tesztId, teszt.tesztId))
      .innerJoin(tantargy, eq(teszt.tantargyId, tantargy.tantargyId))
      .innerJoin(evfolyam, eq(teszt.evfolyamId, evfolyam.evfolyamId))
      .innerJoin(
        kitoltes,
        and(eq(kitoltes.vizsgaId, vizsga.vizsgaId), eq(kitoltes.tanuloId, user.id)),
      )
      .where(and(...conditions))
      .orderBy(desc(vizsga.idoablakEleje));

    return c.json({
      eredmenyek: rows.map((r) => {
        const maxPont = Number(r.maxPont);
        const osszPont = Number(r.osszPont);
        return {
          vizsgaId: r.vizsgaId,
          kitoltesId: r.kitoltesId,
          tesztCim: r.tesztCim,
          agazatNev: r.agazatNev,
          tantargyNev: r.tantargyNev,
          temakorNev: r.temakorNev || null,
          evfolyamErtek: r.evfolyamErtek,
          idoablakEleje: r.idoablakEleje.toISOString(),
          bekuldveAt: r.bekuldveAt?.toISOString() ?? null,
          kitoltesAllapot: r.kitoltesAllapot,
          osszPont,
          maxPont,
          szazalek: maxPont > 0 ? Math.round((osszPont / maxPont) * 100) : null,
        };
      }),
    });
  });
