import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function utcNow(): Date {
  return new Date();
}

/**
 * Fisher–Yates keverés kriptográfiailag biztonságos véletlenszámmal.
 * A második argumentum csak tesztekhez: determinisztikus RNG.
 */
export function shuffle<T>(items: readonly T[], rng: (maxExclusive: number) => number = randomInt): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    const current = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = current;
  }
  return arr;
}

export function pickRandom<T>(items: readonly T[], count: number, rng: (maxExclusive: number) => number = randomInt): T[] {
  if (count > items.length) {
    throw new Error("Nem lehet több elemet választani, mint amennyi rendelkezésre áll.");
  }
  return shuffle(items, rng).slice(0, count);
}
