import { zValidator } from "@hono/zod-validator";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import { createBranchSchema, updateBranchSchema } from "@oktateszt/shared";
import { db } from "../db/index.js";
import { branches, subjects } from "../db/schema.js";
import { AppError, ConflictError, NotFoundError } from "../lib/errors.js";
import { requireAdmin, requireStaff } from "../middleware/requireAuth.js";
import { archiveBranch } from "../services/archive.js";
import type { AppEnv } from "../types.js";

export const branchRoutes = new Hono<AppEnv>()
  .use("*", requireStaff)
  .get("/", async (c) => {
    const includeArchived = c.req.query("archived") === "1";
    const rows = await db
      .select({
        id: branches.id,
        name: branches.name,
        createdAt: branches.createdAt,
        archivedAt: branches.archivedAt,
        archiveReason: branches.archiveReason,
        subjectCount: sql<number>`(
          select count(*)::int from ${subjects}
          where ${subjects.branchId} = ${branches.id}
            and ${subjects.archivedAt} is null
        )`,
      })
      .from(branches)
      .where(includeArchived ? undefined : isNull(branches.archivedAt))
      .orderBy(asc(branches.name));
    return c.json({ branches: rows });
  })
  .get("/:id", async (c) => {
    const id = c.req.param("id");
    const rows = await db.select().from(branches).where(eq(branches.id, id)).limit(1);
    const branch = rows[0];
    if (!branch) throw new NotFoundError("Az ágazat nem található.");
    return c.json({ branch });
  })
  .post("/", requireAdmin, zValidator("json", createBranchSchema), async (c) => {
    const input = c.req.valid("json");
    try {
      const [created] = await db.insert(branches).values({ name: input.name }).returning();
      return c.json({ branch: created }, 201);
    } catch (err) {
      throw uniqueOrThrow(err, "Már létezik ilyen nevű aktív ágazat.");
    }
  })
  .patch("/:id", requireAdmin, zValidator("json", updateBranchSchema), async (c) => {
    const id = c.req.param("id");
    const input = c.req.valid("json");
    const [existing] = await db.select().from(branches).where(eq(branches.id, id)).limit(1);
    if (!existing) throw new NotFoundError("Az ágazat nem található.");
    if (existing.archivedAt) {
      throw new AppError(409, "Archivált ágazat nem módosítható.", "ALREADY_ARCHIVED");
    }
    try {
      const [updated] = await db
        .update(branches)
        .set({ name: input.name })
        .where(and(eq(branches.id, id), isNull(branches.archivedAt)))
        .returning();
      if (!updated) throw new NotFoundError("Az ágazat nem található.");
      return c.json({ branch: updated });
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw uniqueOrThrow(err, "Már létezik ilyen nevű aktív ágazat.");
    }
  })
  .delete("/:id", requireAdmin, async (c) => {
    await archiveBranch(c.req.param("id"));
    return c.json({ ok: true, archived: true });
  });

function uniqueOrThrow(err: unknown, message: string): never {
  if (typeof err === "object" && err && "code" in err && (err as { code: string }).code === "23505") {
    throw new ConflictError(message);
  }
  throw err;
}
