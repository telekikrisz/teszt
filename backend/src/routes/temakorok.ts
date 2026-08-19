import { zValidator } from "@hono/zod-validator";
import { and, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { createTemakorSchema, updateTemakorSchema } from "@oktateszt/shared";
import { db } from "../db/index.js";
import { tantargy, temakor } from "../db/schema.js";
import { ConflictError, NotFoundError } from "../lib/errors.js";
import { assertAktivTantargy, isUniqueViolation, restoreOrConflictTemakor } from "../lib/bank.js";
import { requireStaff } from "../middleware/requireAuth.js";
import type { AppEnv } from "../types.js";

const listQuery = z.object({
  tantargyId: z.string().uuid().optional(),
});

export const temakorRoutes = new Hono<AppEnv>()
  .use("*", requireStaff)
  .get("/", zValidator("query", listQuery), async (c) => {
    const { tantargyId } = c.req.valid("query");
    const conditions = [isNull(temakor.archivaltAt)];
    if (tantargyId) conditions.push(eq(temakor.tantargyId, tantargyId));

    const rows = await db
      .select({
        temakorId: temakor.temakorId,
        temakorNev: temakor.temakorNev,
        tantargyId: temakor.tantargyId,
        tantargyNev: tantargy.tantargyNev,
      })
      .from(temakor)
      .innerJoin(tantargy, eq(temakor.tantargyId, tantargy.tantargyId))
      .where(and(...conditions))
      .orderBy(temakor.temakorNev);
    return c.json({ temakorok: rows });
  })
  .post("/", zValidator("json", createTemakorSchema), async (c) => {
    const { tantargyId, nev } = c.req.valid("json");
    await assertAktivTantargy(tantargyId);
    const restored = await restoreOrConflictTemakor(tantargyId, nev);
    if (restored) {
      return c.json(
        { temakor: { temakorId: restored.temakorId, temakorNev: restored.temakorNev, tantargyId: restored.tantargyId } },
        200,
      );
    }
    try {
      const [created] = await db
        .insert(temakor)
        .values({ tantargyId, temakorNev: nev })
        .returning();
      return c.json(
        { temakor: { temakorId: created!.temakorId, temakorNev: created!.temakorNev, tantargyId: created!.tantargyId } },
        201,
      );
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictError("Ebben a tantárgyban már van ilyen nevű témakör.");
      throw err;
    }
  })
  .patch("/:id", zValidator("json", updateTemakorSchema), async (c) => {
    const id = c.req.param("id");
    const input = c.req.valid("json");
    if (input.tantargyId) await assertAktivTantargy(input.tantargyId);
    const patch: Partial<typeof temakor.$inferInsert> = {};
    if (input.nev) patch.temakorNev = input.nev;
    if (input.tantargyId) patch.tantargyId = input.tantargyId;
    try {
      const [updated] = await db.update(temakor).set(patch).where(eq(temakor.temakorId, id)).returning();
      if (!updated) throw new NotFoundError("A témakör nem található.");
      return c.json({
        temakor: { temakorId: updated.temakorId, temakorNev: updated.temakorNev, tantargyId: updated.tantargyId },
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictError("Ebben a tantárgyban már van ilyen nevű témakör.");
      throw err;
    }
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    const [archived] = await db
      .update(temakor)
      .set({ archivaltAt: new Date() })
      .where(eq(temakor.temakorId, id))
      .returning();
    if (!archived) throw new NotFoundError("A témakör nem található.");
    return c.json({ ok: true });
  });
