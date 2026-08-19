export type SnapshotAnswer = {
  id: string;
  isCorrect: boolean;
};

export type SnapshotQuestion = {
  id: string;
  answers: SnapshotAnswer[];
};

export type AttemptResponse = {
  testQuestionId: string;
  selectedAnswerId: string | null;
};

export type EvaluatedAnswer = {
  testQuestionId: string;
  selectedAnswerId: string | null;
  isCorrect: boolean;
};

export type EvaluationResult = {
  score: number;
  maxScore: number;
  percentScore: number;
  answers: EvaluatedAnswer[];
};

/**
 * Backend oldali kiértékelés. A frontend által küldött pontszámot soha nem használjuk.
 * Egy pont jár minden helyesen megválaszolt kérdésért.
 */
export function evaluateAttempt(
  questions: SnapshotQuestion[],
  responses: AttemptResponse[],
): EvaluationResult {
  const responseByQuestion = new Map(responses.map((r) => [r.testQuestionId, r.selectedAnswerId]));
  const evaluated: EvaluatedAnswer[] = [];
  let score = 0;

  for (const question of questions) {
    const selectedAnswerId = responseByQuestion.get(question.id) ?? null;
    const correct = question.answers.find((a) => a.isCorrect);
    const isCorrect = Boolean(
      selectedAnswerId && correct && selectedAnswerId === correct.id,
    );
    if (isCorrect) score += 1;
    evaluated.push({
      testQuestionId: question.id,
      selectedAnswerId,
      isCorrect,
    });
  }

  const maxScore = questions.length;
  const percentScore = maxScore === 0 ? 0 : Math.round((score / maxScore) * 10000) / 100;

  return { score, maxScore, percentScore, answers: evaluated };
}
