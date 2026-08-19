import { drizzle } from "drizzle-orm/postgres-js";
import { createPgClient } from "./client.js";
import * as schema from "./schema.js";

const client = createPgClient();

export const db = drizzle(client, { schema });
export type Database = typeof db;
export { client as pgClient };
