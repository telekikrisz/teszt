import * as XLSX from "xlsx";
import { importKerdesSorSchema, parseEvfolyamMezo, type ImportKerdesSorInput } from "@oktateszt/shared";

export const KERDES_IMPORT_MAX_VALASZ = 12;
const MAX_SOR = 200;

export type KerdesImportHiba = { sor: number; uzenet: string };

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function findColumnIndex(headers: unknown[], aliases: string[]): number {
  const normalized = headers.map(normalizeHeader);
  for (const alias of aliases) {
    const idx = normalized.indexOf(alias);
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseJo(value: unknown, sor: number, oszlop: string): boolean {
  const raw = String(value ?? "").trim();
  if (!raw) return false;
  const n = normalizeHeader(raw);
  if (["igen", "i", "x", "1", "true", "igaz", "jo", "helyes", "yes", "y"].includes(n)) return true;
  if (["nem", "n", "0", "false", "hamis", "rossz", "no"].includes(n)) return false;
  throw new Error(`${sor}. sor: a(z) ${oszlop} oszlop értéke legyen IGEN vagy NEM (most: „${raw}”).`);
}

function parsePontszam(value: unknown, sor: number): number {
  const raw = String(value ?? "").trim();
  if (!raw) return 1;
  const n = Number(raw.replace(",", "."));
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`${sor}. sor: a pontszám pozitív egész szám legyen (üresen hagyva 1).`);
  }
  return n;
}

function valaszOszlopok(headers: unknown[]): { szovegIdx: number; joIdx: number; sorszam: number }[] {
  const out: { szovegIdx: number; joIdx: number; sorszam: number }[] = [];
  for (let i = 1; i <= KERDES_IMPORT_MAX_VALASZ; i++) {
    const szovegIdx = findColumnIndex(headers, [`valasz ${i}`, `valasz${i}`, `opcio ${i}`, `opcio${i}`]);
    const joIdx = findColumnIndex(headers, [`jo ${i}`, `jo${i}`, `helyes ${i}`, `helyes${i}`]);
    if (szovegIdx < 0 && joIdx < 0) continue;
    if (szovegIdx < 0 || joIdx < 0) {
      throw new Error(
        `Hiányzik a „Válasz ${i}” vagy a „Jó ${i}” oszlop. Ha új válaszoszlopot adsz a sablonhoz, mindkettő kell (pl. Válasz 5 és Jó 5).`,
      );
    }
    out.push({ szovegIdx, joIdx, sorszam: i });
  }
  return out;
}

function rowsFromMatrix(matrix: unknown[][]): ImportKerdesSorInput[] {
  if (matrix.length < 2) {
    throw new Error("A fájlban fejléc és legalább egy adatsor szükséges. Töltsd le a sablont.");
  }

  const headers = matrix[0] ?? [];
  const evfolyamIdx = findColumnIndex(headers, ["evfolyam", "evf"]);
  const agazatIdx = findColumnIndex(headers, ["agazat"]);
  const tantargyIdx = findColumnIndex(headers, ["tantargy"]);
  const temakorIdx = findColumnIndex(headers, ["temakor", "tema"]);
  const szovegIdx = findColumnIndex(headers, ["kerdes", "kerdes szovege", "szoveg", "feladat"]);
  const pontIdx = findColumnIndex(headers, ["pontszam", "pont"]);

  if (evfolyamIdx < 0 || agazatIdx < 0 || tantargyIdx < 0 || temakorIdx < 0 || szovegIdx < 0) {
    throw new Error(
      "A fejlécnek tartalmaznia kell: Évfolyam, Ágazat, Tantárgy, Témakör, Kérdés. Töltsd le a sablont, és abban dolgozz.",
    );
  }

  const valaszokOsz = valaszOszlopok(headers);
  if (valaszokOsz.length < 2) {
    throw new Error(
      "Legalább két válaszoszlop kell (Válasz 1, Jó 1, Válasz 2, Jó 2, …). Töltsd le a sablont. Kérdésenként eltérő számú válasz megadható: a felesleges cellákat hagyd üresen, vagy szúrj be új Válasz N / Jó N oszlopokat (max. 12).",
    );
  }

  const hibak: string[] = [];
  const out: ImportKerdesSorInput[] = [];

  for (let r = 1; r < matrix.length; r++) {
    const excelSor = r + 1;
    const row = matrix[r] ?? [];
    const evfolyamNyers = String(row[evfolyamIdx] ?? "").trim();
    const agazatNev = String(row[agazatIdx] ?? "").trim();
    const tantargyNev = String(row[tantargyIdx] ?? "").trim();
    const temakorNev = String(row[temakorIdx] ?? "").trim();
    const szoveg = String(row[szovegIdx] ?? "").trim();
    const valaszNyers = valaszokOsz.map((o) => String(row[o.szovegIdx] ?? "").trim());
    const ures =
      !evfolyamNyers && !agazatNev && !tantargyNev && !temakorNev && !szoveg && valaszNyers.every((v) => !v);
    if (ures) continue;

    try {
      const evfolyam = parseEvfolyamMezo(evfolyamNyers);
      if (!evfolyam.ok) {
        hibak.push(`${excelSor}. sor: ${evfolyam.uzenet}`);
        continue;
      }

      const valaszok = [];
      for (const o of valaszokOsz) {
        const vszoveg = String(row[o.szovegIdx] ?? "").trim();
        if (!vszoveg) continue;
        valaszok.push({
          szoveg: vszoveg,
          jo: parseJo(row[o.joIdx], excelSor, `Jó ${o.sorszam}`),
        });
      }
      const parsed = importKerdesSorSchema.safeParse({
        sor: excelSor,
        evfolyamErtek: evfolyam.ertek,
        agazatNev,
        tantargyNev,
        temakorNev,
        szoveg,
        pontszam: parsePontszam(pontIdx >= 0 ? row[pontIdx] : "", excelSor),
        valaszok,
      });
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          hibak.push(`${excelSor}. sor: ${issue.message}`);
        }
        continue;
      }
      out.push(parsed.data);
    } catch (err) {
      hibak.push(err instanceof Error ? err.message : `${excelSor}. sor: ismeretlen hiba.`);
    }
  }

  if (out.length === 0 && hibak.length === 0) {
    throw new Error("Nincs importálható kérdéssor a fájlban.");
  }
  if (out.length > MAX_SOR) {
    throw new Error(`Egyszerre legfeljebb ${MAX_SOR} kérdés importálható (most ${out.length} sor van).`);
  }
  if (hibak.length > 0) {
    throw new Error(`Az import fájl hibás, ezért semmi sem került be:\n${[...new Set(hibak)].join("\n")}`);
  }
  return out;
}

function parseDelimitedText(text: string): ImportKerdesSorInput[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error("A fájlban fejléc és legalább egy adatsor szükséges. Töltsd le a sablont.");
  }
  const delimiter = lines[0]!.includes("\t") ? "\t" : lines[0]!.includes(";") ? ";" : ",";
  const matrix = lines.map((line) => line.split(delimiter).map((cell) => cell.trim()));
  return rowsFromMatrix(matrix);
}

function matrixFromWorkbook(workbook: XLSX.WorkBook): unknown[][] {
  const sheetName = workbook.SheetNames.find((n) => normalizeHeader(n) === "kerdesek") ?? workbook.SheetNames[0];
  if (!sheetName) throw new Error("A munkafüzet üres.");
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error("Az első lap nem olvasható.");
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];
}

/** Excel (.xlsx/.xls) Kérdések lapja, vagy CSV/TSV/TXT. */
export async function parseKerdesImportFile(file: File): Promise<ImportKerdesSorInput[]> {
  const name = file.name.toLowerCase();
  const isExcel = name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".xlsm");
  const isText =
    name.endsWith(".csv") ||
    name.endsWith(".tsv") ||
    name.endsWith(".txt") ||
    file.type.startsWith("text/");

  if (isExcel || (!isText && (file.type.includes("sheet") || file.type.includes("excel")))) {
    return rowsFromMatrix(matrixFromWorkbook(XLSX.read(await file.arrayBuffer(), { type: "array" })));
  }

  if (isText) return parseDelimitedText(await file.text());

  try {
    return rowsFromMatrix(matrixFromWorkbook(XLSX.read(await file.arrayBuffer(), { type: "array" })));
  } catch {
    /* fall through */
  }

  return parseDelimitedText(await file.text());
}

function valaszFejlec(db: number): string[] {
  const out: string[] = [];
  for (let i = 1; i <= db; i++) {
    out.push(`Válasz ${i}`, `Jó ${i}`);
  }
  return out;
}

export function downloadKerdesImportSablon() {
  const headers = ["Évfolyam", "Ágazat", "Tantárgy", "Témakör", "Kérdés", "Pontszám", ...valaszFejlec(6)];
  const peldak = [
    [
      "11",
      "Informatika",
      "Adatbázis-kezelés I",
      "SQL alapok",
      "Mi a PRIMARY KEY szerepe?",
      1,
      "Egyedi azonosító a soroknak",
      "IGEN",
      "Csak szöveges mező lehet",
      "NEM",
      "Törli a táblát",
      "NEM",
      "Index a fájlrendszeren",
      "NEM",
      "",
      "",
      "",
      "",
    ],
    [
      "11",
      "Informatika",
      "Adatbázis-kezelés I",
      "SQL alapok",
      "Mely állítások igazak a SELECT-re?",
      1,
      "Lekérdezésre szolgál",
      "IGEN",
      "Adatot töröl",
      "NEM",
      "Több táblát is összekapcsolhat",
      "IGEN",
      "Csak egy sort adhat vissza",
      "NEM",
      "WHERE-rel szűrhető",
      "NEM",
      "",
      "",
    ],
  ];

  const utmutato = [
    ["Kérdések importálása — útmutató"],
    [""],
    ["Minden sort tölts ki a Kérdések lapon. Egy fájlban keverhetők a különböző évfolyamok, ágazatok és tantárgyak."],
    [""],
    ["Évfolyam: 9–13 (elég a szám, pl. 11)."],
    ["Ágazat és tantárgy: pontosan úgy, ahogy a rendszerben szerepel. Új ágazat/tantárgy importból NEM jön létre."],
    ["Témakör: ha még nincs ilyen a tantárgy alatt, a rendszer létrehozza."],
    ["Pontszám: egész szám, legalább 1. Üresen hagyva 1 pont."],
    [""],
    ["Válaszok: kérdésenként eltérő számú lehet. Az 1. kérdéshez elég 4 kitöltött válasz, a 2.-hoz 5 — a többi cella maradhat üres."],
    ["Ha 6-nál több válasz kell, szúrj be új oszlopokat: Válasz 7, Jó 7, Válasz 8, Jó 8, … (legfeljebb 12)."],
    ["A Jó oszlopba írj IGEN vagy NEM (elfogadott: igen, i, x, 1 / nem, n, 0)."],
    ["Egy IGEN = egyválasztós. Több IGEN = többválasztós — legalább annyi NEM kell, mint IGEN."],
    [""],
    ["Ha egy sor hibás (pl. nincs ilyen tantárgy abban az ágazatban), a teljes fájl elutasításra kerül, semmi sem kerül be."],
    ["Üres sorok kimaradnak. Egyszerre legfeljebb 200 kérdés."],
    ["Képet a sablon nem tartalmaz — azt a feladat szerkesztőjében lehet csatolni vagy beilleszteni (Ctrl+V)."],
  ];

  const wb = XLSX.utils.book_new();
  const kerdesek = XLSX.utils.aoa_to_sheet([headers, ...peldak]);
  kerdesek["!cols"] = [
    { wch: 10 },
    { wch: 16 },
    { wch: 22 },
    { wch: 16 },
    { wch: 48 },
    { wch: 10 },
    ...Array.from({ length: 12 }, (_, i) => ({ wch: i % 2 === 0 ? 28 : 8 })),
  ];
  XLSX.utils.book_append_sheet(wb, kerdesek, "Kérdések");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(utmutato), "Útmutató");
  XLSX.writeFile(wb, "kerdes-import-sablon.xlsx");
}
