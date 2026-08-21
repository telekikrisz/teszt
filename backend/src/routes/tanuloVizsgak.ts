import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index.js";
import { kitoltes, teszt, vizsga, vizsgazik } from "../db/schema.js";
import { utcNow } from "../lib/crypto.js";
import { getUser, requireTanulo } from "../middleware/requireAuth.js";
import { syncVizsgaKitoltesek, startKitoltes } from "../services/kitoltesFlow.js";
import type { AppEnv } from "../types.js";

async function listTanuloVizsgak(tanuloId: string) {
  const rows = await listTanuloVizsgakRaw(tanuloId);
  const vizsgaIds = [...new Set(rows.map((r) => r.vizsgaId))];
  for (const id of vizsgaIds) {
    await syncVizsgaKitoltesek(id);
  }
  if (vizsgaIds.length === 0) return rows;
  return listTanuloVizsgakRaw(tanuloId);
}

async function listTanuloVizsgakRaw(tanuloId: string) {
  return db
    .select({
      vizsgaId: vizsga.vizsgaId,
      tesztCim: teszt.cim,
      agazatNev: vizsga.agazatNev,
      tantargyNev: vizsga.tantargyNev,
      temakorNev: vizsga.temakorNev,
      idoablakEleje: vizsga.idoablakEleje,
      idoablakVege: vizsga.idoablakVege,
      perc: vizsga.perc,
      kitoltesId: kitoltes.kitoltesId,
      kitoltesAllapot: kitoltes.allapot,
    })
    .from(vizsgazik)
    .innerJoin(vizsga, eq(vizsgazik.vizsgaId, vizsga.vizsgaId))
    .innerJoin(teszt, eq(vizsga.tesztId, teszt.tesztId))
    .leftJoin(
      kitoltes,
      and(eq(kitoltes.vizsgaId, vizsga.vizsgaId), eq(kitoltes.tanuloId, tanuloId)),
    )
    .where(and(eq(vizsgazik.tanuloId, tanuloId), eq(vizsga.allapot, "kiirt")))
    .orderBy(desc(vizsga.idoablakEleje));
}

export const tanuloVizsgaRoutes = new Hono<AppEnv>()
  .use("*", requireTanulo)
  .get("/", async (c) => {
    const user = getUser(c);
    const now = utcNow();
    const friss = await listTanuloVizsgak(user.id);

    return c.json({
      vizsgak: friss.map((v) => {
        const eleje = v.idoablakEleje.getTime();
        const vege = v.idoablakVege.getTime();
        const ts = now.getTime();
        let idoablakAllapot: "kovetkezo" | "nyitott" | "lezart" = "nyitott";
        if (ts < eleje) idoablakAllapot = "kovetkezo";
        else if (ts > vege) idoablakAllapot = "lezart";

        return {
          vizsgaId: v.vizsgaId,
          tesztCim: v.tesztCim,
          agazatNev: v.agazatNev,
          tantargyNev: v.tantargyNev,
          temakorNev: v.temakorNev || null,
          idoablakEleje: v.idoablakEleje.toISOString(),
          idoablakVege: v.idoablakVege.toISOString(),
          perc: v.perc,
          idoablakAllapot,
          kitoltesId: v.kitoltesId,
          kitoltesAllapot: v.kitoltesAllapot ?? null,
        };
      }),
    });
  })
  .post("/:vizsgaId/inditas", async (c) => {
    const user = getUser(c);
    const kitoltesId = await startKitoltes(c.req.param("vizsgaId"), user.id);
    return c.json({ kitoltesId });
  });
