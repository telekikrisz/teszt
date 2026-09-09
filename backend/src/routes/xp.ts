import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { createXpKapSchema, xpOsztalySzuroSchema } from "@oktateszt/shared";
import { listXpEsemenyek, listXpOsztalyok, listXpTanulok, rogzitXpKap } from "../services/xpFlow.js";
import { getUser, requireTanar } from "../middleware/requireAuth.js";
import type { AppEnv } from "../types.js";

export const xpRoutes = new Hono<AppEnv>()
  .use("*", requireTanar)
  .get("/esemenyek", async (c) => {
    const esemenyek = await listXpEsemenyek();
    return c.json({ esemenyek });
  })
  .get("/osztalyok", async (c) => {
    const osztalyok = await listXpOsztalyok();
    return c.json({ osztalyok });
  })
  .get("/tanulok", zValidator("query", xpOsztalySzuroSchema), async (c) => {
    const { osztaly } = c.req.valid("query");
    const tanulok = await listXpTanulok(osztaly);
    return c.json({ tanulok });
  })
  .post("/kap", zValidator("json", createXpKapSchema), async (c) => {
    const user = getUser(c);
    const body = c.req.valid("json");
    const result = await rogzitXpKap({
      tanuloId: body.tanuloId,
      tantargyId: body.tantargyId,
      esemenyKod: body.esemenyKod,
      pont: body.pont,
      rogzitoId: user.id,
    });
    return c.json({ ok: true, ...result }, 201);
  });
