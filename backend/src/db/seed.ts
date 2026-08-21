/**
 * Fejlesztői kezdőadatok — tesztfelhasználók + minta kérdésbank (ágazat, tantárgy, témakör).
 * Futtatás: npm run db:seed  (backend mappából)
 *
 * Többször futtatható: meglévő e-mail esetén nem duplikál.
 * A plain jelszavak: backend/seed-felhasznalok.local.txt (gitignore)
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateInitialPassword } from "@oktateszt/shared";
import { eq } from "drizzle-orm";
import { hashPassword } from "../lib/password.js";
import { db, pgClient } from "./index.js";
import { agazat, felhasznalo, tantargy, temakor } from "./schema.js";

const CREDENTIALS_FILE = resolve(process.cwd(), "seed-felhasznalok.local.txt");

const SEED_USERS = [
  {
    email: "admin@oktateszt.hu",
    nev: "Rendszergazda",
    jelszo: "Admin123!",
    jogosultsag: "admin" as const,
    osztaly: null,
    agazatId: null,
  },
  {
    email: "tanar@oktateszt.hu",
    nev: "Kovács Anna",
    jelszo: "Tanar123!",
    jogosultsag: "tanar" as const,
    osztaly: null,
    agazatId: null,
  },
  {
    email: "tanulo@oktateszt.hu",
    nev: "Nagy Péter",
    jelszo: "Tanulo123!",
    jogosultsag: "tanulo" as const,
    osztaly: "11.C",
    agazatNev: "Informatika",
  },
];

const SEED_TANULOK = [
  { email: "szentes.olga@oktateszt.hu", nev: "Szentes Olga", osztaly: "11.A", agazatNev: "Informatika" },
  { email: "toth.bence@oktateszt.hu", nev: "Tóth Bence", osztaly: "11.B", agazatNev: "Informatika" },
  { email: "horvath.eszter@oktateszt.hu", nev: "Horváth Eszter", osztaly: "12.A", agazatNev: "Informatika" },
  { email: "kiss.zita@oktateszt.hu", nev: "Kiss Zita", osztaly: "10.A", agazatNev: "Elektronika" },
  { email: "molnar.david@oktateszt.hu", nev: "Molnár Dávid", osztaly: "12.B", agazatNev: "Informatika" },
  { email: "balogh.krisztina@oktateszt.hu", nev: "Balogh Krisztina", osztaly: "13.D", agazatNev: "Informatika" },
  { email: "fekete.gabor@oktateszt.hu", nev: "Fekete Gábor", osztaly: "13.D", agazatNev: "Informatika" },
  { email: "nemeth.vivien@oktateszt.hu", nev: "Németh Vivien", osztaly: "13.D", agazatNev: "Informatika" },
];

async function upsertAgazat(nev: string) {
  const existing = await db
    .select()
    .from(agazat)
    .where(eq(agazat.agazatNev, nev))
    .limit(1);
  if (existing[0]) return existing[0];

  const [created] = await db.insert(agazat).values({ agazatNev: nev }).returning();
  if (!created) throw new Error(`Ágazat létrehozása sikertelen: ${nev}`);
  return created;
}

async function upsertUser(
  input: {
    email: string;
    nev: string;
    jelszo: string;
    jogosultsag: "admin" | "tanar" | "tanulo";
    osztaly: string | null;
    agazatId: string | null;
  },
) {
  const email = input.email.toLowerCase();
  const existing = await db
    .select()
    .from(felhasznalo)
    .where(eq(felhasznalo.email, email))
    .limit(1);
  if (existing[0]) return existing[0];

  const jelszoHash = await hashPassword(input.jelszo);
  const [created] = await db
    .insert(felhasznalo)
    .values({
      email,
      nev: input.nev,
      jelszoHash,
      jogosultsag: input.jogosultsag,
      osztaly: input.osztaly,
      agazatId: input.agazatId,
    })
    .returning();
  if (!created) throw new Error(`Felhasználó létrehozása sikertelen: ${email}`);
  return created;
}

function saveCredentials(lines: string[]) {
  const content = [
    "Oktateszt — fejlesztői tesztfelhasználók",
    "Generálva: " + new Date().toISOString(),
    "NE oszd meg, NE commitold — csak helyi fejlesztéshez.",
    "",
    ...lines,
    "",
  ].join("\n");
  writeFileSync(CREDENTIALS_FILE, content, "utf8");
}

async function upsertTantargy(agazatId: string, nev: string) {
  const existing = await db
    .select()
    .from(tantargy)
    .where(eq(tantargy.agazatId, agazatId));
  const found = existing.find((t) => t.tantargyNev === nev);
  if (found) return found;
  const [created] = await db.insert(tantargy).values({ agazatId, tantargyNev: nev }).returning();
  if (!created) throw new Error(`Tantárgy létrehozása sikertelen: ${nev}`);
  return created;
}

async function upsertTemakor(tantargyId: string, nev: string) {
  const existing = await db.select().from(temakor).where(eq(temakor.tantargyId, tantargyId));
  const found = existing.find((t) => t.temakorNev === nev);
  if (found) return found;
  const [created] = await db.insert(temakor).values({ tantargyId, temakorNev: nev }).returning();
  if (!created) throw new Error(`Témakör létrehozása sikertelen: ${nev}`);
  return created;
}

export async function seed() {
  const informatika = await upsertAgazat("Informatika");
  const programozas = await upsertTantargy(informatika.agazatId, "Programozás");
  const backend = await upsertTantargy(informatika.agazatId, "Backend");
  const valtozok = await upsertTemakor(programozas.tantargyId, "Változók");
  const ciklusok = await upsertTemakor(programozas.tantargyId, "Ciklusok");
  const fuggvenyek = await upsertTemakor(programozas.tantargyId, "Függvények");
  const webHttp = await upsertTemakor(backend.tantargyId, "1. A Web Működése és a HTTP Protokoll.");
  const elokeszuletek = await upsertTemakor(
    backend.tantargyId,
    "2. Előkészületek: Telepített programok és beállítások.",
  );

  const elektronika = await upsertAgazat("Elektronika");
  const plcProgramozas = await upsertTantargy(elektronika.agazatId, "PLC programozás");
  const elektrotechnika = await upsertTantargy(elektronika.agazatId, "Elektrotechnika");

  const agazatByNev = new Map([
    ["Informatika", informatika.agazatId],
    ["Elektronika", elektronika.agazatId],
  ]);

  const credentials: string[] = [
    `Ágazat:   Informatika (${informatika.agazatId})`,
    `Tantárgy: Programozás (${programozas.tantargyId})`,
    `Témakörök: Változók (${valtozok.temakorId}), Ciklusok (${ciklusok.temakorId}), Függvények (${fuggvenyek.temakorId})`,
    `Tantárgy: Backend (${backend.tantargyId})`,
    `Témakörök: ${webHttp.temakorNev} (${webHttp.temakorId})`,
    `           ${elokeszuletek.temakorNev} (${elokeszuletek.temakorId})`,
    "",
    `Ágazat:   Elektronika (${elektronika.agazatId})`,
    `Tantárgy: PLC programozás (${plcProgramozas.tantargyId})`,
    `Tantárgy: Elektrotechnika (${elektrotechnika.tantargyId})`,
    "",
  ];

  for (const u of SEED_USERS) {
    const agazatId =
      u.jogosultsag === "tanulo" && "agazatNev" in u
        ? agazatByNev.get(u.agazatNev as string) ?? informatika.agazatId
        : null;
    await upsertUser({
      email: u.email,
      nev: u.nev,
      jelszo: u.jelszo,
      jogosultsag: u.jogosultsag,
      osztaly: u.osztaly,
      agazatId,
    });
    credentials.push(
      `${u.jogosultsag.toUpperCase()}`,
      `  E-mail:  ${u.email}`,
      `  Jelszó:  ${u.jelszo}`,
      u.osztaly ? `  Osztály: ${u.osztaly}` : "",
      u.jogosultsag === "tanulo" && "agazatNev" in u ? `  Ágazat:  ${u.agazatNev}` : "",
      "",
    );
  }

  for (const t of SEED_TANULOK) {
    const jelszo = generateInitialPassword(t.nev);
    const agazatId = agazatByNev.get(t.agazatNev) ?? informatika.agazatId;
    const email = t.email.toLowerCase();
    const existing = await db
      .select({ id: felhasznalo.felhasznaloId })
      .from(felhasznalo)
      .where(eq(felhasznalo.email, email))
      .limit(1);
    if (existing[0]) {
      await db
        .update(felhasznalo)
        .set({ jelszoHash: await hashPassword(jelszo) })
        .where(eq(felhasznalo.felhasznaloId, existing[0].id));
    } else {
      await upsertUser({
        email: t.email,
        nev: t.nev,
        jelszo,
        jogosultsag: "tanulo",
        osztaly: t.osztaly,
        agazatId,
      });
    }
    credentials.push(
      "TANULO",
      `  Név:     ${t.nev}`,
      `  E-mail:  ${t.email}`,
      `  Jelszó:  ${jelszo}`,
      `  Osztály: ${t.osztaly}`,
      `  Ágazat:  ${t.agazatNev}`,
      "",
    );
  }

  saveCredentials(credentials);

  console.log("Seed kész.");
  console.log(`  Belépési adatok mentve: ${CREDENTIALS_FILE}`);
  for (const u of SEED_USERS) {
    console.log(`  ${u.jogosultsag}: ${u.email} / ${u.jelszo}`);
  }
  for (const t of SEED_TANULOK) {
    console.log(`  tanulo: ${t.email} / ${generateInitialPassword(t.nev)}`);
  }
}

try {
  await seed();
} finally {
  await pgClient.end();
}
