import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { CreateTestInput } from "@oktateszt/shared";
import { db } from "../db/index.js";
import {
  answers,
  branches,
  questions,
  subjects,
  testQuestionAnswers,
  testQuestions,
  tests,
  testTopicConfigs,
  topics,
} from "../db/schema.js";
import { pickRandom } from "../lib/crypto.js";
import { AppError, NotFoundError, ValidationAppError } from "../lib/errors.js";

export type TopicAvailability = {
  topicId: string;
  name: string;
  requested: number;
  available: number;
};

export function findInsufficientTopics(items: TopicAvailability[]): TopicAvailability[] {
  return items.filter((item) => item.available < item.requested);
}

export function formatInsufficientMessage(items: TopicAvailability[]): string {
  const parts = items.map(
    (item) => `${item.name}: kérve ${item.requested}, elérhető ${item.available}`,
  );
  return `Nincs elég kérdés a következő témakörökben: ${parts.join("; ")}. A teszt nem jött létre.`;
}

/**
 * Tantárgy + témakörönkénti darabszám alapján véletlenszerű tesztet állít össze,
 * és azonnal snapshotot készít a kérdések/válaszok aktuális tartalmáról.
 */
export async function generateTest(input: CreateTestInput, createdById: string) {
  const uniqueTopicIds = [...new Set(input.topics.map((t) => t.topicId))];
  if (uniqueTopicIds.length !== input.topics.length) {
    throw new ValidationAppError("Ugyanaz a témakör többször szerepel a kérésben.");
  }

  const subjectRows = await db
    .select({
      id: subjects.id,
      archivedAt: subjects.archivedAt,
      branchArchivedAt: branches.archivedAt,
    })
    .from(subjects)
    .innerJoin(branches, eq(subjects.branchId, branches.id))
    .where(eq(subjects.id, input.subjectId))
    .limit(1);
  const subject = subjectRows[0];
  if (!subject || subject.archivedAt || subject.branchArchivedAt) {
    throw new NotFoundError("A megadott tantárgy nem található.");
  }

  const topicRows = await db
    .select()
    .from(topics)
    .where(inArray(topics.id, uniqueTopicIds));

  if (topicRows.length !== uniqueTopicIds.length) {
    throw new NotFoundError("Egy vagy több témakör nem található.");
  }

  for (const topic of topicRows) {
    if (topic.archivedAt) {
      throw new ValidationAppError(`A(z) „${topic.name}” témakör archiválva van.`);
    }
    if (topic.subjectId !== input.subjectId) {
      throw new ValidationAppError(
        `A(z) „${topic.name}” témakör nem a kiválasztott tantárgyhoz tartozik.`,
      );
    }
  }

  const countRows = await db
    .select({
      topicId: questions.topicId,
      count: sql<number>`count(*)::int`,
    })
    .from(questions)
    .where(and(inArray(questions.topicId, uniqueTopicIds), isNull(questions.archivedAt)))
    .groupBy(questions.topicId);

  const availableByTopic = new Map(countRows.map((row) => [row.topicId, Number(row.count)]));
  const topicById = new Map(topicRows.map((t) => [t.id, t]));

  const availability: TopicAvailability[] = input.topics.map((req) => {
    const topic = topicById.get(req.topicId)!;
    return {
      topicId: req.topicId,
      name: topic.name,
      requested: req.count,
      available: availableByTopic.get(req.topicId) ?? 0,
    };
  });

  const insufficient = findInsufficientTopics(availability);
  if (insufficient.length > 0) {
    throw new AppError(400, formatInsufficientMessage(insufficient), "INSUFFICIENT_QUESTIONS", {
      topics: insufficient,
    });
  }

  const selectedQuestionIds: string[] = [];
  const selectedByTopic: { topicId: string; questionIds: string[] }[] = [];

  for (const req of input.topics) {
    const pool = await db
      .select({ id: questions.id })
      .from(questions)
      .where(and(eq(questions.topicId, req.topicId), isNull(questions.archivedAt)));
    const picked = pickRandom(pool, req.count).map((q) => q.id);
    selectedQuestionIds.push(...picked);
    selectedByTopic.push({ topicId: req.topicId, questionIds: picked });
  }

  const questionRows = await db
    .select({
      id: questions.id,
      text: questions.text,
      type: questions.type,
      topicId: questions.topicId,
    })
    .from(questions)
    .where(inArray(questions.id, selectedQuestionIds));

  const answerRows = await db
    .select()
    .from(answers)
    .where(inArray(answers.questionId, selectedQuestionIds));

  const answersByQuestion = new Map<string, typeof answerRows>();
  for (const answer of answerRows) {
    const list = answersByQuestion.get(answer.questionId) ?? [];
    list.push(answer);
    answersByQuestion.set(answer.questionId, list);
  }

  const questionById = new Map(questionRows.map((q) => [q.id, q]));

  return db.transaction(async (tx) => {
    const [createdTest] = await tx
      .insert(tests)
      .values({
        title: input.title,
        description: input.description ?? "",
        subjectId: input.subjectId,
        status: "DRAFT",
        createdById,
      })
      .returning();

    if (!createdTest) {
      throw new AppError(500, "A teszt létrehozása sikertelen.", "TEST_CREATE_FAILED");
    }

    for (const req of input.topics) {
      const topic = topicById.get(req.topicId)!;
      const selected = selectedByTopic.find((s) => s.topicId === req.topicId);
      await tx.insert(testTopicConfigs).values({
        testId: createdTest.id,
        topicId: req.topicId,
        topicNameSnapshot: topic.name,
        requestedCount: req.count,
        selectedCount: selected?.questionIds.length ?? 0,
      });
    }

    let orderIndex = 0;
    for (const questionId of selectedQuestionIds) {
      const question = questionById.get(questionId);
      if (!question) continue;
      const topic = topicById.get(question.topicId);

      const [snapQuestion] = await tx
        .insert(testQuestions)
        .values({
          testId: createdTest.id,
          sourceQuestionId: question.id,
          orderIndex,
          text: question.text,
          type: question.type,
          topicNameSnapshot: topic?.name ?? "",
        })
        .returning();

      if (!snapQuestion) {
        throw new AppError(500, "A kérdés-snapshot mentése sikertelen.", "SNAPSHOT_FAILED");
      }

      const qAnswers = (answersByQuestion.get(question.id) ?? []).sort(
        (a, b) => a.orderIndex - b.orderIndex,
      );

      if (qAnswers.length < 2) {
        throw new ValidationAppError(
          `A(z) kérdés nem tartalmaz elég válaszlehetőséget, ezért a teszt nem hozható létre.`,
        );
      }

      const correctCount = qAnswers.filter((a) => a.isCorrect).length;
      if (correctCount !== 1) {
        throw new ValidationAppError(
          "Minden kérdéshez pontosan egy helyes válasznak kell tartoznia. A teszt nem jött létre.",
        );
      }

      await tx.insert(testQuestionAnswers).values(
        qAnswers.map((answer, idx) => ({
          testQuestionId: snapQuestion.id,
          sourceAnswerId: answer.id,
          text: answer.text,
          isCorrect: answer.isCorrect,
          orderIndex: idx,
        })),
      );

      orderIndex += 1;
    }

    return createdTest;
  });
}

export async function assertSubjectExists(subjectId: string) {
  const rows = await db.select({ id: subjects.id }).from(subjects).where(eq(subjects.id, subjectId));
  if (!rows[0]) throw new NotFoundError("A tantárgy nem található.");
}

export async function getTopicQuestionCounts(subjectId: string) {
  return db
    .select({
      topicId: topics.id,
      name: topics.name,
      description: topics.description,
      questionCount: sql<number>`coalesce(count(${questions.id}), 0)::int`,
    })
    .from(topics)
    .leftJoin(questions, and(eq(questions.topicId, topics.id), isNull(questions.archivedAt)))
    .where(and(eq(topics.subjectId, subjectId), isNull(topics.archivedAt)))
    .groupBy(topics.id);
}
