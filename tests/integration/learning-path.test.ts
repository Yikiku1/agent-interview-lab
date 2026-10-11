import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, test } from "node:test";
import { eq, inArray } from "drizzle-orm";
import {
  learningTargets,
  questions,
  reviewEvents,
  userQuestionProgress,
  users,
} from "../../src/db/schema";
import { seedQuestionBank } from "../../src/db/seed-bank";
import {
  matchesLearningScope,
  parseLearningScope,
  type LearningTargetPayload,
} from "../../src/lib/learning-contract";
import { startTestDatabase } from "../helpers/postgres";

let database: Awaited<ReturnType<typeof startTestDatabase>>;
let store: typeof import("../../src/db");
let api: typeof import("../../src/app/api/learning-target/route");
let queries: typeof import("../../src/lib/questions");
let daily: typeof import("../../src/lib/daily-practice-query");
let attempts: typeof import("../../src/app/api/attempts/route");

before(async () => {
  database = await startTestDatabase();
  process.env.DATABASE_URL = database.url;
  store = await import("../../src/db");
  api = await import("../../src/app/api/learning-target/route");
  queries = await import("../../src/lib/questions");
  daily = await import("../../src/lib/daily-practice-query");
  attempts = await import("../../src/app/api/attempts/route");
});
after(async () => {
  if (store) await store.databaseClient.end();
  if (database) await database.stop();
});
beforeEach(async () => {
  await store.databaseClient.unsafe(
    "TRUNCATE users, questions RESTART IDENTITY CASCADE",
  );
  await seedQuestionBank(store.db);
});
const config = (
  overrides: Partial<LearningTargetPayload> = {},
): LearningTargetPayload => ({
  requestId: randomUUID(),
  preset: "resume_focus",
  projectScope: "VendorGuard",
  priority: "P0",
  dailyMinutes: 10,
  interviewDate: null,
  ...overrides,
});
const put = (body: unknown) =>
  api.PUT(
    new Request("http://localhost/api/learning-target", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
const complete = (
  questionId: number,
  attemptId = randomUUID(),
  roundId = randomUUID(),
) =>
  attempts.POST(
    new Request("http://localhost/api/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId,
        attemptId,
        roundId,
        answer: "测试回答",
        status: "fuzzy",
      }),
    }),
  );
async function originalSnapshot() {
  const result = [];
  for (const table of [
    "users",
    "questions",
    "user_question_progress",
    "review_events",
  ])
    result.push(
      await store.databaseClient.unsafe(
        `select to_jsonb(t) as row from ${table} t order by 1::text, to_jsonb(t)::text`,
      ),
    );
  return JSON.stringify(result);
}

test("SQL scope, counts, lists, and candidate queries match the metadata contract including malformed rows", async () => {
  await store.db.insert(questions).values([
    {
      question: "【简历 P0 · VendorGuard】decorative title only",
      answer: "test",
      category: "Agent",
      subcategory: "Test",
      difficulty: "medium",
      tags: [],
    },
    {
      question: "malformed project tags",
      answer: "test",
      category: "Agent",
      subcategory: "简历专项 · VendorGuard",
      difficulty: "medium",
      tags: ["简历专项", "VendorGuard", "综合", "P0", "简历实战"],
    },
    {
      question: "wrong subcategory",
      answer: "test",
      category: "Agent",
      subcategory: "Test",
      difficulty: "medium",
      tags: ["简历专项", "VendorGuard", "P0", "简历实战"],
    },
  ]);
  const rows = await store.db.select().from(questions);
  const combinations = [
    {},
    { preset: "general_core" },
    { track: "resume" },
    { preset: "project_story" },
    { preset: "foundation_fill" },
    ...["VendorGuard", "发票实习", "综合", "技术基础"].map((project) => ({
      project,
    })),
    ...["P0", "P1", "P2"].map((resumePriority) => ({ resumePriority })),
    ...["简历实战", "基础关联", "扩展设计"].map((resumeKind) => ({
      resumeKind,
    })),
    { project: "VendorGuard", resumePriority: "P0", resumeKind: "简历实战" },
  ];
  for (const input of combinations) {
    const scope = parseLearningScope(input);
    const expected = rows
      .filter((row) => matchesLearningScope(row, scope))
      .map((row) => row.id)
      .sort((a, b) => a - b);
    const [list, count, selection, recommendation] = await Promise.all([
      queries.listQuestions(scope, 1, 1000),
      queries.getScopeCount(scope),
      queries.getPracticeSelection(scope, "sequential", 20, "1", false),
      daily.getDailyPractice(new Date("2026-10-10T02:00:00Z"), scope, 5),
    ]);
    assert.deepEqual(
      list.rows.map((row) => row.question.id),
      expected,
    );
    assert.equal(count, expected.length);
    assert.equal(list.total, count);
    assert.deepEqual(selection, expected.slice(0, 20));
    assert.equal(recommendation.scopeTotal, count);
    assert.ok(recommendation.ids.every((id) => expected.includes(id)));
  }
  const combined = queries.parseFilters({
    project: "VendorGuard",
    resumePriority: "P0",
    category: "Agent",
    difficulty: "medium",
  });
  assert.equal(
    await queries.getScopeCount(combined),
    rows.filter(
      (row) =>
        matchesLearningScope(row, combined) &&
        row.category === "Agent" &&
        row.difficulty === "medium",
    ).length,
  );
});

test("target GET is read-only; saving preserves practice records and uses request idempotency/conflict", async () => {
  const [question] = await store.db.select().from(questions).limit(1);
  await complete(question.id);
  const before = await originalSnapshot();
  assert.deepEqual(await (await api.GET()).json(), { target: null });
  const payload = config({ interviewDate: "2026-09-01" });
  const first = await put(payload);
  assert.equal(first.status, 201);
  const target = (await first.json()).target;
  const retry = await put(payload);
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).target.id, target.id);
  assert.equal((await put({ ...payload, dailyMinutes: 5 })).status, 409);
  assert.equal((await (await api.GET()).json()).target.id, target.id);
  assert.equal(await originalSnapshot(), before);
  assert.equal((await store.db.select().from(learningTargets)).length, 1);
});

test("concurrent target requests serialize and retrying an inactive old request never reactivates it", async () => {
  const same = config();
  const results = await Promise.all([put(same), put(same), put(same)]);
  assert.deepEqual(results.map((row) => row.status).sort(), [200, 200, 201]);
  const old = (await (await api.GET()).json()).target;
  const next = [
    config({ preset: "foundation_fill", projectScope: null, priority: null }),
    config({ projectScope: "发票实习", dailyMinutes: 5 }),
  ];
  assert.deepEqual(
    (await Promise.all(next.map(put))).map((row) => row.status),
    [201, 201],
  );
  const active = (await (await api.GET()).json()).target;
  assert.notEqual(active.id, old.id);
  const retry = await put(same);
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).target.active, false);
  assert.equal((await (await api.GET()).json()).target.id, active.id);
  const all = await store.db.select().from(learningTargets);
  assert.equal(all.length, 3);
  assert.equal(all.filter((row) => row.active).length, 1);
  await store.db.insert(users).values({ id: "other" });
  await store.db
    .insert(learningTargets)
    .values({ ...config(), userId: "other" });
  assert.equal((await (await api.GET()).json()).target.userId, "default");
});

test("target insert failure rolls back deactivation and strict validation rejects invalid scope, date and extra fields", async () => {
  const payload = config();
  await put(payload);
  const before = JSON.stringify(await store.db.select().from(learningTargets));
  for (const body of [
    { ...config(), preset: "general_core" },
    { ...config(), dailyMinutes: 3 },
    { ...config(), interviewDate: "2026-02-30" },
    { ...config(), userId: "other" },
    { ...config(), preset: "foundation_fill" },
  ])
    assert.equal((await put(body)).status, 400);
  await store.databaseClient.unsafe(
    "CREATE FUNCTION fail_target() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.daily_minutes = 40 THEN RAISE EXCEPTION 'test'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_target BEFORE INSERT ON learning_targets FOR EACH ROW EXECUTE FUNCTION fail_target()",
  );
  try {
    assert.equal((await put(config({ dailyMinutes: 40 }))).status, 500);
    assert.equal(
      JSON.stringify(await store.db.select().from(learningTargets)),
      before,
    );
  } finally {
    await store.databaseClient.unsafe(
      "DROP TRIGGER fail_target ON learning_targets; DROP FUNCTION fail_target()",
    );
  }
});

test("target recommendation respects due/weak/path, today exclusion and explicit outside due without writing", async () => {
  const scope = parseLearningScope({
    project: "VendorGuard",
    resumePriority: "P0",
  });
  const list = await queries.listQuestions(scope, 1, 1000);
  const [due, weak, today] = list.rows.map((row) => row.question);
  const [outside] = await store.db
    .select()
    .from(questions)
    .where(eq(questions.category, "Python"))
    .limit(1);
  const now = new Date("2026-10-10T02:00:00Z"),
    yesterday = new Date("2026-10-09T02:00:00Z");
  for (const question of [due, weak, today, outside])
    await complete(question.id);
  await store.db
    .update(reviewEvents)
    .set({ createdAt: yesterday })
    .where(inArray(reviewEvents.questionId, [due.id, weak.id, outside.id]));
  await store.db
    .update(reviewEvents)
    .set({ createdAt: now })
    .where(eq(reviewEvents.questionId, today.id));
  await store.db
    .update(userQuestionProgress)
    .set({ nextReviewAt: yesterday, status: "mastered" })
    .where(inArray(userQuestionProgress.questionId, [due.id, outside.id]));
  await store.db
    .update(userQuestionProgress)
    .set({ nextReviewAt: new Date("2026-10-12T02:00:00Z") })
    .where(inArray(userQuestionProgress.questionId, [weak.id, today.id]));
  const before = await originalSnapshot();
  const result = await daily.getDailyPractice(now, scope, 3);
  assert.deepEqual(result.ids.slice(0, 2), [due.id, weak.id]);
  assert.equal(result.queue[2].source, "path");
  assert.equal(result.ids.length, 3);
  assert.equal(result.outsideDue, 1);
  assert.equal(result.excludedToday, 1);
  assert.ok(!result.ids.includes(today.id) && !result.ids.includes(outside.id));
  const outsideRows = await queries.getDueReviewQuestions(now, scope, true);
  assert.deepEqual(
    outsideRows.map((row) => row.question.id),
    [outside.id],
  );
  assert.equal(await originalSnapshot(), before);
});

test("short rounds preserve formal completion retry, restored summaries, and fixed ID selection after target change", async () => {
  for (const size of [3, 5] as const) {
    const scope = parseLearningScope({
      preset: "resume_focus",
      project: "VendorGuard",
      resumePriority: "P0",
    });
    const ids = await queries.getPracticeSelection(
      scope,
      "sequential",
      size,
      "1",
      false,
    );
    assert.equal(ids.length, size);
    const round = randomUUID(),
      attempt = randomUUID();
    assert.equal((await complete(ids[0], attempt, round)).status, 201);
    assert.equal((await complete(ids[0], attempt, round)).status, 200);
    await put(
      config({ preset: "foundation_fill", projectScope: null, priority: null }),
    );
    assert.deepEqual(
      (await queries.getQuestionsByIds(ids))
        .map((row) => row.question.id)
        .sort((a, b) => a - b),
      ids,
    );
    const restored = await queries.getRoundCompletions(round, ids);
    assert.equal(restored.length, 1);
    assert.equal(restored[0].attemptId, attempt);
  }
});

test("disabled and empty ranges produce honest counts and shorter queues", async () => {
  const scope = parseLearningScope({ project: "综合" });
  const ids = (await queries.listQuestions(scope, 1, 1000)).rows.map(
    (row) => row.question.id,
  );
  await store.db
    .update(questions)
    .set({ active: false })
    .where(inArray(questions.id, ids.slice(2)));
  assert.equal(await queries.getScopeCount(scope), 2);
  assert.equal(
    (await daily.getDailyPractice(new Date(), scope, 5)).ids.length,
    2,
  );
  await store.db
    .update(questions)
    .set({ active: false })
    .where(inArray(questions.id, ids));
  const result = await daily.getDailyPractice(new Date(), scope, 3);
  assert.equal(result.scopeTotal, 0);
  assert.deepEqual(result.ids, []);
});
