import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, test } from "node:test";
import { and, eq } from "drizzle-orm";
import { startTestDatabase } from "../helpers/postgres";
import { seedQuestionBank } from "../../src/db/seed-bank";
import {
  personalAnswerCards,
  questions,
  reviewEvents,
  userQuestionProgress,
  users,
} from "../../src/db/schema";
import {
  matchesLearningScope,
  parseLearningScope,
  practiceObservationPayload,
  personalAnswerCardPayload,
  type LearningTargetPayload,
} from "../../src/lib/learning-contract";
import { orderSavedQueue } from "../../src/lib/practice-session";
let database: Awaited<ReturnType<typeof startTestDatabase>>;
let store: typeof import("../../src/db");
let progress: typeof import("../../src/lib/scope-progress");
let queries: typeof import("../../src/lib/questions");
let target: typeof import("../../src/lib/learning-target");
let notes: typeof import("../../src/lib/practice-notes");
let attempts: typeof import("../../src/app/api/attempts/route");
let daily: typeof import("../../src/lib/daily-practice-query");
before(async () => {
  database = await startTestDatabase();
  process.env.DATABASE_URL = database.url;
  store = await import("../../src/db");
  progress = await import("../../src/lib/scope-progress");
  queries = await import("../../src/lib/questions");
  target = await import("../../src/lib/learning-target");
  notes = await import("../../src/lib/practice-notes");
  attempts = await import("../../src/app/api/attempts/route");
  daily = await import("../../src/lib/daily-practice-query");
});
after(async () => {
  if (store) await store.databaseClient.end();
  if (database) await database.stop();
});
beforeEach(async () => {
  await store.databaseClient.unsafe(
    "TRUNCATE users,questions RESTART IDENTITY CASCADE",
  );
  await seedQuestionBank(store.db);
});
const config = (
  overrides: Partial<LearningTargetPayload> = {},
): LearningTargetPayload => ({
  requestId: randomUUID(),
  preset: "resume_focus",
  projectScope: "VendorGuard",
  priority: null,
  dailyMinutes: 10,
  interviewDate: null,
  ...overrides,
});
async function ids(scope = parseLearningScope({ project: "VendorGuard" })) {
  return (await queries.getPracticeQuestions(scope)).map(
    (row) => row.question.id,
  );
}
async function complete(
  questionId: number,
  status = "fuzzy",
  attemptId = randomUUID(),
  roundId = randomUUID(),
) {
  const response = await attempts.POST(
    new Request("http://localhost/api/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId,
        status,
        answer: "可核对的本人回答",
        attemptId,
        roundId,
      }),
    }),
  );
  assert.ok(response.ok);
  return response.json();
}
async function snapshot() {
  const result = [];
  for (const table of [
    "users",
    "questions",
    "user_question_progress",
    "review_events",
    "learning_targets",
    "personal_answer_cards",
    "practice_observations",
    "answer_point_checks",
    "practice_gaps",
    "app_schema_migrations",
  ])
    result.push(
      await store.databaseClient.unsafe(
        `select to_jsonb(t) as row from ${table} t order by to_jsonb(t)::text`,
      ),
    );
  return JSON.stringify(result);
}
test("unconfigured progress reads all enabled questions without creating a target or writing any records", async () => {
  const before = await snapshot();
  const actual = await progress.getScopeProgress();
  assert.equal(actual.total, 670);
  assert.equal(actual.covered, 0);
  assert.equal(actual.coverage, 0);
  assert.equal(actual.unpracticed.total, 670);
  assert.equal(actual.unmarked, 670);
  assert.equal(actual.cards, 0);
  assert.equal(actual.openGaps, 0);
  assert.equal(actual.target, null);
  assert.equal(await snapshot(), before);
});
test("formal coverage counts distinct owned active questions while legacy, status, cards and observations never count", async () => {
  const all = await ids();
  const [first, legacy, statusOnly, cardOnly, gapOnly, retired, other] = all;
  await complete(first);
  await complete(first);
  await complete(retired);
  await store.db.insert(reviewEvents).values({
    userId: "default",
    questionId: legacy,
    kind: "legacy",
    status: "mastered",
  });
  await store.db.insert(userQuestionProgress).values({
    userId: "default",
    questionId: statusOnly,
    status: "mastered",
    reviewCount: 99,
  });
  await notes.saveAnswerCard(
    personalAnswerCardPayload.parse({
      questionId: cardOnly,
      expectedRevision: 0,
    }),
  );
  for (let i = 0; i < 4; i++)
    await notes.saveObservation(
      practiceObservationPayload.parse({
        requestId: randomUUID(),
        questionId: gapOnly,
        gaps: [{ kind: "concept" }, { kind: "evidence" }],
        pointChecks: [
          { position: 0, pointTextSnapshot: "旧要点", covered: true },
        ],
      }),
    );
  await store.db.insert(users).values({ id: "other" });
  await store.db.insert(reviewEvents).values({
    userId: "other",
    questionId: other,
    kind: "practice",
    status: "mastered",
  });
  await store.db
    .update(questions)
    .set({ active: false })
    .where(eq(questions.id, retired));
  const result = await progress.getScopeProgress(
    parseLearningScope({ project: "VendorGuard" }),
  );
  assert.equal(result.total, all.length - 1);
  assert.equal(result.covered, 1);
  assert.equal(result.unpracticed.total, result.total - 1);
  assert.equal(result.mastered, 1);
  assert.equal(result.cards, 1);
  assert.equal(result.evidenceFilled, 0);
  assert.equal(result.openGaps, 8);
  assert.equal(result.gaps.find((g) => g.kind === "evidence")?.total, 4);
  assert.ok(result.unpracticed.rows.find((row) => row.id === statusOnly));
  assert.ok(!result.unpracticed.rows.find((row) => row.id === first));
  assert.ok(!result.unpracticed.rows.find((row) => row.id === retired));
});
test("retries and repeated events preserve coverage while latest self assessment stays independent", async () => {
  const [id] = await ids();
  const attemptId = randomUUID();
  const roundId = randomUUID();
  await complete(id, "fuzzy", attemptId, roundId);
  await complete(id, "fuzzy", attemptId, roundId);
  await complete(id, "unknown");
  await store.db
    .update(userQuestionProgress)
    .set({ status: "mastered" })
    .where(
      and(
        eq(userQuestionProgress.questionId, id),
        eq(userQuestionProgress.userId, "default"),
      ),
    );
  const result = await progress.getScopeProgress(
    parseLearningScope({ project: "VendorGuard" }),
  );
  assert.equal(result.covered, 1);
  assert.equal(result.mastered, 1);
  assert.equal(result.unknown, 0);
  assert.equal(
    result.mastered + result.fuzzy + result.unknown + result.unmarked,
    result.total,
  );
});
test("evidence count uses nonempty trimmed text including pasted Unicode whitespace and isolates users", async () => {
  const [one, two, three, four] = await ids();
  await store.db.insert(personalAnswerCards).values([
    { userId: "default", questionId: one },
    { userId: "default", questionId: two, evidence: " \t\n\u00a0\ufeff\u3000" },
    { userId: "default", questionId: three, evidence: " 对应代码 " },
  ]);
  await store.db.insert(users).values({ id: "other" });
  await store.db
    .insert(personalAnswerCards)
    .values({ userId: "other", questionId: four, evidence: "他人证据" });
  const result = await progress.getScopeProgress(
    parseLearningScope({ project: "VendorGuard" }),
  );
  assert.equal(result.cards, 3);
  assert.equal(result.evidenceFilled, 1);
});
test("target switching changes denominator, explicit filters override without writes, and personal data outside scope remains", async () => {
  const [id] = await ids();
  await complete(id);
  await notes.saveAnswerCard(
    personalAnswerCardPayload.parse({
      questionId: id,
      expectedRevision: 0,
      evidence: "本人证据",
    }),
  );
  await target.saveLearningTarget(config());
  const vendor = await progress.getScopeProgress();
  assert.equal(vendor.covered, 1);
  assert.equal(vendor.cards, 1);
  assert.equal(vendor.total, await queries.getScopeCount(vendor.filters));
  await target.saveLearningTarget(
    config({ preset: "foundation_fill", projectScope: null }),
  );
  const before = await snapshot();
  const foundation = await progress.getScopeProgress();
  assert.equal(foundation.total, 22);
  assert.equal(foundation.covered, 0);
  assert.equal(foundation.cards, 0);
  assert.equal(foundation.target?.preset, "foundation_fill");
  const custom = await progress.getScopeProgress(vendor.filters);
  assert.equal(custom.covered, 1);
  assert.equal(custom.cards, 1);
  assert.equal(custom.usesTarget, false);
  assert.equal((await progress.getScopeProgress({})).total, 670);
  assert.equal(await snapshot(), before);
  assert.ok(await notes.getAnswerCard(id));
});
test("all shared preset, project, priority, kind and legacy filter combinations use identical scope membership", async () => {
  const bank = await store.db.select().from(questions);
  for (const input of [
    { preset: "general_core" },
    { preset: "resume_focus" },
    { preset: "project_story" },
    { preset: "foundation_fill" },
    { project: "VendorGuard", resumePriority: "P0", resumeKind: "简历实战" },
    { project: "发票实习", resumePriority: "P1" },
  ]) {
    const scope = parseLearningScope(input);
    const result = await progress.getScopeProgress(scope);
    assert.equal(
      result.total,
      bank.filter((row) => matchesLearningScope(row, scope)).length,
    );
    assert.equal(result.total, await queries.getScopeCount(scope));
  }
  const filters = {
    ...parseLearningScope({ project: "VendorGuard" }),
    category: "Agent",
    difficulty: "medium",
    search: "工具",
  };
  assert.equal(
    (await progress.getScopeProgress(filters)).total,
    await queries.getScopeCount(filters),
  );
  const [id] = await ids();
  await store.db
    .insert(userQuestionProgress)
    .values({ userId: "default", questionId: id, status: "unknown" });
  const scoped = await progress.getScopeProgress({
    ...parseLearningScope({ project: "VendorGuard" }),
    status: "unknown",
  });
  assert.equal(scoped.total, 1);
  assert.equal(scoped.unpracticed.total, 1);
  assert.equal(scoped.unknown, 1);
});
test("empty, fully practiced and pagination states have stable lists and honest ratios", async () => {
  const empty = await progress.getScopeProgress(
    { search: "no matching question text 1234" },
    999,
  );
  assert.equal(empty.total, 0);
  assert.equal(empty.coverage, null);
  assert.equal(empty.unpracticed.page, 1);
  assert.deepEqual(empty.unpracticed.rows, []);
  const all = await ids();
  const scope = parseLearningScope({ project: "VendorGuard" });
  const seen: number[] = [];
  const first = await progress.getScopeProgress(scope);
  for (let page = 1; page <= first.unpracticed.pages; page++)
    seen.push(
      ...(await progress.getScopeProgress(scope, page)).unpracticed.rows.map(
        (row) => row.id,
      ),
    );
  assert.deepEqual(seen, all);
  assert.equal(new Set(seen).size, all.length);
  assert.equal(
    (await progress.getScopeProgress(scope, 999)).unpracticed.page,
    first.unpracticed.pages,
  );
  for (const id of all) await complete(id);
  const full = await progress.getScopeProgress(scope);
  assert.equal(full.coverage, 1);
  assert.equal(full.covered, all.length);
  assert.deepEqual(full.unpracticed.rows, []);
  assert.equal(full.unpracticed.page, 1);
});
test("open gap counts omit resolved and inactive records but preserve the original observations", async () => {
  const [one, two] = await ids();
  for (const questionId of [one, one, two])
    await notes.saveObservation(
      practiceObservationPayload.parse({
        requestId: randomUUID(),
        questionId,
        gaps: [{ kind: "concept" }, { kind: "evidence" }],
      }),
    );
  const gaps = await notes.getPracticeGaps({}, undefined, false);
  await notes.resolvePracticeGap(gaps[0].gap.id, true);
  await store.db
    .update(questions)
    .set({ active: false })
    .where(eq(questions.id, two));
  const result = await progress.getScopeProgress(
    parseLearningScope({ project: "VendorGuard" }),
  );
  assert.equal(result.openGaps, 3);
  assert.equal((await notes.getObservations(one)).length, 2);
  assert.equal((await notes.getObservations(two)).length, 1);
});
test("first-release three-of-five workflow restores queue, keeps personal cards and excludes today's completions until next day", async () => {
  const scope = parseLearningScope({ preset: "resume_focus" });
  await target.saveLearningTarget(config({ projectScope: null }));
  const now = new Date("2026-10-11T12:00:00+08:00");
  const nextDay = new Date("2026-10-12T12:00:00+08:00");
  const queue = (await daily.getDailyPractice(now, scope, 5)).ids;
  const roundId = randomUUID();
  const events = [];
  for (const id of queue.slice(0, 3))
    events.push(await complete(id, "unknown", randomUUID(), roundId));
  await store.databaseClient`update review_events set created_at=${now.toISOString()} where round_id=${roundId}`;
  await store.databaseClient`update user_question_progress set next_review_at=${nextDay.toISOString()} where question_id=any(${queue.slice(0, 3)}::int[])`;
  await notes.saveAnswerCard(
    personalAnswerCardPayload.parse({
      questionId: queue[0],
      expectedRevision: 0,
      example: "独立测试库中的真实流程示例",
      evidence: "对应运行记录",
    }),
  );
  await notes.saveObservation(
    practiceObservationPayload.parse({
      requestId: randomUUID(),
      questionId: queue[0],
      reviewEventId: events[0].id,
      gaps: [{ kind: "concept" }, { kind: "evidence" }],
    }),
  );
  const result = await progress.getScopeProgress();
  assert.equal(result.total, 100);
  assert.equal(result.covered, 3);
  assert.equal(result.cards, 1);
  assert.equal(result.openGaps, 2);
  assert.equal((await queries.getRoundCompletions(roundId, queue)).length, 3);
  const today = await daily.getDailyPractice(now, scope, 5);
  assert.ok(queue.slice(0, 3).every((id) => !today.ids.includes(id)));
  const tomorrow = await daily.getDailyPractice(nextDay, scope, 5);
  assert.ok(queue.slice(0, 3).every((id) => tomorrow.ids.includes(id)));
  await target.saveLearningTarget(
    config({ preset: "foundation_fill", projectScope: null }),
  );
  assert.equal((await progress.getScopeProgress()).total, 22);
  assert.equal((await progress.getScopeProgress()).covered, 0);
  assert.deepEqual(
    orderSavedQueue(await queries.getQuestionsByIds(queue), queue).map(
      (row) => row.question.id,
    ),
    queue,
  );
  assert.ok(await notes.getAnswerCard(queue[0]));
  assert.equal((await queries.getRoundCompletions(roundId, queue)).length, 3);
});
