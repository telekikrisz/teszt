import postgres from "postgres";
import { env } from "../env.js";

/**
 * Neon pooler (PgBouncer) nem támogatja a prepared statementeket,
 * és a libpq `channel_binding` paraméterét a Node kliens nem kezeli.
 * SSL a Neonon kötelező; helyi Postgresnél nem.
 */
export function createPgClient(options?: { max?: number }) {
  const url = new URL(env.DATABASE_URL);
  url.searchParams.delete("channel_binding");

  const isNeon = url.hostname.includes("neon.tech");

  return postgres(url.toString(), {
    max: options?.max ?? 10,
    idle_timeout: 20,
    connect_timeout: 30,
    ssl: isNeon ? "require" : undefined,
    prepare: isNeon ? false : undefined,
  });
}
