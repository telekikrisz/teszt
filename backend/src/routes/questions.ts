import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, ilike, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import { createQuestionSchema, questionFilterSchema, updateQuestionSchema } from "@oktateszt/shared";
import { db } from "../db/index.js";
import { answers, branches, questions, subjects, topics } from "../db/schema.js";
import { NotFoundError, ValidationAppError } from "../lib/errors.js";
import { getUser, requireStaff } from "../middleware/requireAuth.js";
import { archiveQuestion } from "../services/archive.js";
import type { AppEnv } from "../types.js";

export const questionRoutes = new Hono<AppEnv>()
  .use("*", requireStaff)
  .get("/", zValidator("query", questionFilterSchema), async (c) => {
    const filters = c.req.valid("query");
    const conditions = [isNull(questions.archivedAt)];
    if (filters.topicId) conditions.push(eq(questions.topicId, filters.topicId));
    if (filters.subjectId) conditions.push(eq(topics.subjectId, filters.subjectId));
    if (filters.branchId) conditions.push(eq(subjects.branchId, filters.branchId));
    if (filters.q) conditions.push(ilike(questions.text, `%${filters.q}%`));

    const rows = await db
      .select({
        id: questions.id,
        topicId: questions.topicId,
        topicName: topics.name,
        subjectId: subjects.id,
        subjectName: subjects.name,
        branchId: branches.id,
        branchName: branches.name,
        type: questions.type,
        text: questions.text,
        createdAt: questions.createdAt,
        updatedAt: questions.updatedAt,
        answerCount: sql<number>`(select count(*)::int from ${answers} where ${answers.questionId} = ${questions.id})`,
      })
      .from(questions)
      .innerJoin(topics, eq(questions.topicId, topics.id))
      .innerJoin(subjects, eq(topics.subjectId, subjects.id))
      .innerJoin(branches, eq(subjects.branchId, branches.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(questions.createdAt));

    return c.json({ questions: rows });
  })
  .get("/:id", async (c) => {
    const question = await loadQuestion(c.req.param("id"));
    return c.json({ question });
  })
  .post("/", zValidator("json", createQuestionSchema), async (c) => {
    const input = c.req.valid("json");
    await assertTopic(input.topicId);
    const user = getUser(c);
    const created = await db.transaction(async (tx) => {
      const [question] = await tx
        .insert(questions)
        .values({
          topicId: input.topicId,
          type: input.type,
          text: input.text,
          createdById: user.id,
        })
        .returning();
      if (!question) throw new ValidationAppError("A kérdés mentése sikertelen.");
      await tx.insert(answers).values(
        input.answers.map((answer, idx) => ({
          questionId: question.id,
          text: answer.text,
          isCorrect: answer.isCorrect,
          orderIndex: idx,
        })),
      );
      return question;
    });
    return c.json({ question: await loadQuestion(created.id) }, 201);
  })
  .patch("/:id", zValidator("json", updateQuestionSchema), async (c) => {
    const id = c.req.param("id");
    const input = c.req.valid("json");
    await assertTopic(input.topicId);
    const existing = await db.select({ id: questions.id }).from(questions).where(eq(questions.id, id)).limit(1);
    if (!existing[0]) throw new NotFoundError("A kérdés nem található.");

    await db.transaction(async (tx) => {
      await tx
        .update(questions)
        .set({
          topicId: input.topicId,
          type: input.type,
          text: input.text,
          updatedAt: new Date(),
        })
        .where(eq(questions.id, id));
      await tx.delete(answers).where(eq(answers.questionId, id));
      await tx.insert(answers).values(
        input.answers.map((answer, idx) => ({
          questionId: id,
          text: answer.text,
          isCorrect: answer.isCorrect,
          orderIndex: idx,
        })),
      );
    });

    return c.json({ question: await loadQuestion(id) });
  })
  .delete("/:id", async (c) => {
    await archiveQuestion(c.req.param("id"));
    return c.json({ ok: true, archived: true });
  });

async function assertTopic(topicId: string) {
  const rows = await db
    .select({ id: topics.id })
    .from(topics)
    .where(and(eq(topics.id, topicId), isNull(topics.archivedAt)))
    .limit(1);
  if (!rows[0]) throw new NotFoundError("A témakör nem található.");
}

async function loadQuestion(id: string) {
  const rows = await db
    .select({
      id: questions.id,
      topicId: questions.topicId,
      topicName: topics.name,
      subjectId: subjects.id,
      subjectName: subjects.name,
      type: questions.type,
      text: questions.text,
      createdAt: questions.createdAt,
      updatedAt: questions.updatedAt,
    })
    .from(questions)
    .innerJoin(topics, eq(questions.topicId, topics.id))
    .innerJoin(subjects, eq(topics.subjectId, subjects.id))
    .where(eq(questions.id, id))
    .limit(1);

  const question = rows[0];
  if (!question) throw new NotFoundError("A kérdés nem található.");

  const answerRows = await db
    .select()
    .from(answers)
    .where(eq(answers.questionId, id))
    .orderBy(answers.orderIndex);

  return { ...question, answers: answerRows };
}
