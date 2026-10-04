import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url =
  process.env.DATABASE_URL ??
  "postgres://interview:interview@localhost:5432/interview_practice";
const client = postgres(url, { max: 10 });

export const db = drizzle(client, { schema });
