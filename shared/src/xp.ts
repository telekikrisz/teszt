import { z } from "zod";

export const XP_BEVALTAS_KUSZOB = 50;

export const XP_ESEMENYEK = [
  {
    kod: "github_feladat",
    cimke: "Sikeresen megoldott, GitHubra feltöltött feladat",
    pont: 10,
    csoport: "pozitiv",
  },
  {
    kod: "orai_reszvetel",
    cimke: "Aktív tanórai részvétel",
    pont: 10,
    csoport: "pozitiv",
  },
  {
    kod: "mentor_senior",
    cimke: "Sikeres Senior mentorálás",
    pont: 10,
    csoport: "pozitiv",
  },
  {
    kod: "mentor_junior",
    cimke: "Juniorként mentorált feladat",
    pont: 5,
    csoport: "pozitiv",
  },
  {
    kod: "elegans_kod",
    cimke: "Kiemelkedően elegáns kód / plusz funkciók",
    pont: 10,
    csoport: "pozitiv",
  },
  {
    kod: "zavaras",
    cimke: "Tanórai zavaró tevékenység",
    pont: -10,
    csoport: "negativ",
  },
  {
    kod: "nincs_mentes",
    cimke: "Üres GitHub / nincs mentés",
    pont: -30,
    csoport: "negativ",
  },
  {
    kod: "munkamegtagadas",
    cimke: "Munkamegtagadás",
    pont: -50,
    csoport: "negativ",
  },
  {
    kod: "szereptevesztes",
    cimke: "Tanórai szereptévesztés",
    pont: -5,
    csoport: "negativ",
  },
] as const;

export type XpEsemeny = (typeof XP_ESEMENYEK)[number];
export type XpEsemenyKod = XpEsemeny["kod"];
export type XpJegyErtek = 1 | 5;

export const XP_ESEMENY_KODOK = XP_ESEMENYEK.map((e) => e.kod) as unknown as [
  XpEsemenyKod,
  ...XpEsemenyKod[],
];

export function xpEsemeny(kod: string): XpEsemeny | null {
  return XP_ESEMENYEK.find((e) => e.kod === kod) ?? null;
}

export function xpJegyFelirat(ertek: number): string {
  if (ertek === 5) return "Órai munka jeles (5)";
  if (ertek === 1) return "Órai munka elégtelen (1)";
  return `Órai munka (${ertek})`;
}

export function formatXpEgyenleg(pont: number): string {
  return `${pont} XP`;
}

export function formatXpPont(pont: number): string {
  return pont > 0 ? `+${pont} XP` : `${pont} XP`;
}

/** +50 → jeles (5) és −50 XP; −50 → elégtelen (1) és +50 XP, amíg a küszöbön belülre nem kerül. */
export function xpBevaltas(egyenleg: number): { jegyek: XpJegyErtek[]; maradek: number } {
  const jegyek: XpJegyErtek[] = [];
  let x = egyenleg;
  while (x >= XP_BEVALTAS_KUSZOB) {
    jegyek.push(5);
    x -= XP_BEVALTAS_KUSZOB;
  }
  while (x <= -XP_BEVALTAS_KUSZOB) {
    jegyek.push(1);
    x += XP_BEVALTAS_KUSZOB;
  }
  return { jegyek, maradek: x };
}

export const createXpKapSchema = z.object({
  tanuloId: z.string().uuid("Érvénytelen tanuló azonosító."),
  tantargyId: z.string().uuid("Válassz tantárgyat az XP-hez."),
  esemenyKod: z.enum(XP_ESEMENY_KODOK, {
    errorMap: () => ({ message: "Ismeretlen XP esemény." }),
  }),
  pont: z
    .number({ invalid_type_error: "A pontszám szám legyen." })
    .int("A pontszám egész szám legyen.")
    .min(-200, "A pontszám legalább −200.")
    .max(200, "A pontszám legfeljebb 200.")
    .refine((n) => n !== 0, "A pontszám nem lehet 0."),
});

export const createXpTetelSchema = createXpKapSchema;

export const xpOsztalySzuroSchema = z.object({
  osztaly: z.string().trim().min(1, "Válassz osztályt.").max(20),
});

export type CreateXpKapInput = z.infer<typeof createXpKapSchema>;
export type CreateXpTetelInput = CreateXpKapInput;
