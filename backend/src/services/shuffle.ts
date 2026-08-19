import { shuffle } from "../lib/crypto.js";

export type BankQuestion = {
  id: string;
  text: string;
  answers: { id: string; text: string }[];
};

export type ShuffledAttempt = {
  questionOrder: string[];
  answerOrders: Record<string, string[]>;
};

/**
 * Új kitöltéshez keveri a kérdések és a válaszlehetőségek sorrendjét.
 * A keverés eredményét elmentjük, hogy a tanuló ugyanazt a sorrendet kapja vissza.
 */
export function buildShuffledAttempt(questions: BankQuestion[]): ShuffledAttempt {
  const shuffledQuestions = shuffle(questions);
  const questionOrder = shuffledQuestions.map((q) => q.id);
  const answerOrders: Record<string, string[]> = {};

  for (const question of shuffledQuestions) {
    answerOrders[question.id] = shuffle(question.answers).map((a) => a.id);
  }

  return { questionOrder, answerOrders };
}

export function applyShuffle<T extends { id: string; answers: { id: string }[] }>(
  questions: T[],
  questionOrder: string[],
  answerOrders: Record<string, string[]>,
): T[] {
  const byId = new Map(questions.map((q) => [q.id, q]));
  return questionOrder.flatMap((qid) => {
    const question = byId.get(qid);
    if (!question) return [];
    const order = answerOrders[qid] ?? question.answers.map((a) => a.id);
    const answersById = new Map(question.answers.map((a) => [a.id, a]));
    return [
      {
        ...question,
        answers: order.flatMap((aid) => {
          const answer = answersById.get(aid);
          return answer ? [answer] : [];
        }),
      },
    ];
  });
}
