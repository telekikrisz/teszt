import { describe, expect, it } from "vitest";
import { findInsufficientTopics, formatInsufficientMessage } from "../services/testGeneration.js";
import { applyShuffle, buildShuffledAttempt } from "../services/shuffle.js";

describe("tesztgenerálás érvényesség", () => {
  it("jelzi, ha egy témakörben nincs elég kérdés", () => {
    const insufficient = findInsufficientTopics([
      { topicId: "1", name: "Változók", requested: 3, available: 5 },
      { topicId: "2", name: "Ciklusok", requested: 4, available: 2 },
    ]);
    expect(insufficient).toHaveLength(1);
    expect(insufficient[0]?.name).toBe("Ciklusok");
    expect(formatInsufficientMessage(insufficient)).toContain("Ciklusok");
    expect(formatInsufficientMessage(insufficient)).toContain("kérve 4");
  });

  it("üres listát ad, ha minden témakör teljesíthető", () => {
    expect(
      findInsufficientTopics([{ topicId: "1", name: "Tömbök", requested: 2, available: 2 }]),
    ).toEqual([]);
  });
});

describe("kitöltés keverése", () => {
  it("minden kérdést és választ megtart, isCorrect nélkül", () => {
    const questions = [
      {
        id: "q1",
        text: "Kérdés 1",
        answers: [
          { id: "a1", text: "A" },
          { id: "a2", text: "B" },
        ],
      },
      {
        id: "q2",
        text: "Kérdés 2",
        answers: [
          { id: "b1", text: "C" },
          { id: "b2", text: "D" },
        ],
      },
    ];
    const shuffled = buildShuffledAttempt(questions);
    expect(shuffled.questionOrder).toHaveLength(2);
    expect(new Set(shuffled.questionOrder)).toEqual(new Set(["q1", "q2"]));
    expect(shuffled.answerOrders["q1"]).toHaveLength(2);

    const applied = applyShuffle(questions, shuffled.questionOrder, shuffled.answerOrders);
    expect(applied.map((q) => q.id)).toEqual(shuffled.questionOrder);
    expect(JSON.stringify(applied)).not.toContain("isCorrect");
  });
});
