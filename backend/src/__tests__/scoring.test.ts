import { describe, expect, it } from "vitest";
import { ertekelKerdesPont, vizsgaJegyMezok, vizsgaJegySzazalekbol } from "@oktateszt/shared";

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

describe("vizsgaJegySzazalekbol", () => {
  it("50% alatt elégtelen (1), küszöbök 50/60/70/80", () => {
    expect(vizsgaJegySzazalekbol(0)).toEqual({ ertek: 1, felirat: "elégtelen" });
    expect(vizsgaJegySzazalekbol(49)).toEqual({ ertek: 1, felirat: "elégtelen" });
    expect(vizsgaJegySzazalekbol(50)).toEqual({ ertek: 2, felirat: "elégséges" });
    expect(vizsgaJegySzazalekbol(59)).toEqual({ ertek: 2, felirat: "elégséges" });
    expect(vizsgaJegySzazalekbol(60)).toEqual({ ertek: 3, felirat: "közepes" });
    expect(vizsgaJegySzazalekbol(70)).toEqual({ ertek: 4, felirat: "jó" });
    expect(vizsgaJegySzazalekbol(79)).toEqual({ ertek: 4, felirat: "jó" });
    expect(vizsgaJegySzazalekbol(80)).toEqual({ ertek: 5, felirat: "jeles" });
    expect(vizsgaJegySzazalekbol(100)).toEqual({ ertek: 5, felirat: "jeles" });
  });

  it("jegy csak ha a tanár bepipálta az értékelést", () => {
    expect(vizsgaJegyMezok(false, 80)).toEqual({ jegy: null, jegyFelirat: null });
    expect(vizsgaJegyMezok(true, null)).toEqual({ jegy: null, jegyFelirat: null });
    expect(vizsgaJegyMezok(true, 72)).toEqual({ jegy: 4, jegyFelirat: "jó" });
  });
});
