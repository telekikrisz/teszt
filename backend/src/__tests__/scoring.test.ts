import { describe, expect, it } from "vitest";
import { ertekelKerdesPont } from "@oktateszt/shared";

describe("ertekelKerdesPont", () => {
  const egy = new Set(["jo"]);
  const tobb = new Set(["a", "b"]);

  it("üres jelölés: 0", () => {
    expect(ertekelKerdesPont(egy, new Set(), 2)).toBe(0);
    expect(ertekelKerdesPont(tobb, new Set(), 2)).toBe(0);
  });

  it("egyválasztós: 0 vagy teljes pont", () => {
    expect(ertekelKerdesPont(egy, new Set(["jo"]), 2)).toBe(2);
    expect(ertekelKerdesPont(egy, new Set(["rossz"]), 2)).toBe(0);
  });

  it("többjó: minden helyes, hiba nélkül — teljes pont", () => {
    expect(ertekelKerdesPont(tobb, new Set(["a", "b"]), 2)).toBe(2);
  });

  it("többjó: egy helyes, hiba nélkül — +1", () => {
    expect(ertekelKerdesPont(tobb, new Set(["a"]), 2)).toBe(1);
  });

  it("többjó: egy helyes és egy hibás — 0", () => {
    expect(ertekelKerdesPont(tobb, new Set(["a", "c"]), 2)).toBe(0);
  });

  it("többjó: mindkét helyes és egy hibás — +1", () => {
    expect(ertekelKerdesPont(tobb, new Set(["a", "b", "c"]), 2)).toBe(1);
  });

  it("többjó: minden opció (2 jó + 2 rossz) — 0", () => {
    expect(ertekelKerdesPont(tobb, new Set(["a", "b", "c", "d"]), 2)).toBe(0);
  });
});
