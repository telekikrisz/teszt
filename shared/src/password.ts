import { EVFOLYAM_ERETEKEK, type EvfolyamErtek } from "./evfolyam.js";

/**
 * Admin által létrehozott felhasználó kezdeti jelszava:
 * vezetéknév első 3 betűje + keresztnév első 3 betűje (ASCII, Nagykezdettel) + "1!"
 * pl. Szentes Olga → SzeOlg1!, Fekete Gábor → FekGab1!, Nagy István → NagIst1!
 */
export function generateInitialPassword(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) {
    throw new Error("A név legalább vezetéknév és keresztnév formátumú legyen.");
  }

  const ascii = (word: string) => word.normalize("NFD").replace(/\p{M}/gu, "");

  const chunk = (word: string) => {
    const s = ascii(word).slice(0, 3);
    if (!s) throw new Error("Érvénytelen névrész a jelszógeneráláshoz.");
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  };

  return `${chunk(parts[0]!)}${chunk(parts[1]!)}1!`;
}

/** Tanuló e-mail domain (import / generált címek). */
export const ISKOLA_EMAIL_DOMAIN = "telekimezotur.hu";

/** Ékezetmentes, csak alfanumerikus karakterek. */
export function asciiSlug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

/**
 * Tanév kezdő naptári éve (szeptember–augusztus).
 * pl. 2026. szeptember → 2026, 2027. március → 2026.
 */
export function tanevKezdoEve(now: Date = new Date()): number {
  return now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
}

/**
 * Osztálynév (pl. „12.D”) → évfolyam + betűjel.
 */
export function parseOsztaly(
  osztaly: string,
): { evfolyam: EvfolyamErtek; betu: string } | null {
  const match = osztaly.trim().match(/^(\d{1,2})\.?\s*([A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű]+)$/);
  if (!match) return null;
  const n = Number(match[1]);
  if (!(EVFOLYAM_ERETEKEK as readonly number[]).includes(n)) return null;
  const betu = asciiSlug(match[2] ?? "");
  if (!betu) return null;
  return { evfolyam: n as EvfolyamErtek, betu };
}

/**
 * 9. évfolyamon induló osztály kezdő éve a megadott tanévben.
 * 11.D 2026/27-ben → 2024, 12.D → 2023, 13.D → 2022.
 */
export function osztalyKezdoEv(osztaly: string, now: Date = new Date()): number | null {
  const parsed = parseOsztaly(osztaly);
  if (!parsed) return null;
  return tanevKezdoEve(now) - (parsed.evfolyam - 9);
}

/**
 * Névből e-mail helyi rész: „Lakatos Dániel Dominik” + „12.D” → „lakatos.daniel.2023d”.
 * Vezetéknév + első keresztnév (ékezet nélkül) + kezdőév + osztálybetű.
 */
export function emailLocalPartFromName(
  fullName: string,
  osztaly: string,
  now: Date = new Date(),
): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) {
    throw new Error("A név legalább vezetéknév és keresztnév formátumú legyen.");
  }
  const parsed = parseOsztaly(osztaly);
  const kezdoEv = osztalyKezdoEv(osztaly, now);
  if (!parsed || kezdoEv === null) {
    throw new Error(`Érvénytelen osztály a tanulói e-mailhez: „${osztaly}”.`);
  }
  const vezetek = asciiSlug(parts[0]!);
  const kereszt = asciiSlug(parts[1]!);
  if (!vezetek || !kereszt) {
    throw new Error("A névből nem képezhető e-mail cím.");
  }
  return `${vezetek}.${kereszt}.${kezdoEv}${parsed.betu}`;
}

/**
 * Szabad e-mail a foglalt címekhez igazítva.
 * Első: lakatos.daniel.2023d@telekimezotur.hu, ütközéskor: …2023d2@…
 */
export function allocateStudentEmail(
  fullName: string,
  osztaly: string,
  takenEmails: Set<string>,
  now: Date = new Date(),
): string {
  const base = emailLocalPartFromName(fullName, osztaly, now);
  for (let i = 1; i < 10_000; i++) {
    const local = i === 1 ? base : `${base}${i}`;
    const email = `${local}@${ISKOLA_EMAIL_DOMAIN}`;
    if (!takenEmails.has(email.toLowerCase())) {
      takenEmails.add(email.toLowerCase());
      return email;
    }
  }
  throw new Error("Nem található szabad e-mail cím ehhez a névhez.");
}
