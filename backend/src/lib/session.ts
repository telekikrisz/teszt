import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { env, isProduction } from "../env.js";
import { db } from "../db/index.js";
import { felhasznalo, munkamenet, type Felhasznalo } from "../db/schema.js";
import { generateSessionToken, hashToken, utcNow } from "./crypto.js";

export const SESSION_COOKIE = "oktateszt_sid";

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  jogosultsag: Felhasznalo["jogosultsag"];
  osztaly: string | null;
  agazatId: string | null;
};

export function toPublicUser(user: Felhasznalo): PublicUser {
  return {
    id: user.felhasznaloId,
    email: user.email,
    name: user.nev,
    jogosultsag: user.jogosultsag,
    osztaly: user.osztaly,
    agazatId: user.agazatId,
  };
}

export async function createSession(c: Context, felhasznaloId: string): Promise<void> {
  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const lejarAt = new Date(utcNow().getTime() + env.SESSION_TTL_SECONDS * 1000);

  await db.delete(munkamenet).where(eq(munkamenet.felhasznaloId, felhasznaloId));
  await db.insert(munkamenet).values({
    felhasznaloId,
    tokenHash,
    lejarAt,
  });

  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE || isProduction,
    sameSite: "Lax",
    path: "/",
    // Nincs expires: munkamenet-süti — a böngésző bezárásakor törlődik.
  });
}

export async function destroySession(c: Context): Promise<void> {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    await db.delete(munkamenet).where(eq(munkamenet.tokenHash, hashToken(token)));
  }
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

export async function resolveSessionUser(c: Context): Promise<PublicUser | null> {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;

  const tokenHash = hashToken(token);
  const rows = await db
    .select({
      munkamenetId: munkamenet.munkamenetId,
      lejarAt: munkamenet.lejarAt,
      user: felhasznalo,
    })
    .from(munkamenet)
    .innerJoin(felhasznalo, eq(munkamenet.felhasznaloId, felhasznalo.felhasznaloId))
    .where(eq(munkamenet.tokenHash, tokenHash))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  if (row.lejarAt.getTime() <= utcNow().getTime()) {
    await db.delete(munkamenet).where(eq(munkamenet.munkamenetId, row.munkamenetId));
    return null;
  }

  if (row.user.archivaltAt) return null;

  c.set("sessionId", row.munkamenetId);
  return toPublicUser(row.user);
}
