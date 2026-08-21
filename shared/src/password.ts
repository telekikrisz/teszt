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
export const ISKOLA_EMAIL_DOMAIN = "iskola.hu";

/** Ékezetmentes, csak alfanumerikus karakterek. */
export function asciiSlug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

/**
 * Névből e-mail helyi rész: „Nagy István” → „nagyistvan”.
 */
export function emailLocalPartFromName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const local = parts.map(asciiSlug).join("");
  if (!local) throw new Error("A névből nem képezhető e-mail cím.");
  return local;
}

/**
 * Szabad e-mail a foglalt címekhez igazítva.
 * Első: nagyistvan@iskola.hu, ütközéskor: nagyistvan2@…, nagyistvan3@…
 */
export function allocateStudentEmail(fullName: string, takenEmails: Set<string>): string {
  const base = emailLocalPartFromName(fullName);
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
