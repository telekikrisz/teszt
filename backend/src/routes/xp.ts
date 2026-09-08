import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { createXpTetelSchema, XP_ESEMENYEK, xpOsztalySzuroSchema } from "@oktateszt/shared";
import { listXpOsztalyok, listXpTanulok, rogzitXpTetel } from "../services/xpFlow.js";
import { getUser, requireAdmin } from "../middleware/requireAuth.js";
import type { AppEnv } from "../types.js";

export const xpRoutes = new Hono<AppEnv>()
  .use("*", requireAdmin)
  .get("/esemenyek", (c) => c.json({ esemenyek: XP_ESEMENYEK }))
  .get("/osztalyok", async (c) => {
    const osztalyok = await listXpOsztalyok();
    return c.json({ osztalyok });
  })
  .get("/tanulok", zValidator("query", xpOsztalySzuroSchema), async (c) => {
    const { osztaly } = c.req.valid("query");
    const tanulok = await listXpTanulok(osztaly);
    return c.json({ tanulok });
  })
  .post("/tetel", zValidator("json", createXpTetelSchema), async (c) => {
    const user = getUser(c);
    const body = c.req.valid("json");
    const result = await rogzitXpTetel({
      tanuloId: body.tanuloId,
      tantargyId: body.tantargyId,
      esemenyKod: body.esemenyKod,
      pont: body.pont,
      rogzitoId: user.id,
    });
    return c.json({ ok: true, ...result }, 201);
  });
