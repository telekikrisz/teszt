import { describe, expect, it } from "vitest";
import { shuffle, pickRandom } from "../lib/crypto.js";

function sequentialRng(sequence: number[]) {
  let i = 0;
  return (maxExclusive: number) => {
    const value = sequence[i] ?? 0;
    i += 1;
    return Math.min(value, maxExclusive - 1);
  };
}

describe("shuffle", () => {
  it("nem módosítja az eredeti tömböt", () => {
    const input = [1, 2, 3, 4];
    const result = shuffle(input, sequentialRng([0, 0, 0]));
    expect(input).toEqual([1, 2, 3, 4]);
    expect(result).toHaveLength(4);
    expect(result.sort()).toEqual([1, 2, 3, 4]);
  });

  it("üres és egyelemű tömböt változatlanul ad vissza", () => {
    expect(shuffle([], sequentialRng([]))).toEqual([]);
    expect(shuffle(["a"], sequentialRng([]))).toEqual(["a"]);
  });

  it("determinisztikus RNG-vel reprodukálható", () => {
    const first = shuffle(["A", "B", "C", "D"], sequentialRng([2, 1, 0]));
    const second = shuffle(["A", "B", "C", "D"], sequentialRng([2, 1, 0]));
    expect(first).toEqual(second);
    expect(first).not.toEqual(["A", "B", "C", "D"]);
  });
});

describe("pickRandom", () => {
  it("a kért számú elemet adja vissza", () => {
    const picked = pickRandom([1, 2, 3, 4, 5], 3, sequentialRng([0, 0, 0, 0]));
    expect(picked).toHaveLength(3);
  });

  it("hibát dob, ha túl sokat kérünk", () => {
    expect(() => pickRandom([1, 2], 3)).toThrow();
  });
});
