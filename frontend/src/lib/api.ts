import type { Jogosultsag } from "@oktateszt/shared";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isForm = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const res = await fetch(path, {
    credentials: "include",
    ...init,
    headers: {
      ...(!isForm && init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
    details?: unknown;
  };

  if (!res.ok) {
    throw new ApiError(
      res.status,
      data.code ?? "ERROR",
      data.error ?? "Váratlan hiba történt.",
      data.details,
    );
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
  upload: <T>(path: string, body: FormData) => request<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  jogosultsag: Jogosultsag;
  osztaly: string | null;
  agazatId: string | null;
  agazatNev: string | null;
  jelszoValtastKer: boolean;
};

export function settingsFor(user: PublicUser): string {
  if (user.jogosultsag === "admin") return "/admin/beallitasok";
  if (user.jogosultsag === "tanar") return "/tanar/beallitasok";
  return "/tanulo/beallitasok";
}

export function homeFor(user: PublicUser): string {
  if (user.jelszoValtastKer) return settingsFor(user);
  if (user.jogosultsag === "admin") return "/admin/felhasznalok";
  if (user.jogosultsag === "tanar") return "/tanar/tesztek";
  return "/tanulo/vizsgak";
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("hu-HU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatDateNap(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("hu-HU", { dateStyle: "long" }).format(new Date(value));
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value)}%`;
}
