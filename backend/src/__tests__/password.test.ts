import { describe, expect, it } from "vitest";
import { allocateStudentEmail, generateInitialPassword } from "@oktateszt/shared";
import { hashPassword, verifyPassword } from "../lib/password.js";

describe("generateInitialPassword", () => {
  it("Szentes Olga → SzeOlg1!", () => {
    expect(generateInitialPassword("Szentes Olga")).toBe("SzeOlg1!");
  });

  it("Fekete Gábor → FekGab1! (ékezet nélkül)", () => {
    expect(generateInitialPassword("Fekete Gábor")).toBe("FekGab1!");
  });

  it("több szó esetén az első kettőt használja", () => {
    expect(generateInitialPassword("Kovács Anna Mária")).toBe("KovAnn1!");
  });

  it("Nagy István → NagIst1!", () => {
    expect(generateInitialPassword("Nagy István")).toBe("NagIst1!");
  });
});

describe("allocateStudentEmail", () => {
  const now = new Date("2026-09-02T12:00:00+02:00");

  it("vezetéknév.keresztnév.évosztálybetű a tanévhez", () => {
    const taken = new Set<string>();
    expect(allocateStudentEmail("Lakatos Dániel Dominik", "12.D", taken, now)).toBe(
      "lakatos.daniel.2023d@telekimezotur.hu",
    );
  });

  it("11.D → 2024, 13.D → 2022", () => {
    const taken = new Set<string>();
    expect(allocateStudentEmail("Fekete Marcell", "11.D", taken, now)).toBe(
      "fekete.marcell.2024d@telekimezotur.hu",
    );
    expect(allocateStudentEmail("Kiss Zoltán", "13.D", taken, now)).toBe(
      "kiss.zoltan.2022d@telekimezotur.hu",
    );
  });

  it("ütközéskor számoz", () => {
    const taken = new Set(["lakatos.daniel.2023d@telekimezotur.hu"]);
    expect(allocateStudentEmail("Lakatos Dániel Dominik", "12.D", taken, now)).toBe(
      "lakatos.daniel.2023d2@telekimezotur.hu",
    );
    expect(allocateStudentEmail("Lakatos Dániel Dominik", "12.D", taken, now)).toBe(
      "lakatos.daniel.2023d3@telekimezotur.hu",
    );
  });
});

describe("Argon2 jelszókezelés", () => {
  it("hash-eli és ellenőrzi a jelszót", async () => {
    const hash = await hashPassword("TitkosJelszo123");
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, "TitkosJelszo123")).toBe(true);
    expect(await verifyPassword(hash, "rossz")).toBe(false);
  });
});
