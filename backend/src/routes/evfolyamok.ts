import { zValidator } from "@hono/zod-validator";
import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { createEvfolyamSchema, updateEvfolyamSchema } from "@oktateszt/shared";
import { db } from "../db/index.js";
import { evfolyam } from "../db/schema.js";
import { AppError, ConflictError, NotFoundError } from "../lib/errors.js";
import { requireAdmin, requireStaff } from "../middleware/requireAuth.js";
import type { AppEnv } from "../types.js";

function isUniqueViolation(err: unknown) {
  return typeof err === "object" && err && "code" in err && (err as { code: string }).code === "23505";
}

export const evfolyamRoutes = new Hono<AppEnv>()
  .get("/", requireStaff, async (c) => {
    const rows = await db
      .select({
        evfolyamId: evfolyam.evfolyamId,
        evfolyamErtek: evfolyam.evfolyamErtek,
      })
      .from(evfolyam)
      .orderBy(asc(evfolyam.evfolyamErtek));
    return c.json({ evfolyamok: rows });
  })
  .post("/", requireAdmin, zValidator("json", createEvfolyamSchema), async (c) => {
    const { evfolyamErtek } = c.req.valid("json");
    try {
      const [created] = await db.insert(evfolyam).values({ evfolyamErtek }).returning();
      return c.json(
        { evfolyam: { evfolyamId: created!.evfolyamId, evfolyamErtek: created!.evfolyamErtek } },
        201,
      );
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictError("Ez az évfolyam már létezik.");
      throw err;
    }
  })
  .patch("/:id", requireAdmin, zValidator("json", updateEvfolyamSchema), async (c) => {
    const id = c.req.param("id");
    const { evfolyamErtek } = c.req.valid("json");
    try {
      const [updated] = await db
        .update(evfolyam)
        .set({ evfolyamErtek })
        .where(eq(evfolyam.evfolyamId, id))
        .returning();
      if (!updated) throw new NotFoundError("Az évfolyam nem található.");
      return c.json({
        evfolyam: { evfolyamId: updated.evfolyamId, evfolyamErtek: updated.evfolyamErtek },
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictError("Ez az évfolyam már létezik.");
      throw err;
    }
  })
  .delete("/:id", requireAdmin, async (c) => {
    const id = c.req.param("id");
    try {
      const [deleted] = await db
        .delete(evfolyam)
        .where(eq(evfolyam.evfolyamId, id))
        .returning({ evfolyamId: evfolyam.evfolyamId });
      if (!deleted) throw new NotFoundError("Az évfolyam nem található.");
      return c.json({ ok: true });
    } catch (err) {
      if (typeof err === "object" && err && "code" in err && (err as { code: string }).code === "23503") {
        throw new AppError(
          409,
          "Az évfolyam nem törölhető, mert feladatok vagy tesztek hivatkoznak rá.",
          "HAS_RELATED_DATA",
        );
      }
      throw err;
    }
  });

export async function assertEvfolyamId(evfolyamId: string) {
  const [row] = await db
    .select({ evfolyamId: evfolyam.evfolyamId })
    .from(evfolyam)
    .where(eq(evfolyam.evfolyamId, evfolyamId))
    .limit(1);
  if (!row) throw new NotFoundError("Az évfolyam nem található.");
}
