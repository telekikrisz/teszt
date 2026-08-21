import * as XLSX from "xlsx";

export type TanuloImportSor = {
  name: string;
  osztaly: string;
  agazatNev: string;
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function findColumnIndex(headers: unknown[], aliases: string[]): number {
  const normalized = headers.map(normalizeHeader);
  for (const alias of aliases) {
    const idx = normalized.indexOf(alias);
    if (idx >= 0) return idx;
  }
  return -1;
}

function rowsFromMatrix(matrix: unknown[][]): TanuloImportSor[] {
  if (matrix.length < 2) {
    throw new Error("A fájlban fejléc és legalább egy adatsor szükséges.");
  }

  const headers = matrix[0] ?? [];
  const nevIdx = findColumnIndex(headers, ["nev", "name"]);
  const osztalyIdx = findColumnIndex(headers, ["osztaly", "class"]);
  const agazatIdx = findColumnIndex(headers, ["agazat", "branch"]);

  if (nevIdx < 0 || osztalyIdx < 0 || agazatIdx < 0) {
    throw new Error(
      "A fejlécnek tartalmaznia kell a következő oszlopokat: Név, Osztály, Ágazat.",
    );
  }

  const out: TanuloImportSor[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    const name = String(row[nevIdx] ?? "").trim();
    const osztaly = String(row[osztalyIdx] ?? "").trim();
    const agazatNev = String(row[agazatIdx] ?? "").trim();
    if (!name && !osztaly && !agazatNev) continue;
    out.push({ name, osztaly, agazatNev });
  }

  if (out.length === 0) {
    throw new Error("Nincs importálható tanulósor a fájlban.");
  }
  return out;
}

function parseDelimitedText(text: string): TanuloImportSor[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error("A fájlban fejléc és legalább egy adatsor szükséges.");
  }

  const delimiter = lines[0]!.includes("\t") ? "\t" : lines[0]!.includes(";") ? ";" : ",";
  const matrix = lines.map((line) => line.split(delimiter).map((cell) => cell.trim()));
  return rowsFromMatrix(matrix);
}

/** Excel (.xlsx/.xls) első lapja, vagy CSV/TSV/TXT (tab/vessző/pontosvessző). */
export async function parseTanuloImportFile(file: File): Promise<TanuloImportSor[]> {
  const name = file.name.toLowerCase();
  const isExcel = name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".xlsm");
  const isText =
    name.endsWith(".csv") ||
    name.endsWith(".tsv") ||
    name.endsWith(".txt") ||
    file.type.startsWith("text/");

  if (isExcel || (!isText && (file.type.includes("sheet") || file.type.includes("excel")))) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error("A munkafüzet üres.");
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) throw new Error("Az első lap nem olvasható.");
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    }) as unknown[][];
    return rowsFromMatrix(matrix);
  }

  if (isText || name.endsWith(".csv") || name.endsWith(".tsv") || name.endsWith(".txt")) {
    return parseDelimitedText(await file.text());
  }

  // Próbáljuk Excelként, majd szövegként
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (sheetName && workbook.Sheets[sheetName]) {
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName]!, {
        header: 1,
        defval: "",
        raw: false,
      }) as unknown[][];
      return rowsFromMatrix(matrix);
    }
  } catch {
    /* fall through */
  }

  return parseDelimitedText(await file.text());
}
