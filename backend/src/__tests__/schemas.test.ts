import { describe, expect, it } from "vitest";
import { createKerdesSchema, createTesztSchema, loginSchema, registerSchema } from "@oktateszt/shared";

describe("Zod sémák", () => {
  it("elutasítja a hibás e-mailt", () => {
    const result = loginSchema.safeParse({ email: "nem-email", password: "x" });
    expect(result.success).toBe(false);
  });

  it("elutasítja a kérdést helyes válasz nélkül", () => {
    const result = createKerdesSchema.safeParse({
      temakorId: "11111111-1111-1111-1111-111111111111",
      szoveg: "Kérdés?",
      pontszam: 1,
      valaszok: [
        { szoveg: "A", jo: false },
        { szoveg: "B", jo: false },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("elfogadja az egyválasztós kérdést", () => {
    const result = createKerdesSchema.safeParse({
      temakorId: "11111111-1111-1111-1111-111111111111",
      szoveg: "Kérdés?",
      pontszam: 1,
      valaszok: [
        { szoveg: "A", jo: false },
        { szoveg: "B", jo: true },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("elutasítja a tesztet kérdés nélkül", () => {
    const result = createTesztSchema.safeParse({
      cim: "Dolgozat",
      tantargyId: "11111111-1111-1111-1111-111111111111",
      kerdesIdk: [],
    });
    expect(result.success).toBe(false);
  });

  it("tanuló regisztrációnál osztályt és ágazatot vár", () => {
    const missing = registerSchema.safeParse({
      name: "Nagy Péter",
      email: "p@teszt.hu",
      password: "Titkos123",
    });
    expect(missing.success).toBe(false);

    const ok = registerSchema.safeParse({
      name: "Nagy Péter",
      email: "p@teszt.hu",
      password: "Titkos123",
      osztaly: "11.C",
      agazatId: "11111111-1111-1111-1111-111111111111",
    });
    expect(ok.success).toBe(true);
  });
});
