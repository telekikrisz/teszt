import { zValidator } from "@hono/zod-validator";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import { createSubjectSchema, updateSubjectSchema } from "@oktateszt/shared";
import { db } from "../db/index.js";
import { branches, subjects, topics } from "../db/schema.js";
import { ConflictError, NotFoundError } from "../lib/errors.js";
import { getUser, requireStaff } from "../middleware/requireAuth.js";
import { archiveSubject } from "../services/archive.js";
import type { AppEnv } from "../types.js";

export const subjectRoutes = new Hono<AppEnv>()
  .use("*", requireStaff)
  .get("/", async (c) => {
    const branchId = c.req.query("branchId");
    const rows = await db
      .select({
        id: subjects.id,
        branchId: subjects.branchId,
        branchName: branches.name,
        name: subjects.name,
        description: subjects.description,
        createdAt: subjects.createdAt,
        updatedAt: subjects.updatedAt,
        topicCount: sql<number>`(select count(*)::int from ${topics} where ${topics.subjectId} = ${subjects.id} and ${topics.archivedAt} is null)`,
      })
      .from(subjects)
      .innerJoin(branches, eq(subjects.branchId, branches.id))
      .where(
        and(
          isNull(subjects.archivedAt),
          branchId ? eq(subjects.branchId, branchId) : undefined,
        ),
      )
      .orderBy(asc(branches.name), asc(subjects.name));
    return c.json({ subjects: rows });
  })
  .get("/:id", async (c) => {
    const id = c.req.param("id");
    const rows = await db.select().from(subjects).where(eq(subjects.id, id)).limit(1);
    const subject = rows[0];
    if (!subject) throw new NotFoundError("A tantárgy nem található.");
    return c.json({ subject });
  })
  .post("/", zValidator("json", createSubjectSchema), async (c) => {
    const input = c.req.valid("json");
    await assertBranch(input.branchId);
    const user = getUser(c);
    try {
      const [created] = await db
        .insert(subjects)
        .values({ ...input, createdById: user.id })
        .returning();
      return c.json({ subject: created }, 201);
    } catch (err) {
      throw uniqueOrThrow(err, "Ezen az ágazaton belül már létezik ilyen nevű tantárgy.");
    }
  })
  .patch("/:id", zValidator("json", updateSubjectSchema), async (c) => {
    const id = c.req.param("id");
    const input = c.req.valid("json");
    if (input.branchId) await assertBranch(input.branchId);
    try {
      const [updated] = await db
        .update(subjects)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(subjects.id, id))
        .returning();
      if (!updated) throw new NotFoundError("A tantárgy nem található.");
      return c.json({ subject: updated });
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw uniqueOrThrow(err, "Ezen az ágazaton belül már létezik ilyen nevű tantárgy.");
    }
  })
  .delete("/:id", async (c) => {
    await archiveSubject(c.req.param("id"));
    return c.json({ ok: true, archived: true });
  });

async function assertBranch(branchId: string) {
  const rows = await db
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.id, branchId), isNull(branches.archivedAt)))
    .limit(1);
  if (!rows[0]) throw new NotFoundError("Az ágazat nem található.");
}

function uniqueOrThrow(err: unknown, message: string): never {
  if (typeof err === "object" && err && "code" in err && (err as { code: string }).code === "23505") {
    throw new ConflictError(message);
  }
  throw err;
}
