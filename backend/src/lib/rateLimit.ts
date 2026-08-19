import { AppError } from "../lib/errors.js";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function assertLoginRateLimit(key: string): void {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  existing.count += 1;
  if (existing.count > MAX_ATTEMPTS) {
    throw new AppError(
      429,
      "Túl sok sikertelen belépési kísérlet. Próbáld újra később.",
      "RATE_LIMITED",
    );
  }
}

export function clearLoginRateLimit(key: string): void {
  buckets.delete(key);
}
