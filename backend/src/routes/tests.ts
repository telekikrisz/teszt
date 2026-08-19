import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { createTestSchema, demoEvaluateSchema, testListFilterSchema, updateTestSchema } from "@oktateszt/shared";
import { db } from "../db/index.js";
import {
  subjects,
  testAttempts,
  testQuestionAnswers,
  testQuestions,
  tests,
  testTopicConfigs,
  users,
} from "../db/schema.js";
import { AppError, NotFoundError } from "../lib/errors.js";
import { utcNow } from "../lib/crypto.js";
import { getUser, requireStaff, requireAuth, requireTeacher } from "../middleware/requireAuth.js";
import { archiveTest } from "../services/archive.js";
import { generateTest, getTopicQuestionCounts } from "../services/testGeneration.js";
import { buildTeacherDemo, evaluateTeacherDemo } from "../services/demoPreview.js";
import type { AppEnv } from "../types.js";

export const testRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .get("/meta/topic-counts", requireStaff, async (c) => {
    const subjectId = c.req.query("subjectId");
    if (!subjectId) throw new AppError(400, "A subjectId megadása kötelező.", "VALIDATION_ERROR");
    const rows = await getTopicQuestionCounts(subjectId);
    return c.json({ topics: rows });
  })
  .get("/", zValidator("query", testListFilterSchema), async (c) => {
    const user = getUser(c);
    const filters = c.req.valid("query");
    const conditions = [];

    if (user.role === "student") {
      conditions.push(eq(tests.status, "PUBLISHED"));
    } else if (filters.status) {
      conditions.push(eq(tests.status, filters.status));
    }
    if (filters.subjectId) conditions.push(eq(tests.subjectId, filters.subjectId));

    const rows = await db
      .select({
        id: tests.id,
        title: tests.title,
        description: tests.description,
        subjectId: tests.subjectId,
        subjectName: subjects.name,
        status: tests.status,
        createdById: tests.createdById,
        createdByName: users.name,
        createdAt: tests.createdAt,
        publishedAt: tests.publishedAt,
        closedAt: tests.closedAt,
        archivedAt: tests.archivedAt,
        questionCount: sql<number>`(select count(*)::int from ${testQuestions} where ${testQuestions.testId} = ${tests.id})`,
        attemptCount: sql<number>`(select count(*)::int from ${testAttempts} where ${testAttempts.testId} = ${tests.id})`,
      })
      .from(tests)
      .innerJoin(subjects, eq(tests.subjectId, subjects.id))
      .innerJoin(users, eq(tests.createdById, users.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(tests.createdAt));

    return c.json({ tests: rows });
  })
  .get("/:id/demo", requireTeacher, async (c) => {
    const demo = await buildTeacherDemo(c.req.param("id"));
    return c.json({ demo });
  })
  .post("/:id/demo/evaluate", requireTeacher, zValidator("json", demoEvaluateSchema), async (c) => {
    const result = await evaluateTeacherDemo(
      c.req.param("id"),
      c.req.valid("json").answers.map((a) => ({
        testQuestionId: a.testQuestionId,
        selectedAnswerId: a.testQuestionAnswerId,
      })),
    );
    return c.json({ result });
  })
  .get("/:id", async (c) => {
    const user = getUser(c);
    const test = await loadTest(c.req.param("id"));
    if (user.role === "student") {
      if (test.status !== "PUBLISHED") {
        throw new NotFoundError("A teszt nem elérhető.");
      }
      return c.json({
        test: {
          id: test.id,
          title: test.title,
          description: test.description,
          subjectName: test.subjectName,
          status: test.status,
          questionCount: test.questions.length,
        },
      });
    }
    return c.json({ test });
  })
  .post("/", requireStaff, zValidator("json", createTestSchema), async (c) => {
    const user = getUser(c);
    const created = await generateTest(c.req.valid("json"), user.id);
    return c.json({ test: await loadTest(created.id) }, 201);
  })
  .patch("/:id", requireStaff, zValidator("json", updateTestSchema), async (c) => {
    const id = c.req.param("id");
    const existing = await getTestRow(id);
    if (existing.status !== "DRAFT") {
      throw new AppError(409, "Csak piszkozat teszt címe/leírása módosítható.", "TEST_NOT_DRAFT");
    }
    const [updated] = await db
      .update(tests)
      .set({ ...c.req.valid("json"), updatedAt: utcNow() })
      .where(eq(tests.id, id))
      .returning();
    return c.json({ test: updated });
  })
  .post("/:id/publish", requireStaff, async (c) => {
    const id = c.req.param("id");
    const existing = await getTestRow(id);
    if (existing.status !== "DRAFT") {
      throw new AppError(409, "Csak piszkozat teszt publikálható.", "INVALID_STATUS");
    }
    const questionCount = await countQuestions(id);
    if (questionCount === 0) {
      throw new AppError(400, "Üres teszt nem publikálható.", "EMPTY_TEST");
    }
    const now = utcNow();
    const [updated] = await db
      .update(tests)
      .set({ status: "PUBLISHED", publishedAt: now, updatedAt: now })
      .where(eq(tests.id, id))
      .returning();
    return c.json({ test: updated });
  })
  .post("/:id/close", requireStaff, async (c) => {
    const id = c.req.param("id");
    const existing = await getTestRow(id);
    if (existing.status !== "PUBLISHED") {
      throw new AppError(409, "Csak publikált teszt zárható le.", "INVALID_STATUS");
    }
    const now = utcNow();
    const [updated] = await db
      .update(tests)
      .set({ status: "CLOSED", closedAt: now, updatedAt: now })
      .where(eq(tests.id, id))
      .returning();
    return c.json({ test: updated });
  })
  .post("/:id/archive", requireStaff, async (c) => {
    const updated = await archiveTest(c.req.param("id"), "manual");
    return c.json({ test: updated });
  });

async function getTestRow(id: string) {
  const rows = await db.select().from(tests).where(eq(tests.id, id)).limit(1);
  const test = rows[0];
  if (!test) throw new NotFoundError("A teszt nem található.");
  return test;
}

async function countQuestions(testId: string) {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(testQuestions)
    .where(eq(testQuestions.testId, testId));
  return Number(rows[0]?.count ?? 0);
}

async function loadTest(id: string) {
  const rows = await db
    .select({
      id: tests.id,
      title: tests.title,
      description: tests.description,
      subjectId: tests.subjectId,
      subjectName: subjects.name,
      status: tests.status,
      createdById: tests.createdById,
      createdByName: users.name,
      createdAt: tests.createdAt,
      updatedAt: tests.updatedAt,
      publishedAt: tests.publishedAt,
      closedAt: tests.closedAt,
      archivedAt: tests.archivedAt,
    })
    .from(tests)
    .innerJoin(subjects, eq(tests.subjectId, subjects.id))
    .innerJoin(users, eq(tests.createdById, users.id))
    .where(eq(tests.id, id))
    .limit(1);

  const test = rows[0];
  if (!test) throw new NotFoundError("A teszt nem található.");

  const configs = await db
    .select()
    .from(testTopicConfigs)
    .where(eq(testTopicConfigs.testId, id));

  const questionRows = await db
    .select()
    .from(testQuestions)
    .where(eq(testQuestions.testId, id))
    .orderBy(testQuestions.orderIndex);

  const answerRows = questionRows.length
    ? await db
        .select()
        .from(testQuestionAnswers)
        .where(inArray(testQuestionAnswers.testQuestionId, questionRows.map((q) => q.id)))
        .orderBy(testQuestionAnswers.orderIndex)
    : [];

  const answersByQuestion = new Map<string, typeof answerRows>();
  for (const answer of answerRows) {
    const list = answersByQuestion.get(answer.testQuestionId) ?? [];
    list.push(answer);
    answersByQuestion.set(answer.testQuestionId, list);
  }

  return {
    ...test,
    topicConfigs: configs,
    questions: questionRows.map((q) => ({
      ...q,
      answers: answersByQuestion.get(q.id) ?? [],
    })),
  };
}
