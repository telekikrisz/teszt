import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { KERDES_KEP_FAJL_MINTA } from "@oktateszt/shared";
import { ValidationAppError } from "./errors.js";

const MAX_BYTES = 5 * 1024 * 1024;
const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

export function kerdesKepMappa(): string {
  if (process.env.UPLOAD_DIR) return resolve(process.env.UPLOAD_DIR, "kerdes-kepek");
  return resolve(process.cwd(), "uploads/kerdes-kepek");
}

export function kerdesKepUtvonal(fajl: string): string {
  return resolve(kerdesKepMappa(), fajl);
}

export function kerdesKepMime(fajl: string): string {
  return MIME_BY_EXT[extname(fajl).toLowerCase()] ?? "application/octet-stream";
}

export function isKerdesKepFajl(fajl: string): boolean {
  return KERDES_KEP_FAJL_MINTA.test(fajl);
}

export async function mentsKerdesKep(file: {
  name: string;
  type: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}): Promise<string> {
  if (file.size <= 0) throw new ValidationAppError("A képfájl üres.");
  if (file.size > MAX_BYTES) {
    throw new ValidationAppError("A kép legfeljebb 5 MB lehet.");
  }

  const fromMime = EXT_BY_MIME[file.type];
  const fromName = extname(file.name).toLowerCase();
  const ext = fromMime ?? (MIME_BY_EXT[fromName] ? fromName : "");
  if (!ext) {
    throw new ValidationAppError("Csak JPG, PNG, GIF vagy WebP kép tölthető fel.");
  }

  const fajl = `${randomUUID()}${ext === ".jpeg" ? ".jpg" : ext}`;
  const mappa = kerdesKepMappa();
  await mkdir(mappa, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(kerdesKepUtvonal(fajl), buffer);
  return fajl;
}

export function letezikKerdesKep(fajl: string | null | undefined): boolean {
  if (!fajl || !isKerdesKepFajl(fajl)) return false;
  return existsSync(kerdesKepUtvonal(fajl));
}

export async function assertKerdesKep(fajl: string | null | undefined) {
  if (!fajl) return;
  if (!isKerdesKepFajl(fajl) || !existsSync(kerdesKepUtvonal(fajl))) {
    throw new ValidationAppError("A csatolt kép nem található. Töltsd fel újra.");
  }
}
