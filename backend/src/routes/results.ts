import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { resultsFilterSchema } from "@oktateszt/shared";
import { db } from "../db/index.js";
import {
  attemptAnswers,
  testAttempts,
  testQuestionAnswers,
  testQuestions,
  tests,
  users,
} from "../db/schema.js";
import { NotFoundError } from "../lib/errors.js";
import { requireStaff } from "../middleware/requireAuth.js";
import type { AppEnv } from "../types.js";

export const resultRoutes = new Hono<AppEnv>()
  .use("*", requireStaff)
  .get("/", zValidator("query", resultsFilterSchema), async (c) => {
    const filters = c.req.valid("query");
    const conditions = [eq(testAttempts.status, "SUBMITTED")];
    if (filters.testId) conditions.push(eq(testAttempts.testId, filters.testId));
    if (filters.studentId) conditions.push(eq(testAttempts.studentId, filters.studentId));

    const rows = await db
      .select({
        id: testAttempts.id,
        testId: testAttempts.testId,
        testTitle: tests.title,
        studentId: users.id,
        studentName: users.name,
        studentEmail: users.email,
        startedAt: testAttempts.startedAt,
        submittedAt: testAttempts.submittedAt,
        score: testAttempts.score,
        maxScore: testAttempts.maxScore,
        percentScore: testAttempts.percentScore,
      })
      .from(testAttempts)
      .innerJoin(tests, eq(testAttempts.testId, tests.id))
      .innerJoin(users, eq(testAttempts.studentId, users.id))
      .where(and(...conditions))
      .orderBy(desc(testAttempts.submittedAt));

    return c.json({ results: rows });
  })
  .get("/tests/:testId", async (c) => {
    const testId = c.req.param("testId");
    const testRows = await db.select().from(tests).where(eq(tests.id, testId)).limit(1);
    if (!testRows[0]) throw new NotFoundError("A teszt nem található.");

    const rows = await db
      .select({
        id: testAttempts.id,
        studentId: users.id,
        studentName: users.name,
        studentEmail: users.email,
        startedAt: testAttempts.startedAt,
        submittedAt: testAttempts.submittedAt,
        status: testAttempts.status,
        score: testAttempts.score,
        maxScore: testAttempts.maxScore,
        percentScore: testAttempts.percentScore,
      })
      .from(testAttempts)
      .innerJoin(users, eq(testAttempts.studentId, users.id))
      .where(eq(testAttempts.testId, testId))
      .orderBy(desc(testAttempts.startedAt));

    return c.json({ test: testRows[0], attempts: rows });
  })
  .get("/students/:studentId", async (c) => {
    const studentId = c.req.param("studentId");
    const studentRows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, studentId))
      .limit(1);
    const student = studentRows[0];
    if (!student) throw new NotFoundError("A tanuló nem található.");

    const rows = await db
      .select({
        id: testAttempts.id,
        testId: tests.id,
        testTitle: tests.title,
        startedAt: testAttempts.startedAt,
        submittedAt: testAttempts.submittedAt,
        status: testAttempts.status,
        score: testAttempts.score,
        maxScore: testAttempts.maxScore,
        percentScore: testAttempts.percentScore,
      })
      .from(testAttempts)
      .innerJoin(tests, eq(testAttempts.testId, tests.id))
      .where(eq(testAttempts.studentId, studentId))
      .orderBy(desc(testAttempts.startedAt));

    return c.json({ student, attempts: rows });
  })
  .get("/attempts/:attemptId", async (c) => {
    const attemptId = c.req.param("attemptId");
    const attemptRows = await db
      .select({
        id: testAttempts.id,
        testId: tests.id,
        testTitle: tests.title,
        studentId: users.id,
        studentName: users.name,
        studentEmail: users.email,
        startedAt: testAttempts.startedAt,
        submittedAt: testAttempts.submittedAt,
        status: testAttempts.status,
        score: testAttempts.score,
        maxScore: testAttempts.maxScore,
        percentScore: testAttempts.percentScore,
        questionOrder: testAttempts.questionOrder,
      })
      .from(testAttempts)
      .innerJoin(tests, eq(testAttempts.testId, tests.id))
      .innerJoin(users, eq(testAttempts.studentId, users.id))
      .where(eq(testAttempts.id, attemptId))
      .limit(1);

    const attempt = attemptRows[0];
    if (!attempt) throw new NotFoundError("A kitöltés nem található.");

    const questionRows = await db
      .select()
      .from(testQuestions)
      .where(eq(testQuestions.testId, attempt.testId))
      .orderBy(testQuestions.orderIndex);

    const questionIds = questionRows.map((q) => q.id);
    const answerRows = questionIds.length
      ? await db
          .select()
          .from(testQuestionAnswers)
          .where(inArray(testQuestionAnswers.testQuestionId, questionIds))
          .orderBy(testQuestionAnswers.orderIndex)
      : [];

    const saved = await db
      .select()
      .from(attemptAnswers)
      .where(eq(attemptAnswers.attemptId, attemptId));

    const savedByQuestion = new Map(saved.map((s) => [s.testQuestionId, s]));
    const answersByQuestion = new Map<string, typeof answerRows>();
    for (const answer of answerRows) {
      const list = answersByQuestion.get(answer.testQuestionId) ?? [];
      list.push(answer);
      answersByQuestion.set(answer.testQuestionId, list);
    }

    const order = attempt.questionOrder.length
      ? attempt.questionOrder
      : questionRows.map((q) => q.id);
    const byId = new Map(questionRows.map((q) => [q.id, q]));

    const details = order.flatMap((qid, index) => {
      const question = byId.get(qid);
      if (!question) return [];
      const options = answersByQuestion.get(qid) ?? [];
      const correct = options.find((a) => a.isCorrect);
      const given = savedByQuestion.get(qid);
      const selected = options.find((a) => a.id === given?.selectedAnswerId);
      return [
        {
          index: index + 1,
          questionId: question.id,
          text: question.text,
          topicName: question.topicNameSnapshot,
          studentAnswer: selected
            ? { id: selected.id, text: selected.text, label: letterFor(options, selected.id) }
            : given?.selectedAnswerText
              ? { id: null, text: given.selectedAnswerText, label: "?" }
              : null,
          correctAnswer: correct
            ? { id: correct.id, text: correct.text, label: letterFor(options, correct.id) }
            : null,
          isCorrect: given?.isCorrect ?? false,
          answeredAt: given?.answeredAt ?? null,
          answers: options.map((a) => ({
            id: a.id,
            text: a.text,
            isCorrect: a.isCorrect,
            label: letterFor(options, a.id),
          })),
        },
      ];
    });

    return c.json({
      attempt: {
        id: attempt.id,
        testId: attempt.testId,
        testTitle: attempt.testTitle,
        studentId: attempt.studentId,
        studentName: attempt.studentName,
        studentEmail: attempt.studentEmail,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        status: attempt.status,
        score: attempt.score,
        maxScore: attempt.maxScore,
        percentScore: attempt.percentScore,
      },
      questions: details,
    });
  });

function letterFor(options: { id: string }[], id: string): string {
  const idx = options.findIndex((o) => o.id === id);
  return idx >= 0 ? String.fromCharCode(65 + idx) : "?";
}
