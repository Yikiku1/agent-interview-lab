import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { databaseUrl } from "./config";
import { seedQuestionBank } from "./seed-bank";

const client = postgres(databaseUrl);
const db = drizzle(client, { schema });

async function main() {
  const count = await seedQuestionBank(db);
  console.log(`Seeded ${count} questions across 7 categories.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
