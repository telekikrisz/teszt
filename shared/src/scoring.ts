/**
 * Egyválasztós: 0 vagy a teljes pontszám.
 *
 * Többjó: minden eltalált helyes opció +1 egység, minden hibás jelölés −1.
 * Negatív nem lehet. Az egység a kérdés pontszámához van igazítva
 * (2 pontos, 2 jó válaszos kérdésnél az egység 1 pont).
 *
 * A feladatszerkesztő előírja, hogy legalább annyi rossz opció legyen, mint jó,
 * ezért az összes opció bejelölése nem jár ponttal.
 */
export function ertekelKerdesPont(
  joIds: ReadonlySet<string>,
  kijeloltIds: ReadonlySet<string>,
  pontszam: number,
): number {
  if (pontszam <= 0 || joIds.size === 0 || kijeloltIds.size === 0) return 0;

  if (joIds.size === 1) {
    if (kijeloltIds.size !== 1) return 0;
    const [only] = kijeloltIds;
    return only && joIds.has(only) ? pontszam : 0;
  }

  let helyes = 0;
  let hibas = 0;
  for (const id of kijeloltIds) {
    if (joIds.has(id)) helyes += 1;
    else hibas += 1;
  }

  const net = Math.max(0, helyes - hibas);
  return Math.min(pontszam, Math.round((net / joIds.size) * pontszam));
}
