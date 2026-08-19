import { zValidator } from "@hono/zod-validator";
import { eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { createAgazatSchema, updateAgazatSchema } from "@oktateszt/shared";
import { db } from "../db/index.js";
import { agazat } from "../db/schema.js";
import { ConflictError, NotFoundError } from "../lib/errors.js";
import { isUniqueViolation, restoreOrConflictAgazat } from "../lib/bank.js";
import { requireAdmin, requireStaff } from "../middleware/requireAuth.js";
import type { AppEnv } from "../types.js";

export const agazatRoutes = new Hono<AppEnv>()
  .get("/", requireStaff, async (c) => {
    const rows = await db
      .select({
        agazatId: agazat.agazatId,
        agazatNev: agazat.agazatNev,
      })
      .from(agazat)
      .where(isNull(agazat.archivaltAt))
      .orderBy(agazat.agazatNev);
    return c.json({ agazatok: rows });
  })
  .post("/", requireAdmin, zValidator("json", createAgazatSchema), async (c) => {
    const { nev } = c.req.valid("json");
    const restored = await restoreOrConflictAgazat(nev);
    if (restored) {
      return c.json({ agazat: { agazatId: restored.agazatId, agazatNev: restored.agazatNev } }, 200);
    }
    try {
      const [created] = await db.insert(agazat).values({ agazatNev: nev }).returning();
      return c.json({ agazat: { agazatId: created!.agazatId, agazatNev: created!.agazatNev } }, 201);
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictError("Már létezik ilyen nevű ágazat.");
      throw err;
    }
  })
  .patch("/:id", requireAdmin, zValidator("json", updateAgazatSchema), async (c) => {
    const id = c.req.param("id");
    const { nev } = c.req.valid("json");
    try {
      const [updated] = await db
        .update(agazat)
        .set({ agazatNev: nev })
        .where(eq(agazat.agazatId, id))
        .returning();
      if (!updated) throw new NotFoundError("Az ágazat nem található.");
      return c.json({ agazat: { agazatId: updated.agazatId, agazatNev: updated.agazatNev } });
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictError("Már létezik ilyen nevű ágazat.");
      throw err;
    }
  })
  .delete("/:id", requireAdmin, async (c) => {
    const id = c.req.param("id");
    const [archived] = await db
      .update(agazat)
      .set({ archivaltAt: new Date() })
      .where(eq(agazat.agazatId, id))
      .returning();
    if (!archived) throw new NotFoundError("Az ágazat nem található.");
    return c.json({ ok: true });
  });
