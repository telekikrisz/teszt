import { zValidator } from "@hono/zod-validator";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import { createTopicSchema, updateTopicSchema } from "@oktateszt/shared";
import { db } from "../db/index.js";
import { questions, subjects, topics } from "../db/schema.js";
import { ConflictError, NotFoundError } from "../lib/errors.js";
import { getUser, requireStaff } from "../middleware/requireAuth.js";
import { archiveTopic } from "../services/archive.js";
import type { AppEnv } from "../types.js";

export const topicRoutes = new Hono<AppEnv>()
  .use("*", requireStaff)
  .get("/", async (c) => {
    const subjectId = c.req.query("subjectId");
    const rows = await db
      .select({
        id: topics.id,
        subjectId: topics.subjectId,
        subjectName: subjects.name,
        name: topics.name,
        description: topics.description,
        createdAt: topics.createdAt,
        updatedAt: topics.updatedAt,
        questionCount: sql<number>`(select count(*)::int from ${questions} where ${questions.topicId} = ${topics.id} and ${questions.archivedAt} is null)`,
      })
      .from(topics)
      .innerJoin(subjects, eq(topics.subjectId, subjects.id))
      .where(
        and(
          isNull(topics.archivedAt),
          subjectId ? eq(topics.subjectId, subjectId) : undefined,
        ),
      )
      .orderBy(asc(subjects.name), asc(topics.name));
    return c.json({ topics: rows });
  })
  .get("/:id", async (c) => {
    const id = c.req.param("id");
    const rows = await db.select().from(topics).where(eq(topics.id, id)).limit(1);
    const topic = rows[0];
    if (!topic) throw new NotFoundError("A témakör nem található.");
    return c.json({ topic });
  })
  .post("/", zValidator("json", createTopicSchema), async (c) => {
    const input = c.req.valid("json");
    await assertSubject(input.subjectId);
    const user = getUser(c);
    try {
      const [created] = await db
        .insert(topics)
        .values({ ...input, createdById: user.id })
        .returning();
      return c.json({ topic: created }, 201);
    } catch (err) {
      throw uniqueOrThrow(err, "Ezen a tantárgyon belül már létezik ilyen nevű témakör.");
    }
  })
  .patch("/:id", zValidator("json", updateTopicSchema), async (c) => {
    const id = c.req.param("id");
    const input = c.req.valid("json");
    if (input.subjectId) await assertSubject(input.subjectId);
    try {
      const [updated] = await db
        .update(topics)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(topics.id, id))
        .returning();
      if (!updated) throw new NotFoundError("A témakör nem található.");
      return c.json({ topic: updated });
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw uniqueOrThrow(err, "Ezen a tantárgyon belül már létezik ilyen nevű témakör.");
    }
  })
  .delete("/:id", async (c) => {
    await archiveTopic(c.req.param("id"));
    return c.json({ ok: true, archived: true });
  });

async function assertSubject(subjectId: string) {
  const rows = await db
    .select({ id: subjects.id })
    .from(subjects)
    .where(and(eq(subjects.id, subjectId), isNull(subjects.archivedAt)))
    .limit(1);
  if (!rows[0]) throw new NotFoundError("A tantárgy nem található.");
}

function uniqueOrThrow(err: unknown, message: string): never {
  if (typeof err === "object" && err && "code" in err && (err as { code: string }).code === "23505") {
    throw new ConflictError(message);
  }
  throw err;
}
