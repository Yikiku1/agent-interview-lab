import { eq, inArray, or } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { questions, users } from "./schema";
import { resumeMetadata } from "../lib/learning-contract";
import { validateAnswerContent } from "./answer-quality";
import {
  getSeedQuestions,
  retiredQuestionTexts,
  type SeedQuestion,
} from "./seed-data";

export const expectedQuestionCounts: Record<string, number> = {
  Agent: 154,
  LLM: 82,
  RAG: 120,
  "LLM 应用工程": 144,
  Python: 68,
  后端: 60,
  数据库: 42,
};

export function validateQuestionBank(rows: SeedQuestion[]) {
  if (
    rows.some(
      (row) => row.tags.includes("简历专项") && resumeMetadata(row) === null,
    )
  )
    throw new Error(
      "Resume metadata must contain exactly one consistent project, priority and kind",
    );
  const total = Object.values(expectedQuestionCounts).reduce(
    (sum, count) => sum + count,
    0,
  );
  if (rows.length !== total)
    throw new Error(`Expected ${total} questions, got ${rows.length}`);
  if (new Set(rows.map((row) => row.question)).size !== rows.length)
    throw new Error("Question texts must be unique");
  if (
    retiredQuestionTexts.length !== 28 ||
    retiredQuestionTexts.some((text) =>
      rows.some((row) => row.question === text),
    )
  ) {
    throw new Error(
      "Retired algorithm questions must be absent from the live bank",
    );
  }
  for (const [category, count] of Object.entries(expectedQuestionCounts)) {
    if (rows.filter((row) => row.category === category).length !== count)
      throw new Error(`Invalid question count: ${category}`);
  }
  if (
    rows.some(
      (row) =>
        !(row.category in expectedQuestionCounts) || row.answer.length < 320,
    )
  ) {
    throw new Error("Found an unexpected category or an insufficient answer");
  }
  for (const row of rows)
    validateAnswerContent(
      row.question,
      row.answer,
      row.tags.includes("简历专项"),
    );
}

export async function seedQuestionBank(db: PostgresJsDatabase<typeof schema>) {
  const rows = getSeedQuestions();
  validateQuestionBank(rows);
  await db.transaction(async (tx) => {
    await tx.insert(users).values({ id: "default" }).onConflictDoNothing();
    for (const row of rows) {
      await tx
        .insert(questions)
        .values({ ...row, active: true })
        .onConflictDoUpdate({
          target: questions.question,
          set: {
            answer: row.answer,
            category: row.category,
            subcategory: row.subcategory,
            difficulty: row.difficulty,
            tags: row.tags,
            active: true,
            updatedAt: new Date(),
          },
        });
    }
    // Retiring a question preserves its progress and every historical event.
    await tx
      .update(questions)
      .set({ active: false, updatedAt: new Date() })
      .where(
        or(
          eq(questions.category, "前端"),
          inArray(questions.question, retiredQuestionTexts),
        ),
      );
  });
  return rows.length;
}
