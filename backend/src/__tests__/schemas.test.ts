import { describe, expect, it } from "vitest";
import { createKerdesSchema, createTesztSchema, createVizsgaSchema, evfolyamOsztalybol, importKerdesekSchema, loginSchema, parseEvfolyamMezo, registerSchema } from "@oktateszt/shared";

describe("Zod sémák", () => {
  it("osztálynévből évfolyam", () => {
    expect(evfolyamOsztalybol("13.D")).toBe(13);
    expect(evfolyamOsztalybol("11.C")).toBe(11);
    expect(evfolyamOsztalybol(null)).toBeNull();
    expect(parseEvfolyamMezo("11.")).toEqual({ ok: true, ertek: 11 });
    expect(parseEvfolyamMezo("11. évfolyam")).toEqual({ ok: true, ertek: 11 });
    expect(parseEvfolyamMezo("14").ok).toBe(false);
    expect(parseEvfolyamMezo("").ok).toBe(false);
  });

  it("elutasítja a hibás e-mailt", () => {
    const result = loginSchema.safeParse({ email: "nem-email", password: "x" });
    expect(result.success).toBe(false);
  });

  it("elutasítja a kérdést helyes válasz nélkül", () => {
    const result = createKerdesSchema.safeParse({
      evfolyamId: "11111111-1111-1111-1111-111111111111",
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

  it("többválasztósnál legalább annyi rossz opció kell, mint jó", () => {
    const kevesRossz = createKerdesSchema.safeParse({
      evfolyamId: "11111111-1111-1111-1111-111111111111",
      temakorId: "11111111-1111-1111-1111-111111111111",
      szoveg: "Kérdés?",
      pontszam: 2,
      valaszok: [
        { szoveg: "A", jo: true },
        { szoveg: "B", jo: true },
        { szoveg: "C", jo: false },
      ],
    });
    expect(kevesRossz.success).toBe(false);

    const ok = createKerdesSchema.safeParse({
      evfolyamId: "11111111-1111-1111-1111-111111111111",
      temakorId: "11111111-1111-1111-1111-111111111111",
      szoveg: "Kérdés?",
      pontszam: 2,
      valaszok: [
        { szoveg: "A", jo: true },
        { szoveg: "B", jo: true },
        { szoveg: "C", jo: false },
        { szoveg: "D", jo: false },
      ],
    });
    expect(ok.success).toBe(true);
  });

  it("elfogadja az egyválasztós kérdést", () => {
    const result = createKerdesSchema.safeParse({
      evfolyamId: "11111111-1111-1111-1111-111111111111",
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

  it("importáláskor témakörnévvel fogadja a kérdést", () => {
    const result = importKerdesekSchema.safeParse({
      kerdesek: [
        {
          sor: 2,
          evfolyamErtek: 11,
          agazatNev: "Informatika",
          tantargyNev: "Adatbázis-kezelés I",
          temakorNev: "SQL alapok",
          szoveg: "Mi a PRIMARY KEY?",
          pontszam: 1,
          valaszok: [
            { szoveg: "Egyedi azonosító", jo: true },
            { szoveg: "Index", jo: false },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("importáláskor elutasítja a helyes válasz nélküli sort", () => {
    const result = importKerdesekSchema.safeParse({
      kerdesek: [
        {
          sor: 3,
          evfolyamErtek: 11,
          agazatNev: "Informatika",
          tantargyNev: "Adatbázis-kezelés I",
          temakorNev: "SQL",
          szoveg: "Kérdés?",
          pontszam: 1,
          valaszok: [
            { szoveg: "A", jo: false },
            { szoveg: "B", jo: false },
          ],
        },
      ],
    });
    expect(result.success).toBe(false);
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

  it("vizsga kiírásnál a jegyAdando alapból false", () => {
    const eleje = new Date(Date.now() + 60_000);
    const vege = new Date(eleje.getTime() + 10 * 60_000);
    const result = createVizsgaSchema.parse({
      tesztId: "11111111-1111-1111-1111-111111111111",
      idoablakEleje: eleje.toISOString(),
      idoablakVege: vege.toISOString(),
      perc: 45,
      tanulok: [{ tanuloId: "22222222-2222-2222-2222-222222222222" }],
    });
    expect(result.jegyAdando).toBe(false);

    const withGrade = createVizsgaSchema.parse({
      tesztId: "11111111-1111-1111-1111-111111111111",
      idoablakEleje: eleje.toISOString(),
      idoablakVege: vege.toISOString(),
      perc: 45,
      jegyAdando: true,
      tanulok: [{ tanuloId: "22222222-2222-2222-2222-222222222222" }],
    });
    expect(withGrade.jegyAdando).toBe(true);
  });
});
