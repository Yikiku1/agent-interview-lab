import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import { questions, users } from "./schema";
import { getSeedQuestions, retiredQuestionTexts } from "./seed-data";

const url =
  process.env.DATABASE_URL ??
  "postgres://interview:interview@localhost:5432/interview_practice";
const client = postgres(url);
const db = drizzle(client);

async function main() {
  const rows = getSeedQuestions();
  const expected: Record<string, number> = {
    Agent: 120,
    LLM: 62,
    RAG: 90,
    "LLM 应用工程": 108,
    Python: 50,
    后端: 42,
    数据库: 28,
  };
  if (rows.length !== 500) {
    throw new Error(`Expected 500 questions, got ${rows.length}`);
  }
  if (new Set(rows.map((row) => row.question)).size !== rows.length) {
    throw new Error("Question texts must be unique");
  }
  if (
    retiredQuestionTexts.length !== 28 ||
    retiredQuestionTexts.some((question) =>
      rows.some((row) => row.question === question),
    )
  ) {
    throw new Error(
      "Retired algorithm questions must be absent from the live bank",
    );
  }
  for (const [category, count] of Object.entries(expected)) {
    const actual = rows.filter((row) => row.category === category).length;
    if (actual !== count)
      throw new Error(`${category}: expected ${count}, got ${actual}`);
  }
  if (
    rows.some((row) => !(row.category in expected) || row.answer.length < 320)
  ) {
    throw new Error("Found an unexpected category or an insufficient answer");
  }
  await db.transaction(async (tx) => {
    await tx.insert(users).values({ id: "default" }).onConflictDoNothing();
    for (const row of rows) {
      await tx
        .insert(questions)
        .values(row)
        .onConflictDoUpdate({
          target: questions.question,
          set: {
            answer: row.answer,
            category: row.category,
            subcategory: row.subcategory,
            difficulty: row.difficulty,
            tags: row.tags,
            updatedAt: new Date(),
          },
        });
    }
    await tx.delete(questions).where(eq(questions.category, "前端"));
    await tx
      .delete(questions)
      .where(inArray(questions.question, retiredQuestionTexts));
  });
  console.log(
    `Seeded ${rows.length} questions across ${Object.keys(expected).length} categories.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
