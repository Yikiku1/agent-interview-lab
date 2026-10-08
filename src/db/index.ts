import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { databaseUrl } from "./config";

export const databaseClient = postgres(databaseUrl, { max: 10 });

export const db = drizzle(databaseClient, { schema });
