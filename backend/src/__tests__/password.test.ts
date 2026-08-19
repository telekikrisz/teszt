import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../lib/password.js";

describe("Argon2 jelszókezelés", () => {
  it("hash-eli és ellenőrzi a jelszót", async () => {
    const hash = await hashPassword("TitkosJelszo123");
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, "TitkosJelszo123")).toBe(true);
    expect(await verifyPassword(hash, "rossz")).toBe(false);
  });
});
