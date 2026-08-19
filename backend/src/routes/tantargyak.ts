import { zValidator } from "@hono/zod-validator";
import { and, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { createTantargySchema, updateTantargySchema } from "@oktateszt/shared";
import { db } from "../db/index.js";
import { agazat, tantargy } from "../db/schema.js";
import { ConflictError, NotFoundError } from "../lib/errors.js";
import { assertAktivAgazat, isUniqueViolation, restoreOrConflictTantargy } from "../lib/bank.js";
import { requireAdmin, requireStaff } from "../middleware/requireAuth.js";
import type { AppEnv } from "../types.js";

const listQuery = z.object({
  agazatId: z.string().uuid().optional(),
});

export const tantargyRoutes = new Hono<AppEnv>()
  .get("/", requireStaff, zValidator("query", listQuery), async (c) => {
    const { agazatId } = c.req.valid("query");
    const conditions = [isNull(tantargy.archivaltAt)];
    if (agazatId) conditions.push(eq(tantargy.agazatId, agazatId));

    const rows = await db
      .select({
        tantargyId: tantargy.tantargyId,
        tantargyNev: tantargy.tantargyNev,
        agazatId: tantargy.agazatId,
        agazatNev: agazat.agazatNev,
      })
      .from(tantargy)
      .innerJoin(agazat, eq(tantargy.agazatId, agazat.agazatId))
      .where(and(...conditions))
      .orderBy(tantargy.tantargyNev);
    return c.json({ tantargyak: rows });
  })
  .post("/", requireAdmin, zValidator("json", createTantargySchema), async (c) => {
    const { agazatId, nev } = c.req.valid("json");
    await assertAktivAgazat(agazatId);
    const restored = await restoreOrConflictTantargy(agazatId, nev);
    if (restored) {
      return c.json(
        { tantargy: { tantargyId: restored.tantargyId, tantargyNev: restored.tantargyNev, agazatId: restored.agazatId } },
        200,
      );
    }
    try {
      const [created] = await db
        .insert(tantargy)
        .values({ agazatId, tantargyNev: nev })
        .returning();
      return c.json(
        { tantargy: { tantargyId: created!.tantargyId, tantargyNev: created!.tantargyNev, agazatId: created!.agazatId } },
        201,
      );
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictError("Ebben az ágazatban már van ilyen nevű tantárgy.");
      throw err;
    }
  })
  .patch("/:id", requireAdmin, zValidator("json", updateTantargySchema), async (c) => {
    const id = c.req.param("id");
    const input = c.req.valid("json");
    if (input.agazatId) await assertAktivAgazat(input.agazatId);
    const patch: Partial<typeof tantargy.$inferInsert> = {};
    if (input.nev) patch.tantargyNev = input.nev;
    if (input.agazatId) patch.agazatId = input.agazatId;
    try {
      const [updated] = await db.update(tantargy).set(patch).where(eq(tantargy.tantargyId, id)).returning();
      if (!updated) throw new NotFoundError("A tantárgy nem található.");
      return c.json({
        tantargy: { tantargyId: updated.tantargyId, tantargyNev: updated.tantargyNev, agazatId: updated.agazatId },
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictError("Ebben az ágazatban már van ilyen nevű tantárgy.");
      throw err;
    }
  })
  .delete("/:id", requireAdmin, async (c) => {
    const id = c.req.param("id");
    const [archived] = await db
      .update(tantargy)
      .set({ archivaltAt: new Date() })
      .where(eq(tantargy.tantargyId, id))
      .returning();
    if (!archived) throw new NotFoundError("A tantárgy nem található.");
    return c.json({ ok: true });
  });
