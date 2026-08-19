/**
 * Soft-delete: a rekordok nem törlődnek, archivált státuszba kerülnek.
 * A közvetlenül archivált elem oka `manual`; a leszármazottaké a szülő típusa
 * (`deleted_branch`, `deleted_subject`, …). Már archivált sorokat nem írunk felül.
 */
import { and, eq, inArray, isNull, type SQL } from "drizzle-orm";
import type { ArchiveReason } from "@oktateszt/shared";
import { db } from "../db/index.js";
import {
  branches,
  questions,
  subjects,
  testQuestions,
  tests,
  testTopicConfigs,
  topics,
} from "../db/schema.js";
import { utcNow } from "../lib/crypto.js";
import { AppError, NotFoundError } from "../lib/errors.js";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function archiveBranch(id: string) {
  const [branch] = await db.select().from(branches).where(eq(branches.id, id)).limit(1);
  if (!branch) throw new NotFoundError("Az ágazat nem található.");
  if (branch.archivedAt) throw new AppError(409, "Ez az ágazat már archiválva van.", "ALREADY_ARCHIVED");

  const now = utcNow();
  await db.transaction(async (tx) => {
    await tx
      .update(branches)
      .set({ archivedAt: now, archiveReason: "manual" })
      .where(eq(branches.id, id));

    const subjectRows = await tx
      .select({ id: subjects.id })
      .from(subjects)
      .where(and(eq(subjects.branchId, id), isNull(subjects.archivedAt)));
    const subjectIds = subjectRows.map((s) => s.id);
    if (subjectIds.length === 0) return;

    await archiveSubjectTree(tx, subjectIds, "deleted_branch", now);
  });
}

export async function archiveSubject(id: string) {
  const [subject] = await db.select().from(subjects).where(eq(subjects.id, id)).limit(1);
  if (!subject) throw new NotFoundError("A tantárgy nem található.");
  if (subject.archivedAt) throw new AppError(409, "Ez a tantárgy már archiválva van.", "ALREADY_ARCHIVED");

  const now = utcNow();
  await db.transaction(async (tx) => {
    await tx
      .update(subjects)
      .set({ archivedAt: now, archiveReason: "manual", updatedAt: now })
      .where(eq(subjects.id, id));
    await archiveSubjectChildren(tx, [id], "deleted_subject", now);
  });
}

export async function archiveTopic(id: string) {
  const [topic] = await db.select().from(topics).where(eq(topics.id, id)).limit(1);
  if (!topic) throw new NotFoundError("A témakör nem található.");
  if (topic.archivedAt) throw new AppError(409, "Ez a témakör már archiválva van.", "ALREADY_ARCHIVED");

  const now = utcNow();
  await db.transaction(async (tx) => {
    await tx
      .update(topics)
      .set({ archivedAt: now, archiveReason: "manual", updatedAt: now })
      .where(eq(topics.id, id));
    await archiveTopicChildren(tx, [id], "deleted_topic", now);
  });
}

export async function archiveQuestion(id: string) {
  const [question] = await db.select().from(questions).where(eq(questions.id, id)).limit(1);
  if (!question) throw new NotFoundError("A kérdés nem található.");
  if (question.archivedAt) throw new AppError(409, "Ez a kérdés már archiválva van.", "ALREADY_ARCHIVED");

  const now = utcNow();
  await db.transaction(async (tx) => {
    await tx
      .update(questions)
      .set({ archivedAt: now, archiveReason: "manual", updatedAt: now })
      .where(eq(questions.id, id));
    await archiveTestsForQuestions(tx, [id], "deleted_question", now);
  });
}

export async function archiveTest(id: string, reason: ArchiveReason = "manual") {
  const [test] = await db.select().from(tests).where(eq(tests.id, id)).limit(1);
  if (!test) throw new NotFoundError("A teszt nem található.");
  if (test.status === "ARCHIVED" || test.archivedAt) {
    throw new AppError(409, "Ez a teszt már archiválva van.", "ALREADY_ARCHIVED");
  }

  const now = utcNow();
  const [updated] = await db
    .update(tests)
    .set({
      status: "ARCHIVED",
      archivedAt: now,
      archiveReason: reason,
      updatedAt: now,
    })
    .where(eq(tests.id, id))
    .returning();
  return updated;
}

async function archiveSubjectTree(
  tx: Tx,
  subjectIds: string[],
  reason: ArchiveReason,
  now: Date,
) {
  await tx
    .update(subjects)
    .set({ archivedAt: now, archiveReason: reason, updatedAt: now })
    .where(and(inArray(subjects.id, subjectIds), isNull(subjects.archivedAt)));
  await archiveSubjectChildren(tx, subjectIds, reason, now);
}

async function archiveSubjectChildren(
  tx: Tx,
  subjectIds: string[],
  reason: ArchiveReason,
  now: Date,
) {
  const topicRows = await tx
    .select({ id: topics.id })
    .from(topics)
    .where(and(inArray(topics.subjectId, subjectIds), isNull(topics.archivedAt)));
  const topicIds = topicRows.map((t) => t.id);
  if (topicIds.length > 0) {
    await tx
      .update(topics)
      .set({ archivedAt: now, archiveReason: reason, updatedAt: now })
      .where(and(inArray(topics.id, topicIds), isNull(topics.archivedAt)));
    await archiveTopicChildren(tx, topicIds, reason, now);
  }

  await archiveMatchingTests(
    tx,
    and(inArray(tests.subjectId, subjectIds), isNull(tests.archivedAt)),
    reason,
    now,
  );
}

async function archiveTopicChildren(
  tx: Tx,
  topicIds: string[],
  reason: ArchiveReason,
  now: Date,
) {
  const questionRows = await tx
    .select({ id: questions.id })
    .from(questions)
    .where(and(inArray(questions.topicId, topicIds), isNull(questions.archivedAt)));
  const questionIds = questionRows.map((q) => q.id);
  if (questionIds.length > 0) {
    await tx
      .update(questions)
      .set({ archivedAt: now, archiveReason: reason, updatedAt: now })
      .where(and(inArray(questions.id, questionIds), isNull(questions.archivedAt)));
    await archiveTestsForQuestions(tx, questionIds, reason, now);
  }

  const linkedTests = await tx
    .select({ testId: testTopicConfigs.testId })
    .from(testTopicConfigs)
    .where(inArray(testTopicConfigs.topicId, topicIds));
  const testIds = [...new Set(linkedTests.map((row) => row.testId))];
  if (testIds.length > 0) {
    await archiveMatchingTests(
      tx,
      and(inArray(tests.id, testIds), isNull(tests.archivedAt)),
      reason,
      now,
    );
  }
}

async function archiveTestsForQuestions(
  tx: Tx,
  questionIds: string[],
  reason: ArchiveReason,
  now: Date,
) {
  if (questionIds.length === 0) return;
  const linkedTests = await tx
    .select({ testId: testQuestions.testId })
    .from(testQuestions)
    .where(inArray(testQuestions.sourceQuestionId, questionIds));
  const testIds = [...new Set(linkedTests.map((row) => row.testId))];
  if (testIds.length === 0) return;
  await archiveMatchingTests(
    tx,
    and(inArray(tests.id, testIds), isNull(tests.archivedAt)),
    reason,
    now,
  );
}

async function archiveMatchingTests(
  tx: Tx,
  where: SQL | undefined,
  reason: ArchiveReason,
  now: Date,
) {
  await tx
    .update(tests)
    .set({
      status: "ARCHIVED",
      archivedAt: now,
      archiveReason: reason,
      updatedAt: now,
    })
    .where(where);
}
