export const JOGOSULTSAGOK = ["admin", "tanar", "tanulo"] as const;
export type Jogosultsag = (typeof JOGOSULTSAGOK)[number];

export const STAFF_JOGOSULTSAGOK = ["admin", "tanar"] as const;
export type StaffJogosultsag = (typeof STAFF_JOGOSULTSAGOK)[number];

export const JOGOSULTSAG_LABELS: Record<Jogosultsag, string> = {
  admin: "Rendszergazda",
  tanar: "Tanár",
  tanulo: "Tanuló",
};

export const TESZT_ALLAPOTOK = ["piszkozat", "kesz"] as const;
export type TesztAllapot = (typeof TESZT_ALLAPOTOK)[number];

export const KITOLTES_ALLAPOTOK = ["folyamatban", "bekuldve", "lejart"] as const;
export type KitoltesAllapot = (typeof KITOLTES_ALLAPOTOK)[number];

export const TESZT_ALLAPOT_LABELS: Record<TesztAllapot, string> = {
  piszkozat: "Piszkozat",
  kesz: "Jóváhagyott",
};

export const KITOLTES_ALLAPOT_LABELS: Record<KitoltesAllapot, string> = {
  folyamatban: "Folyamatban",
  bekuldve: "Beküldve",
  lejart: "Lejárt",
};

export function isStaffJogosultsag(j: Jogosultsag): j is StaffJogosultsag {
  return j === "admin" || j === "tanar";
}

/** @deprecated régi frontend — használd a JOGOSULTSAGOK-et */
export const USER_ROLES = JOGOSULTSAGOK;
export type UserRole = Jogosultsag;
