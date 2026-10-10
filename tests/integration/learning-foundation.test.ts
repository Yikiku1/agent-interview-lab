import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { eq } from "drizzle-orm";
import {
  answerPointChecks,
  learningTargets,
  personalAnswerCards,
  practiceGaps,
  practiceObservations,
  questions,
  reviewEvents,
  userQuestionProgress,
  users,
} from "../../src/db/schema";
import { migrateLearningFoundation } from "../../src/db/migrate-learning-foundation";
import { seedQuestionBank } from "../../src/db/seed-bank";
import { practiceObservationPayload } from "../../src/lib/learning-contract";
import { startTestDatabase } from "../helpers/postgres";

let database: Awaited<ReturnType<typeof startTestDatabase>>;
let store: typeof import("../../src/db");
let attempts: typeof import("../../src/app/api/attempts/route");
let baseline: string;

before(async () => {
  database = await startTestDatabase({ pushSchema: false });
  process.env.DATABASE_URL = database.url;
  store = await import("../../src/db");
  attempts = await import("../../src/app/api/attempts/route");
  baseline = await readFile("tests/fixtures/pre-w0-schema.sql", "utf8");
});
after(async () => {
  if (store) await store.databaseClient.end();
  if (database) await database.stop();
});
beforeEach(async () => {
  // This connection is created by startTestDatabase on an ephemeral port, never the personal DB.
  await store.databaseClient.unsafe(
    "DROP SCHEMA public CASCADE; CREATE SCHEMA public",
  );
  await store.databaseClient.unsafe(baseline);
  await store.db.insert(users).values([{ id: "default" }, { id: "other" }]);
});

async function addQuestion(text = "Migration question") {
  const [question] = await store.db
    .insert(questions)
    .values({
      question: text,
      answer: "Original public answer",
      category: "Agent",
      subcategory: "Test",
      difficulty: "medium",
    })
    .returning();
  return question;
}
function complete(
  questionId: number,
  attemptId = randomUUID(),
  answer = "我的原始回答",
) {
  return attempts.POST(
    new Request("http://localhost/api/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, attemptId, answer, status: "fuzzy" }),
    }),
  );
}
async function originalSnapshot() {
  const snapshot = [];
  for (const table of [
    "users",
    "questions",
    "user_question_progress",
    "review_events",
  ])
    snapshot.push(
      await store.databaseClient.unsafe(`select * from ${table} order by 1, 2`),
    );
  return JSON.stringify(snapshot);
}
async function observe(
  questionId: number,
  reviewEventId: number | null = null,
  userId = "default",
) {
  const payload = practiceObservationPayload.parse({
    requestId: randomUUID(),
    questionId,
    reviewEventId,
    gaps: [{ kind: "evidence", note: "补一个例子" }],
  });
  const [observation] = await store.db
    .insert(practiceObservations)
    .values({
      userId,
      questionId,
      reviewEventId,
      requestId: payload.requestId,
      payload,
    })
    .returning();
  return observation;
}

test("four-table baseline migrates atomically, preserving IDs, timestamps, answers and attempt retry semantics", async () => {
  await seedQuestionBank(store.db);
  const [question] = await store.db.select().from(questions).limit(1);
  const attemptId = randomUUID();
  assert.equal((await complete(question.id, attemptId)).status, 201);
  const before = await originalSnapshot();
  const [first, concurrent] = await Promise.all([
    migrateLearningFoundation(store.databaseClient),
    migrateLearningFoundation(store.databaseClient),
  ]);
  assert.deepEqual([first.applied, concurrent.applied].sort(), [false, true]);
  assert.equal(await originalSnapshot(), before);
  assert.equal((await complete(question.id, attemptId)).status, 200);
  assert.equal(
    (await complete(question.id, attemptId, "不同内容")).status,
    409,
  );
  assert.equal(await originalSnapshot(), before);
  assert.equal(
    (await migrateLearningFoundation(store.databaseClient)).applied,
    false,
  );
  const [count] =
    await store.databaseClient`select count(*)::int as total from app_schema_migrations`;
  assert.equal(count.total, 1);
  const [event] = await store.db.select().from(reviewEvents);
  assert.equal(event.attemptId, attemptId);
  assert.equal((await complete(question.id)).status, 201);
  const [progress] = await store.db.select().from(userQuestionProgress);
  assert.equal(progress.reviewCount, 2);
});

test("partial tables and conflicting indexes abort without leaving migration tables or changing baseline records", async () => {
  await addQuestion();
  const before = await originalSnapshot();
  await store.databaseClient.unsafe(
    "CREATE TABLE learning_targets (sentinel text)",
  );
  await assert.rejects(
    () => migrateLearningFoundation(store.databaseClient),
    /不能自动接管/,
  );
  assert.equal(await originalSnapshot(), before);
  assert.equal(
    (
      await store.databaseClient`select to_regclass('public.app_schema_migrations') as name`
    )[0].name,
    null,
  );
  await store.databaseClient.unsafe(
    "DROP TABLE learning_targets; CREATE INDEX review_events_identity_unique ON review_events (id)",
  );
  await assert.rejects(() => migrateLearningFoundation(store.databaseClient));
  assert.equal(await originalSnapshot(), before);
  const [row] =
    await store.databaseClient`select to_regclass('public.learning_targets') as target, to_regclass('public.app_schema_migrations') as journal`;
  assert.equal(row.target, null);
  assert.equal(row.journal, null);
  await store.databaseClient.unsafe("DROP INDEX review_events_identity_unique");
  assert.equal(
    (await migrateLearningFoundation(store.databaseClient)).applied,
    true,
  );
  await store.databaseClient`update app_schema_migrations set checksum = 'tampered'`;
  await assert.rejects(
    () => migrateLearningFoundation(store.databaseClient),
    /不能改写历史文件/,
  );
});

test("one active target per user and unique request IDs preserve previous target versions without practice writes", async () => {
  await migrateLearningFoundation(store.databaseClient);
  const before = await originalSnapshot();
  const target = {
    userId: "default",
    requestId: randomUUID(),
    preset: "resume_focus" as const,
    dailyMinutes: 10,
  };
  const [saved] = await store.db
    .insert(learningTargets)
    .values(target)
    .returning();
  await assert.rejects(() =>
    store.db
      .insert(learningTargets)
      .values({ ...target, requestId: randomUUID() }),
  );
  await store.db.transaction(async (tx) => {
    await tx
      .update(learningTargets)
      .set({ active: false })
      .where(eq(learningTargets.id, saved.id));
    await tx
      .insert(learningTargets)
      .values({ ...target, requestId: randomUUID(), projectScope: "综合" });
  });
  await assert.rejects(() =>
    store.db.insert(learningTargets).values({ ...target, active: false }),
  );
  assert.equal((await store.db.select().from(learningTargets)).length, 2);
  for (const invalid of [
    { dailyMinutes: 15 },
    { preset: "general_core" as const, priority: "P0" as const },
    { preset: "project_story" as const, projectScope: "技术基础" as const },
  ])
    await assert.rejects(() =>
      store.db.insert(learningTargets).values({
        ...target,
        ...invalid,
        userId: "other",
        requestId: randomUUID(),
      }),
    );
  assert.equal(await originalSnapshot(), before);
});

test("observation ownership, point positions and gap kinds are enforced without rewriting historical answers", async () => {
  await migrateLearningFoundation(store.databaseClient);
  const first = await addQuestion();
  const second = await addQuestion("Other question");
  assert.equal((await complete(first.id)).status, 201);
  const [event] = await store.db.select().from(reviewEvents);
  await assert.rejects(() => observe(first.id, event.id, "other"));
  await assert.rejects(() => observe(second.id, event.id));
  const observation = await observe(first.id, event.id);
  await assert.rejects(() =>
    store.db
      .insert(practiceObservations)
      .values({ ...observation, id: randomUUID() }),
  );
  const point = {
    observationId: observation.id,
    userId: "default",
    questionId: first.id,
    position: 0,
    pointTextSnapshot: "当时的要点",
    covered: false,
  };
  await store.db.insert(answerPointChecks).values(point);
  await assert.rejects(() => store.db.insert(answerPointChecks).values(point));
  await assert.rejects(() =>
    store.db.insert(answerPointChecks).values({ ...point, position: 3 }),
  );
  await assert.rejects(() =>
    store.db
      .insert(answerPointChecks)
      .values({ ...point, position: 1, userId: "other" }),
  );
  await store.db.insert(practiceGaps).values({
    observationId: observation.id,
    userId: "default",
    questionId: first.id,
    kind: "evidence",
  });
  await assert.rejects(() =>
    store.db.insert(practiceGaps).values({
      observationId: observation.id,
      userId: "default",
      questionId: first.id,
      kind: "concept",
      note: "x".repeat(2001),
    }),
  );
  const before = await originalSnapshot();
  await store.db
    .update(questions)
    .set({ answer: "Updated public answer", active: false })
    .where(eq(questions.id, first.id));
  const [check] = await store.db.select().from(answerPointChecks);
  assert.equal(check.pointTextSnapshot, "当时的要点");
  const [historical] = await store.db.select().from(reviewEvents);
  assert.equal(historical.answer, event.answer);
  await assert.rejects(() =>
    store.db.delete(reviewEvents).where(eq(reviewEvents.id, event.id)),
  );
  await assert.rejects(() =>
    store.db.delete(questions).where(eq(questions.id, first.id)),
  );
  await store.db
    .update(questions)
    .set({ answer: first.answer, active: true })
    .where(eq(questions.id, first.id));
  assert.equal(await originalSnapshot(), before);
});

test("reseeding preserves all personal tables, and individual cards and observations add no completion count", async () => {
  await migrateLearningFoundation(store.databaseClient);
  await seedQuestionBank(store.db);
  const [question] = await store.db.select().from(questions).limit(1);
  await store.db.insert(personalAnswerCards).values({
    userId: "default",
    questionId: question.id,
    shortAnswer: "我的版本",
    evidence: null,
  });
  await store.db.insert(learningTargets).values({
    userId: "default",
    requestId: randomUUID(),
    preset: "resume_focus",
    dailyMinutes: 5,
  });
  const observation = await observe(question.id);
  await store.db.insert(answerPointChecks).values({
    observationId: observation.id,
    userId: "default",
    questionId: question.id,
    position: 0,
    pointTextSnapshot: "历史要点",
    covered: true,
  });
  await store.db.insert(practiceGaps).values({
    observationId: observation.id,
    userId: "default",
    questionId: question.id,
    kind: "evidence",
  });
  await assert.rejects(() =>
    store.db
      .insert(personalAnswerCards)
      .values({ userId: "default", questionId: question.id }),
  );
  await assert.rejects(() =>
    store.db
      .insert(personalAnswerCards)
      .values({ userId: "other", questionId: question.id, revision: 0 }),
  );
  await assert.rejects(() =>
    store.db.insert(personalAnswerCards).values({
      userId: "other",
      questionId: question.id,
      evidence: "x".repeat(10001),
    }),
  );
  const before = JSON.stringify(
    await Promise.all([
      store.db.select().from(learningTargets),
      store.db.select().from(personalAnswerCards),
      store.db.select().from(practiceObservations),
      store.db.select().from(answerPointChecks),
      store.db.select().from(practiceGaps),
    ]),
  );
  await seedQuestionBank(store.db);
  assert.equal(
    JSON.stringify(
      await Promise.all([
        store.db.select().from(learningTargets),
        store.db.select().from(personalAnswerCards),
        store.db.select().from(practiceObservations),
        store.db.select().from(answerPointChecks),
        store.db.select().from(practiceGaps),
      ]),
    ),
    before,
  );
  assert.deepEqual(await store.db.select().from(reviewEvents), []);
  assert.deepEqual(await store.db.select().from(userQuestionProgress), []);
});
