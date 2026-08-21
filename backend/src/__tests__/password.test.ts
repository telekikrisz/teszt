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
  it("ékezetmentes helyi részt képez", () => {
    const taken = new Set<string>();
    expect(allocateStudentEmail("Nagy István", taken)).toBe("nagyistvan@iskola.hu");
  });

  it("ütközéskor számoz", () => {
    const taken = new Set(["nagyistvan@iskola.hu"]);
    expect(allocateStudentEmail("Nagy István", taken)).toBe("nagyistvan2@iskola.hu");
    expect(allocateStudentEmail("Nagy István", taken)).toBe("nagyistvan3@iskola.hu");
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
