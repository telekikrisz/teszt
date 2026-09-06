import { describe, expect, it } from "vitest";
import { createXpTetelSchema, xpBevaltas, xpEsemeny } from "@oktateszt/shared";

describe("xpBevaltas", () => {
  it("50 XP → egy jeles, maradék 0", () => {
    expect(xpBevaltas(50)).toEqual({ jegyek: [5], maradek: 0 });
  });

  it("70 XP → egy jeles, maradék 20", () => {
    expect(xpBevaltas(70)).toEqual({ jegyek: [5], maradek: 20 });
  });

  it("100 XP → két jeles", () => {
    expect(xpBevaltas(100)).toEqual({ jegyek: [5, 5], maradek: 0 });
  });

  it("-50 XP → egy elégtelen, maradék 0", () => {
    expect(xpBevaltas(-50)).toEqual({ jegyek: [1], maradek: 0 });
  });

  it("-70 XP → egy elégtelen, maradék -20", () => {
    expect(xpBevaltas(-70)).toEqual({ jegyek: [1], maradek: -20 });
  });

  it("küszöb alatt nincs beváltás", () => {
    expect(xpBevaltas(49)).toEqual({ jegyek: [], maradek: 49 });
    expect(xpBevaltas(-49)).toEqual({ jegyek: [], maradek: -49 });
    expect(xpBevaltas(0)).toEqual({ jegyek: [], maradek: 0 });
  });
});

describe("createXpTetelSchema", () => {
  it("elutasítja a 0 pontot", () => {
    const result = createXpTetelSchema.safeParse({
      tanuloId: "11111111-1111-1111-1111-111111111111",
      esemenyKod: "zavaras",
      pont: 0,
    });
    expect(result.success).toBe(false);
  });

  it("elfogadja a szereptévesztést −5-tel", () => {
    const result = createXpTetelSchema.safeParse({
      tanuloId: "11111111-1111-1111-1111-111111111111",
      esemenyKod: "szereptevesztes",
      pont: -5,
    });
    expect(result.success).toBe(true);
  });
});

describe("xpEsemeny", () => {
  it("visszaadja a GitHub feladat alapértelmezett pontját", () => {
    expect(xpEsemeny("github_feladat")?.pont).toBe(10);
  });
});
