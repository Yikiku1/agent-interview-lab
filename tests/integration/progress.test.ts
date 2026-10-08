import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, test } from "node:test";
import { eq } from "drizzle-orm";
import {
  questions,
  reviewEvents,
  userQuestionProgress,
  users,
} from "../../src/db/schema";
import { seedQuestionBank } from "../../src/db/seed-bank";
import { retiredQuestionTexts } from "../../src/db/seed-data";
import { startTestDatabase } from "../helpers/postgres";

let database: Awaited<ReturnType<typeof startTestDatabase>>;
let store: typeof import("../../src/db");
let api: typeof import("../../src/app/api/progress/route");
let attempts: typeof import("../../src/app/api/attempts/route");
let queries: typeof import("../../src/lib/questions");

before(async () => {
  database = await startTestDatabase();
  process.env.DATABASE_URL = database.url;
  store = await import("../../src/db");
  api = await import("../../src/app/api/progress/route");
  attempts = await import("../../src/app/api/attempts/route");
  queries = await import("../../src/lib/questions");
});

after(async () => {
  if (store) await store.databaseClient.end();
  if (database) await database.stop();
});

beforeEach(async () => {
  await store.databaseClient.unsafe(
    "TRUNCATE review_events, user_question_progress, questions, users RESTART IDENTITY CASCADE",
  );
  await store.db.insert(users).values({ id: "default" });
});

async function addQuestion(question = "Test question", active = true) {
  const [row] = await store.db
    .insert(questions)
    .values({
      question,
      answer: "Test answer",
      category: "Agent",
      subcategory: "Test",
      difficulty: "easy",
      active,
    })
    .returning();
  return row;
}

function mark(id: number, status: string) {
  return api.PUT(
    new Request("http://localhost/api/progress", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: id, status }),
    }),
  );
}

function complete(
  id: number,
  status: string,
  answer = "My explanation",
  attemptId = randomUUID(),
  roundId?: string,
) {
  return attempts.POST(
    new Request("http://localhost/api/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId: id,
        status,
        answer,
        attemptId,
        roundId,
      }),
    }),
  );
}

test("status edits update mastery without adding a completed practice or review count", async () => {
  const question = await addQuestion();
  assert.equal((await mark(question.id, "unknown")).status, 200);
  assert.equal((await mark(question.id, "mastered")).status, 200);
  const [progress] = await store.db.select().from(userQuestionProgress);
  assert.equal(progress.status, "mastered");
  assert.equal(progress.reviewCount, 0);
  assert.equal((await store.db.select().from(reviewEvents)).length, 0);
  const stats = await queries.getDashboard();
  assert.equal(stats.totalReviews, 0);
  assert.equal(stats.todayReviews, 0);
  assert.equal(stats.marked, 1);
});

test("completion saves the answer once and concurrent retries do not repeat statistics", async () => {
  const question = await addQuestion();
  const attemptId = randomUUID();
  const results = await Promise.all(
    Array.from({ length: 5 }, () =>
      complete(question.id, "fuzzy", "  My answer\nsecond line  ", attemptId),
    ),
  );
  assert.deepEqual(
    results.map((response) => response.status).sort(),
    [200, 200, 200, 200, 201],
  );
  const events = await store.db.select().from(reviewEvents);
  assert.equal(events.length, 1);
  assert.equal(events[0].answer, "My answer\nsecond line");
  assert.equal(events[0].kind, "practice");
  const [progress] = await store.db.select().from(userQuestionProgress);
  assert.equal(progress.reviewCount, 1);
  const stats = await queries.getDashboard();
  assert.equal(stats.totalReviews, 1);
  assert.equal(stats.todayReviews, 1);
  assert.equal(stats.legacyReviews, 0);
  await mark(question.id, "mastered");
  const [edited] = await store.db.select().from(userQuestionProgress);
  assert.equal(edited.reviewCount, 1);
  assert.equal(
    edited.lastReviewedAt.getTime(),
    progress.lastReviewedAt.getTime(),
  );
  assert.equal(
    (await complete(question.id, "unknown", "Different", attemptId)).status,
    409,
  );
  assert.equal(
    (await store.db.select().from(reviewEvents))[0].answer,
    "My answer\nsecond line",
  );
  assert.equal(
    (await store.db.select().from(userQuestionProgress))[0].status,
    "mastered",
  );
});

test("failure in the progress write rolls back the completed event and retry succeeds", async () => {
  const question = await addQuestion();
  await mark(question.id, "fuzzy");
  await store.databaseClient.unsafe(`
    CREATE FUNCTION fail_review_event() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'injected event failure'; END; $$;
    CREATE TRIGGER fail_review_event BEFORE INSERT ON user_question_progress
    FOR EACH ROW EXECUTE FUNCTION fail_review_event();
  `);
  try {
    assert.equal((await complete(question.id, "mastered")).status, 500);
    const [progress] = await store.db.select().from(userQuestionProgress);
    assert.equal(progress.status, "fuzzy");
    assert.equal(progress.reviewCount, 0);
    assert.equal((await store.db.select().from(reviewEvents)).length, 0);
  } finally {
    await store.databaseClient.unsafe(
      "DROP TRIGGER fail_review_event ON user_question_progress; DROP FUNCTION fail_review_event();",
    );
  }
  assert.equal((await complete(question.id, "mastered")).status, 201);
});

test("invalid, missing and retired questions do not produce progress or events", async () => {
  const retired = await addQuestion("Retired", false);
  assert.equal((await mark(retired.id, "unknown")).status, 404);
  assert.equal((await mark(999, "unknown")).status, 404);
  assert.equal((await complete(retired.id, "unknown")).status, 404);
  assert.equal((await complete(999, "unknown")).status, 404);
  assert.equal((await complete(retired.id, "invalid")).status, 400);
  assert.equal(
    (await complete(retired.id, "unknown", "x".repeat(10001))).status,
    400,
  );
  assert.equal((await mark(retired.id, "invalid")).status, 400);
  assert.equal(
    (
      await api.PUT(
        new Request("http://localhost/api/progress", {
          method: "PUT",
          body: "invalid json",
        }),
      )
    ).status,
    400,
  );
  assert.deepEqual(await store.db.select().from(reviewEvents), []);
  assert.deepEqual(await store.db.select().from(userQuestionProgress), []);
});

test("review list and practice share unknown-first, oldest-first ordering", async () => {
  const fuzzy = await addQuestion("Fuzzy older");
  const recent = await addQuestion("Unknown recent");
  const old = await addQuestion("Unknown old");
  await store.db.insert(userQuestionProgress).values([
    {
      userId: "default",
      questionId: fuzzy.id,
      status: "fuzzy",
      lastReviewedAt: new Date("2020-01-01"),
    },
    {
      userId: "default",
      questionId: recent.id,
      status: "unknown",
      lastReviewedAt: new Date("2022-01-01"),
    },
    {
      userId: "default",
      questionId: old.id,
      status: "unknown",
      lastReviewedAt: new Date("2021-01-01"),
    },
  ]);
  const expected = [old.id, recent.id, fuzzy.id];
  assert.deepEqual(
    (await queries.getReviewQuestions()).map((row) => row.question.id),
    expected,
  );
  assert.deepEqual(
    (await queries.getPracticeQuestions({}, "both")).map(
      (row) => row.question.id,
    ),
    expected,
  );
  await mark(old.id, "mastered");
  assert.deepEqual(
    (await queries.getPracticeQuestions({}, "both")).map(
      (row) => row.question.id,
    ),
    [recent.id, fuzzy.id],
  );
  assert.equal((await queries.getQuestionsByIds(expected)).length, 3);
});

test("repeated seeding preserves live progress and retires old content without deleting history", async () => {
  const retired = await addQuestion(retiredQuestionTexts[0]);
  await complete(retired.id, "unknown");
  await seedQuestionBank(store.db);
  const [retiredRow] = await store.db
    .select()
    .from(questions)
    .where(eq(questions.id, retired.id));
  assert.equal(retiredRow.active, false);
  assert.equal(await queries.getQuestion(retired.id), undefined);
  assert.equal((await queries.listQuestions()).total, 570);
  assert.equal((await queries.getDashboard()).totalReviews, 1);
  const live = (await queries.listQuestions()).rows[0].question;
  await complete(live.id, "fuzzy");
  await seedQuestionBank(store.db);
  assert.equal((await queries.listQuestions()).total, 570);
  assert.equal((await queries.getDashboard()).totalReviews, 2);
  const [progress] = await store.db
    .select()
    .from(userQuestionProgress)
    .where(eq(userQuestionProgress.questionId, live.id));
  assert.equal(progress.status, "fuzzy");
  assert.equal(progress.reviewCount, 1);
  await assert.rejects(() =>
    store.db.delete(questions).where(eq(questions.id, retired.id)),
  );
});

test("history is paginated newest-first and old events keep their counting semantics", async () => {
  const question = await addQuestion();
  const another = await addQuestion("Another question");
  await store.db.insert(users).values({ id: "another-user" });
  const date = new Date("2020-01-01");
  for (let i = 0; i < 12; i++) {
    await store.db.insert(reviewEvents).values({
      userId: "default",
      questionId: question.id,
      status: "fuzzy",
      createdAt: date,
    });
  }
  await store.db.insert(reviewEvents).values([
    { userId: "another-user", questionId: question.id, status: "unknown" },
    { userId: "default", questionId: another.id, status: "mastered" },
  ]);
  const latest = await complete(question.id, "mastered", "Latest answer");
  assert.equal(latest.status, 201);
  const first = await queries.getQuestionHistory(question.id);
  assert.equal(first.total, 13);
  assert.equal(first.pages, 2);
  assert.equal(first.rows.length, 10);
  assert.equal(first.rows[0].answer, "Latest answer");
  assert.equal(first.rows[1].id, 12);
  const last = await queries.getQuestionHistory(question.id, 99);
  assert.equal(last.page, 2);
  assert.equal(last.rows.length, 3);
  assert.equal((await queries.getQuestionHistory(question.id, -1)).page, 1);
  const stats = await queries.getDashboard();
  assert.equal(stats.totalReviews, 14);
  assert.equal(stats.legacyReviews, 13);
});

test("oral answers are saved without text and invalid submissions never add events", async () => {
  const question = await addQuestion();
  assert.equal((await complete(question.id, "unknown", "   \n  ")).status, 201);
  const [event] = await store.db.select().from(reviewEvents);
  assert.equal(event.answer, null);
  assert.equal(event.kind, "practice");
  const invalid = await attempts.POST(
    new Request("http://localhost/api/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId: question.id,
        status: "mastered",
        answer: "A",
        attemptId: "invalid",
      }),
    }),
  );
  assert.equal(invalid.status, 400);
  assert.equal(
    (
      await attempts.POST(
        new Request("http://localhost/api/attempts", {
          method: "POST",
          body: "{",
        }),
      )
    ).status,
    400,
  );
  assert.equal((await store.db.select().from(reviewEvents)).length, 1);
});

test("only fresh completions advance review scheduling; retries and manual status edits preserve it", async () => {
  const question = await addQuestion();
  const roundId = randomUUID();
  const attemptId = randomUUID();
  assert.equal(
    (await complete(question.id, "mastered", "one", attemptId, roundId)).status,
    201,
  );
  let [progress] = await store.db.select().from(userQuestionProgress);
  assert.equal(progress.reviewStage, 1);
  assert.equal(
    progress.nextReviewAt!.getTime() - progress.lastReviewedAt.getTime(),
    86400000,
  );
  const first = progress;
  await mark(question.id, "unknown");
  assert.equal(
    (await complete(question.id, "mastered", "one", attemptId, roundId)).status,
    200,
  );
  [progress] = await store.db.select().from(userQuestionProgress);
  assert.equal(progress.status, "unknown");
  assert.equal(progress.reviewStage, first.reviewStage);
  assert.equal(progress.nextReviewAt!.getTime(), first.nextReviewAt!.getTime());
  assert.equal(progress.reviewCount, 1);
  assert.equal(
    (await complete(question.id, "mastered", "one", attemptId, randomUUID()))
      .status,
    409,
  );
  assert.equal((await complete(question.id, "mastered")).status, 201);
  [progress] = await store.db.select().from(userQuestionProgress);
  assert.equal(progress.reviewStage, 2);
  assert.equal(
    progress.nextReviewAt!.getTime() - progress.lastReviewedAt.getTime(),
    3 * 86400000,
  );
  await complete(question.id, "fuzzy");
  [progress] = await store.db.select().from(userQuestionProgress);
  assert.equal(progress.reviewStage, 0);
  assert.equal(
    progress.nextReviewAt!.getTime() - progress.lastReviewedAt.getTime(),
    3 * 86400000,
  );
  await complete(question.id, "mastered");
  [progress] = await store.db.select().from(userQuestionProgress);
  assert.equal(progress.reviewStage, 1);
  await complete(question.id, "unknown");
  [progress] = await store.db.select().from(userQuestionProgress);
  assert.equal(progress.reviewStage, 0);
  assert.equal(progress.reviewCount, 5);
});

test("concurrent different attempts serialize both the count and mastered review stage", async () => {
  const question = await addQuestion();
  const responses = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      complete(question.id, "mastered", `attempt ${i}`),
    ),
  );
  assert.ok(responses.every((response) => response.status === 201));
  const [progress] = await store.db.select().from(userQuestionProgress);
  assert.equal(progress.reviewCount, 8);
  assert.equal(progress.reviewStage, 4);
  assert.equal(
    progress.nextReviewAt!.getTime() - progress.lastReviewedAt.getTime(),
    14 * 86400000,
  );
  assert.equal((await store.db.select().from(reviewEvents)).length, 8);
});

test("due review includes mastered and unscheduled labels but excludes future, unmarked, retired and other users", async () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const mastered = await addQuestion("Due mastered");
  const unscheduled = await addQuestion("Unscheduled label");
  const boundary = await addQuestion("Due exactly now");
  const future = await addQuestion("Future weak");
  const retired = await addQuestion("Retired due", false);
  const another = await addQuestion("Other user due");
  await addQuestion("Unmarked");
  await store.db.insert(users).values({ id: "other" });
  await store.db.insert(userQuestionProgress).values([
    {
      userId: "default",
      questionId: mastered.id,
      status: "mastered",
      nextReviewAt: new Date("2025-01-01"),
    },
    { userId: "default", questionId: unscheduled.id, status: "fuzzy" },
    {
      userId: "default",
      questionId: boundary.id,
      status: "unknown",
      nextReviewAt: now,
    },
    {
      userId: "default",
      questionId: future.id,
      status: "unknown",
      nextReviewAt: new Date("2030-01-01"),
    },
    {
      userId: "default",
      questionId: retired.id,
      status: "unknown",
      nextReviewAt: now,
    },
    {
      userId: "other",
      questionId: another.id,
      status: "unknown",
      nextReviewAt: now,
    },
  ]);
  const expected = [unscheduled.id, mastered.id, boundary.id];
  assert.deepEqual(
    (await queries.getDueReviewQuestions(now)).map((row) => row.question.id),
    expected,
  );
  assert.deepEqual(
    await queries.getPracticeSelection({}, "due", 10, "seed", true, now),
    expected,
  );
  assert.equal((await queries.getDashboard()).dueReviews, 3);
  assert.deepEqual(
    await queries.getPracticeSelection(
      { difficulty: "hard" },
      "due",
      10,
      "seed",
      true,
      now,
    ),
    [],
  );
  await complete(unscheduled.id, "mastered");
  assert.equal((await queries.getDueReviewQuestions(now)).length, 2);
});

test("practice selection is bounded, filtered and deterministic before creating a fixed queue", async () => {
  const added = await store.db
    .insert(questions)
    .values(
      Array.from({ length: 25 }, (_, index) => ({
        question: `Question ${index}`,
        answer: "A",
        category: "Agent",
        subcategory: "Test",
        difficulty: "easy" as const,
      })),
    )
    .returning();
  assert.deepEqual(
    await queries.getPracticeSelection({}, "sequential", 10, "one", true),
    added.slice(0, 10).map((row) => row.id),
  );
  const random = await queries.getPracticeSelection(
    {},
    "random",
    20,
    "one",
    true,
  );
  assert.equal(random.length, 20);
  assert.deepEqual(
    await queries.getPracticeSelection({}, "random", 20, "one", true),
    random,
  );
  assert.notDeepEqual(
    await queries.getPracticeSelection({}, "random", 20, "two", true),
    random,
  );
  await mark(random[0], "mastered");
  assert.equal((await queries.getQuestionsByIds(random)).length, 20);
  assert.equal(
    (
      await queries.getPracticeSelection(
        { status: "mastered" },
        "sequential",
        20,
        "one",
        true,
      )
    ).length,
    1,
  );
  assert.deepEqual(
    await queries.getPracticeSelection(
      { category: "RAG" },
      "random",
      10,
      "one",
      true,
    ),
    [],
  );
});

test("round summaries restore only that round and use the latest saved rating per question", async () => {
  const question = await addQuestion();
  const outside = await addQuestion("Outside queue");
  const round = randomUUID(),
    other = randomUUID();
  await complete(question.id, "unknown", "first", randomUUID(), round);
  const latestId = randomUUID();
  await complete(question.id, "fuzzy", "latest", latestId, round);
  await complete(question.id, "mastered", "other round", randomUUID(), other);
  await complete(outside.id, "mastered", "outside", randomUUID(), round);
  await mark(question.id, "unknown");
  const completed = await queries.getRoundCompletions(round, [question.id]);
  assert.equal(completed.length, 1);
  assert.equal(completed[0].status, "fuzzy");
  assert.equal(completed[0].answer, "latest");
  assert.equal(completed[0].attemptId, latestId);
  assert.ok(completed[0].nextReviewAt);
  assert.deepEqual(
    await queries.getRoundCompletions(randomUUID(), [question.id]),
    [],
  );
  assert.deepEqual(await queries.getRoundCompletions(round, []), []);
});
