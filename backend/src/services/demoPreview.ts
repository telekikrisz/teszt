import { eq, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { testQuestionAnswers, testQuestions, tests } from "../db/schema.js";
import { AppError, NotFoundError } from "../lib/errors.js";
import { evaluateAttempt } from "./evaluation.js";
import { applyShuffle, buildShuffledAttempt } from "./shuffle.js";

export async function loadQuestionsWithoutCorrect(testId: string) {
  const questionRows = await db
    .select({ id: testQuestions.id, text: testQuestions.text })
    .from(testQuestions)
    .where(eq(testQuestions.testId, testId));

  const ids = questionRows.map((q) => q.id);
  const answerRows = ids.length
    ? await db
        .select({
          id: testQuestionAnswers.id,
          testQuestionId: testQuestionAnswers.testQuestionId,
          text: testQuestionAnswers.text,
        })
        .from(testQuestionAnswers)
        .where(inArray(testQuestionAnswers.testQuestionId, ids))
    : [];

  return questionRows.map((q) => ({
    id: q.id,
    text: q.text,
    answers: answerRows
      .filter((a) => a.testQuestionId === q.id)
      .map((a) => ({ id: a.id, text: a.text })),
  }));
}

export async function buildTeacherDemo(testId: string) {
  const testRows = await db.select().from(tests).where(eq(tests.id, testId)).limit(1);
  const test = testRows[0];
  if (!test) throw new NotFoundError("A teszt nem található.");
  if (test.status !== "DRAFT" && test.status !== "PUBLISHED") {
    throw new AppError(409, "Csak piszkozat vagy publikált teszt próbálható ki.", "TEST_NOT_TRYABLE");
  }

  const questions = await loadQuestionsWithoutCorrect(testId);
  const shuffled = buildShuffledAttempt(questions);
  const ordered = applyShuffle(questions, shuffled.questionOrder, shuffled.answerOrders);

  return {
    testId: test.id,
    testTitle: test.title,
    questions: ordered.map((q, index) => ({
      id: q.id,
      index: index + 1,
      text: q.text,
      selectedAnswerId: null as string | null,
      answers: q.answers.map((a) => ({ id: a.id, text: a.text })),
    })),
  };
}

export async function evaluateTeacherDemo(
  testId: string,
  responses: { testQuestionId: string; selectedAnswerId: string | null }[],
) {
  const testRows = await db.select().from(tests).where(eq(tests.id, testId)).limit(1);
  const test = testRows[0];
  if (!test) throw new NotFoundError("A teszt nem található.");

  const questionRows = await db
    .select({ id: testQuestions.id })
    .from(testQuestions)
    .where(eq(testQuestions.testId, testId));

  const answerRows = await db
    .select({
      id: testQuestionAnswers.id,
      testQuestionId: testQuestionAnswers.testQuestionId,
      isCorrect: testQuestionAnswers.isCorrect,
    })
    .from(testQuestionAnswers)
    .innerJoin(testQuestions, eq(testQuestionAnswers.testQuestionId, testQuestions.id))
    .where(eq(testQuestions.testId, testId));

  const result = evaluateAttempt(
    questionRows.map((q) => ({
      id: q.id,
      answers: answerRows
        .filter((a) => a.testQuestionId === q.id)
        .map((a) => ({ id: a.id, isCorrect: a.isCorrect })),
    })),
    responses,
  );

  return {
    testTitle: test.title,
    score: result.score,
    maxScore: result.maxScore,
    percentScore: result.percentScore,
  };
}
