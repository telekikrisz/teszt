import { describe, expect, it } from "vitest";
import { evaluateAttempt } from "../services/evaluation.js";

const questions = [
  {
    id: "q1",
    answers: [
      { id: "q1a", isCorrect: false },
      { id: "q1b", isCorrect: true },
    ],
  },
  {
    id: "q2",
    answers: [
      { id: "q2a", isCorrect: true },
      { id: "q2b", isCorrect: false },
    ],
  },
];

describe("evaluateAttempt", () => {
  it("100%-ot ad, ha minden válasz helyes", () => {
    const result = evaluateAttempt(questions, [
      { testQuestionId: "q1", selectedAnswerId: "q1b" },
      { testQuestionId: "q2", selectedAnswerId: "q2a" },
    ]);
    expect(result.score).toBe(2);
    expect(result.maxScore).toBe(2);
    expect(result.percentScore).toBe(100);
    expect(result.answers.every((a) => a.isCorrect)).toBe(true);
  });

  it("részleges pontszámot számol", () => {
    const result = evaluateAttempt(questions, [
      { testQuestionId: "q1", selectedAnswerId: "q1a" },
      { testQuestionId: "q2", selectedAnswerId: "q2a" },
    ]);
    expect(result.score).toBe(1);
    expect(result.percentScore).toBe(50);
  });

  it("a megválaszolatlan kérdést hibásnak tekinti", () => {
    const result = evaluateAttempt(questions, [{ testQuestionId: "q1", selectedAnswerId: "q1b" }]);
    expect(result.score).toBe(1);
    expect(result.answers.find((a) => a.testQuestionId === "q2")?.isCorrect).toBe(false);
  });

  it("rossz kérdéshez tartozó választ nem fogad el helyesnek", () => {
    const result = evaluateAttempt(questions, [
      { testQuestionId: "q1", selectedAnswerId: "q2a" },
      { testQuestionId: "q2", selectedAnswerId: "q2a" },
    ]);
    expect(result.answers[0]?.isCorrect).toBe(false);
    expect(result.score).toBe(1);
  });

  it("üres tesztnél 0%", () => {
    const result = evaluateAttempt([], []);
    expect(result).toEqual({ score: 0, maxScore: 0, percentScore: 0, answers: [] });
  });
});
