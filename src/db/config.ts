import { loadEnvConfig } from "@next/env";

// CLI tools use the same .env* resolution as the Next.js application.
loadEnvConfig(process.cwd(), process.env.NODE_ENV === "development");

export const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://interview:interview@localhost:5432/interview_practice";
