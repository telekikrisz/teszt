import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { saveAttemptAnswerSchema, startAttemptSchema } from "@oktateszt/shared";
import { db } from "../db/index.js";
import {
  attemptAnswers,
  testAttempts,
  testQuestionAnswers,
  testQuestions,
  tests,
} from "../db/schema.js";
import { utcNow } from "../lib/crypto.js";
import { AppError, ForbiddenError, NotFoundError } from "../lib/errors.js";
import { getUser, requireAuth, requireStudent } from "../middleware/requireAuth.js";
import { evaluateAttempt } from "../services/evaluation.js";
import { applyShuffle, buildShuffledAttempt } from "../services/shuffle.js";
import { loadQuestionsWithoutCorrect } from "../services/demoPreview.js";
import type { AppEnv } from "../types.js";

export const attemptRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .get("/", requireStudent, async (c) => {
    const user = getUser(c);
    const testId = c.req.query("testId");
    const rows = await db
      .select({
        id: testAttempts.id,
        testId: testAttempts.testId,
        testTitle: tests.title,
        status: testAttempts.status,
        startedAt: testAttempts.startedAt,
        submittedAt: testAttempts.submittedAt,
        score: testAttempts.score,
        maxScore: testAttempts.maxScore,
        percentScore: testAttempts.percentScore,
      })
      .from(testAttempts)
      .innerJoin(tests, eq(testAttempts.testId, tests.id))
      .where(
        and(eq(testAttempts.studentId, user.id), testId ? eq(testAttempts.testId, testId) : undefined),
      )
      .orderBy(desc(testAttempts.startedAt));
    return c.json({ attempts: rows });
  })
  .post("/", requireStudent, zValidator("json", startAttemptSchema), async (c) => {
    const user = getUser(c);
    const { testId } = c.req.valid("json");
    const test = await getPublishedTest(testId);

    const snapshot = await loadQuestionsWithoutCorrect(test.id);
    const shuffled = buildShuffledAttempt(snapshot);

    const [attempt] = await db
      .insert(testAttempts)
      .values({
        testId: test.id,
        studentId: user.id,
        status: "IN_PROGRESS",
        startedAt: utcNow(),
        questionOrder: shuffled.questionOrder,
        answerOrders: shuffled.answerOrders,
      })
      .returning();

    if (!attempt) {
      throw new AppError(500, "A tesztkitöltés indítása sikertelen.", "ATTEMPT_START_FAILED");
    }

    return c.json({ attempt: await serializeStudentAttempt(attempt.id, user.id) }, 201);
  })
  .get("/:id", async (c) => {
    const user = getUser(c);
    return c.json({ attempt: await serializeStudentAttempt(c.req.param("id"), user.id, user.role) });
  })
  .post("/:id/answers", requireStudent, zValidator("json", saveAttemptAnswerSchema), async (c) => {
    const user = getUser(c);
    const attempt = await getOwnInProgressAttempt(c.req.param("id"), user.id);
    const { testQuestionId, testQuestionAnswerId } = c.req.valid("json");

    const questionRows = await db
      .select()
      .from(testQuestions)
      .where(and(eq(testQuestions.id, testQuestionId), eq(testQuestions.testId, attempt.testId)))
      .limit(1);
    const question = questionRows[0];
    if (!question) {
      throw new AppError(400, "A kérdés nem tartozik ehhez a teszthez.", "INVALID_QUESTION");
    }

    const answerRows = await db
      .select()
      .from(testQuestionAnswers)
      .where(
        and(
          eq(testQuestionAnswers.id, testQuestionAnswerId),
          eq(testQuestionAnswers.testQuestionId, testQuestionId),
        ),
      )
      .limit(1);
    const answer = answerRows[0];
    if (!answer) {
      throw new AppError(400, "A válasz nem tartozik ehhez a kérdéshez.", "INVALID_ANSWER");
    }

    const now = utcNow();
    await db
      .insert(attemptAnswers)
      .values({
        attemptId: attempt.id,
        testQuestionId,
        selectedAnswerId: answer.id,
        selectedAnswerText: answer.text,
        isCorrect: answer.isCorrect,
        answeredAt: now,
      })
      .onConflictDoUpdate({
        target: [attemptAnswers.attemptId, attemptAnswers.testQuestionId],
        set: {
          selectedAnswerId: answer.id,
          selectedAnswerText: answer.text,
          isCorrect: answer.isCorrect,
          answeredAt: now,
        },
      });

    await db.update(testAttempts).set({ updatedAt: now }).where(eq(testAttempts.id, attempt.id));

    return c.json({ ok: true });
  })
  .post("/:id/submit", requireStudent, async (c) => {
    const user = getUser(c);
    const attempt = await getOwnInProgressAttempt(c.req.param("id"), user.id);

    const questionRows = await db
      .select({ id: testQuestions.id })
      .from(testQuestions)
      .where(eq(testQuestions.testId, attempt.testId));

    const answerRows = await db
      .select({
        id: testQuestionAnswers.id,
        testQuestionId: testQuestionAnswers.testQuestionId,
        isCorrect: testQuestionAnswers.isCorrect,
      })
      .from(testQuestionAnswers)
      .innerJoin(testQuestions, eq(testQuestionAnswers.testQuestionId, testQuestions.id))
      .where(eq(testQuestions.testId, attempt.testId));

    const saved = await db
      .select()
      .from(attemptAnswers)
      .where(eq(attemptAnswers.attemptId, attempt.id));

    const questionsForEval = questionRows.map((q) => ({
      id: q.id,
      answers: answerRows
        .filter((a) => a.testQuestionId === q.id)
        .map((a) => ({ id: a.id, isCorrect: a.isCorrect })),
    }));

    const result = evaluateAttempt(
      questionsForEval,
      saved.map((s) => ({
        testQuestionId: s.testQuestionId,
        selectedAnswerId: s.selectedAnswerId,
      })),
    );

    const now = utcNow();
    await db.transaction(async (tx) => {
      for (const detail of result.answers) {
        if (!detail.selectedAnswerId) continue;
        await tx
          .update(attemptAnswers)
          .set({ isCorrect: detail.isCorrect })
          .where(
            and(
              eq(attemptAnswers.attemptId, attempt.id),
              eq(attemptAnswers.testQuestionId, detail.testQuestionId),
            ),
          );
      }

      await tx
        .update(testAttempts)
        .set({
          status: "SUBMITTED",
          submittedAt: now,
          score: result.score,
          maxScore: result.maxScore,
          percentScore: result.percentScore,
          updatedAt: now,
        })
        .where(eq(testAttempts.id, attempt.id));
    });

    return c.json({
      result: {
        attemptId: attempt.id,
        testId: attempt.testId,
        score: result.score,
        maxScore: result.maxScore,
        percentScore: result.percentScore,
        submittedAt: now,
      },
    });
  });

async function getPublishedTest(id: string) {
  const rows = await db.select().from(tests).where(eq(tests.id, id)).limit(1);
  const test = rows[0];
  if (!test || test.status !== "PUBLISHED") {
    throw new NotFoundError("A teszt nem elérhető.");
  }
  return test;
}

async function getOwnInProgressAttempt(id: string, studentId: string) {
  const rows = await db.select().from(testAttempts).where(eq(testAttempts.id, id)).limit(1);
  const attempt = rows[0];
  if (!attempt) throw new NotFoundError("A kitöltés nem található.");
  if (attempt.studentId !== studentId) {
    throw new ForbiddenError("Ez a kitöltés nem a tied.");
  }
  if (attempt.status !== "IN_PROGRESS") {
    throw new AppError(409, "Ez a kitöltés már lezárult.", "ATTEMPT_NOT_ACTIVE");
  }
  return attempt;
}

async function serializeStudentAttempt(attemptId: string, userId: string, role: "admin" | "teacher" | "student" = "student") {
  const rows = await db.select().from(testAttempts).where(eq(testAttempts.id, attemptId)).limit(1);
  const attempt = rows[0];
  if (!attempt) throw new NotFoundError("A kitöltés nem található.");
  if (role === "student" && attempt.studentId !== userId) {
    throw new ForbiddenError("Ez a kitöltés nem a tied.");
  }

  const testRows = await db.select().from(tests).where(eq(tests.id, attempt.testId)).limit(1);
  const test = testRows[0];
  if (!test) throw new NotFoundError("A teszt nem található.");

  const snapshot = await loadQuestionsWithoutCorrect(attempt.testId);
  const shuffled = applyShuffle(snapshot, attempt.questionOrder, attempt.answerOrders);

  const saved = await db
    .select({
      testQuestionId: attemptAnswers.testQuestionId,
      selectedAnswerId: attemptAnswers.selectedAnswerId,
    })
    .from(attemptAnswers)
    .where(eq(attemptAnswers.attemptId, attempt.id));

  const selectedByQuestion = new Map(saved.map((s) => [s.testQuestionId, s.selectedAnswerId]));

  const studentPayload = {
    id: attempt.id,
    testId: attempt.testId,
    testTitle: test.title,
    status: attempt.status,
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
    percentScore: attempt.status === "SUBMITTED" ? attempt.percentScore : null,
    score: attempt.status === "SUBMITTED" ? attempt.score : null,
    maxScore: attempt.status === "SUBMITTED" ? attempt.maxScore : null,
    questions: shuffled.map((q, index) => ({
      id: q.id,
      index: index + 1,
      text: q.text,
      selectedAnswerId: selectedByQuestion.get(q.id) ?? null,
      answers: q.answers.map((a) => ({ id: a.id, text: a.text })),
    })),
  };

  return studentPayload;
}
