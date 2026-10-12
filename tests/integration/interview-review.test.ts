import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, beforeEach, after, test } from "node:test";
import { eq } from "drizzle-orm";
import { startTestDatabase } from "../helpers/postgres";
import { seedQuestionBank } from "../../src/db/seed-bank";
import { parseFilters } from "../../src/lib/question-filters";
import {
  interviewReviewQuestions,
  interviewReviews,
  questions,
  reviewEvents,
  users,
} from "../../src/db/schema";
import {
  reviewCreatePayload,
  reviewUpdatePayload,
  type ReviewCreatePayload,
  type ReviewFields,
} from "../../src/lib/interview-review-contract";
let database: Awaited<ReturnType<typeof startTestDatabase>>;
let store: typeof import("../../src/db");
let service: typeof import("../../src/lib/interview-reviews");
let scope: typeof import("../../src/lib/scope-progress");
let route: typeof import("../../src/app/api/interview-reviews/[id]/route");
let createRoute: typeof import("../../src/app/api/interview-reviews/route");
let optionsRoute: typeof import("../../src/app/api/interview-review-question-options/route");
let attempts: typeof import("../../src/app/api/attempts/route");
before(async () => {
  database = await startTestDatabase();
  process.env.DATABASE_URL = database.url;
  store = await import("../../src/db");
  service = await import("../../src/lib/interview-reviews");
  scope = await import("../../src/lib/scope-progress");
  route = await import("../../src/app/api/interview-reviews/[id]/route");
  createRoute = await import("../../src/app/api/interview-reviews/route");
  optionsRoute =
    await import("../../src/app/api/interview-review-question-options/route");
  attempts = await import("../../src/app/api/attempts/route");
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
const question = (
  questionId: number | null = null,
): ReviewFields["questions"][number] => ({
  id: randomUUID(),
  prompt: "面试官原话：怎么确认失败不会重复执行？",
  answerSummary: "自己的现场简记",
  gaps: ["expression"],
  gapNote: "表达卡住",
  improvement: "补充失败例子",
  questionId,
});
const payload = (patch: Partial<ReviewCreatePayload> = {}) =>
  reviewCreatePayload.parse({
    requestId: randomUUID(),
    interviewDate: "2026-10-12",
    name: "独立测试面试",
    note: "测试备注",
    questions: [question()],
    ...patch,
  });
function fields(
  review: NonNullable<Awaited<ReturnType<typeof service.getInterviewReview>>>,
): ReviewFields {
  return {
    interviewDate: review.interviewDate,
    name: review.name,
    note: review.note,
    questions: review.questions.map(
      ({
        id,
        prompt,
        answerSummary,
        gaps,
        gapNote,
        improvement,
        questionId,
      }) => ({
        id,
        prompt,
        answerSummary,
        gaps,
        gapNote,
        improvement,
        questionId,
      }),
    ),
  };
}
async function create(value = payload()) {
  const result = await service.createInterviewReview(value);
  assert.equal(result.status, 201);
  return { id: result.id!, value };
}
async function edit(id: string, patch: Partial<ReviewFields> = {}) {
  const old = (await service.getInterviewReview(id))!;
  return reviewUpdatePayload.parse({
    ...fields(old),
    ...patch,
    expectedRevision: old.revision,
    requestId: randomUUID(),
  });
}
async function formal(questionId: number) {
  const response = await attempts.POST(
    new Request("http://localhost/api/attempts", {
      method: "POST",
      body: JSON.stringify({
        questionId,
        attemptId: randomUUID(),
        status: "fuzzy",
        answer: "正式补练的回答",
      }),
    }),
  );
  assert.equal(response.status, 201);
  return response.json();
}
async function snapshot(
  tables = [
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
    "mock_rounds",
    "mock_nodes",
    "mock_round_actions",
  ],
) {
  const rows = [];
  for (const table of tables)
    rows.push([
      ...(await store.databaseClient.unsafe(
        `select to_jsonb(t) as row from ${table} t order by to_jsonb(t)::text`,
      )),
    ]);
  return JSON.stringify(rows);
}
test("a single unknown interview question saves independently and readonly detail/list/search never create public questions or ordinary records", async () => {
  const before = await snapshot();
  const { id } = await create(
    payload({
      name: "",
      note: "",
      questions: [
        {
          ...question(),
          answerSummary: "",
          gaps: [],
          gapNote: "",
          improvement: "",
        },
      ],
    }),
  );
  const detail = (await service.getInterviewReview(id))!;
  assert.equal(detail.questions[0].questionId, null);
  assert.equal(detail.questions[0].practiced, false);
  assert.equal((await service.listInterviewReviews()).total, 1);
  assert.ok(
    (await service.findReviewQuestionOptions("VendorGuard")).length > 0,
  );
  assert.equal(await snapshot(), before);
  assert.deepEqual((await scope.getScopeProgress()).interviewReviews, {
    linked: 0,
    practiced: 0,
    pending: 0,
  });
});
test("creation request retries are concurrent/idempotent and retain original identity after later editing", async () => {
  const value = payload();
  const results = await Promise.all([
    service.createInterviewReview(value),
    service.createInterviewReview(value),
  ]);
  assert.deepEqual(results.map((row) => row.status).sort(), [200, 201]);
  assert.equal(results[0].id, results[1].id);
  const id = results[0].id!;
  await service.updateInterviewReview(
    id,
    await edit(id, { name: "修改后的面试" }),
  );
  assert.equal((await service.createInterviewReview(value)).status, 200);
  assert.equal(
    (await service.createInterviewReview({ ...value, name: "另一份内容" }))
      .status,
    409,
  );
  assert.equal((await service.listInterviewReviews()).total, 1);
});
test("same and late update retries preserve latest revision while competing edits cannot overwrite each other", async () => {
  const { id } = await create();
  const first = await edit(id, { note: "第一次修改" });
  assert.equal((await service.updateInterviewReview(id, first)).status, 200);
  assert.equal(
    (await service.updateInterviewReview(id, first)).review?.revision,
    2,
  );
  const second = await edit(id, { note: "第二次修改" });
  await service.updateInterviewReview(id, second);
  assert.equal(
    (await service.updateInterviewReview(id, first)).review?.note,
    "第二次修改",
  );
  assert.equal(
    (
      await service.updateInterviewReview(id, {
        ...first,
        note: "请求内容被改",
      })
    ).status,
    409,
  );
  const next = await edit(id);
  const results = await Promise.all([
    service.updateInterviewReview(id, { ...next, note: "页面一" }),
    service.updateInterviewReview(id, {
      ...next,
      requestId: randomUUID(),
      note: "页面二",
    }),
  ]);
  assert.deepEqual(results.map((row) => row.status).sort(), [200, 409]);
  assert.equal((await service.getInterviewReview(id))?.revision, 4);
});
test("follow-up excludes old formal history and new legacy/self-ratings, then counts a real post-link ordinary completion without join multiplication", async () => {
  const source = (await service.findReviewQuestionOptions("VendorGuard"))[0];
  await formal(source.id);
  const { id } = await create(
    payload({
      questions: [question(source.id), question(source.id), question()],
    }),
  );
  const old = (await service.getInterviewReview(id))!;
  assert.deepEqual(
    old.questions.map((row) => row.practiced),
    [false, false, false],
  );
  await store.db.insert(reviewEvents).values({
    userId: "default",
    questionId: source.id,
    status: "mastered",
    kind: "legacy",
  });
  assert.equal(
    (await service.getInterviewReview(id))?.questions[0].practiced,
    false,
  );
  assert.deepEqual(
    (await scope.getScopeProgress(parseFilters({ preset: "resume_focus" })))
      .interviewReviews,
    { linked: 2, practiced: 0, pending: 2 },
  );
  await formal(source.id);
  await formal(source.id);
  const latest = (await service.getInterviewReview(id))!;
  assert.ok(latest.questions[0].practiceEventId);
  assert.deepEqual(
    latest.questions.map((row) => row.practiced),
    [true, true, false],
  );
  const progress = await scope.getScopeProgress(
    parseFilters({ preset: "resume_focus" }),
  );
  assert.equal(progress.covered, 1);
  assert.deepEqual(progress.interviewReviews, {
    linked: 2,
    practiced: 2,
    pending: 0,
  });
  assert.deepEqual(
    (await scope.getScopeProgress(parseFilters({ preset: "foundation_fill" })))
      .interviewReviews,
    { linked: 0, practiced: 0, pending: 0 },
  );
});
test("same-millisecond old history is excluded by the event boundary and a second interview starts its own follow-up baseline", async () => {
  const source = (await service.findReviewQuestionOptions("VendorGuard"))[0];
  await formal(source.id);
  const { id } = await create(payload({ questions: [question(source.id)] }));
  const [linked] = await store.db
    .select()
    .from(interviewReviewQuestions)
    .where(eq(interviewReviewQuestions.reviewId, id));
  await store.db.update(reviewEvents).set({ createdAt: linked.linkedAt! });
  assert.equal(
    (await service.getInterviewReview(id))?.questions[0].practiced,
    false,
  );
  await formal(source.id);
  const next = await create(payload({ questions: [question(source.id)] }));
  assert.equal(
    (await service.getInterviewReview(id))?.questions[0].practiced,
    true,
  );
  assert.equal(
    (await service.getInterviewReview(next.id))?.questions[0].practiced,
    false,
  );
});
test("explicit link changes reset follow-up while unrelated edits, source changes and retirement retain original interview wording and snapshots", async () => {
  const options = await service.findReviewQuestionOptions("VendorGuard");
  const source = options[0];
  const target = options[1];
  const { id, value } = await create(
    payload({ questions: [question(source.id)] }),
  );
  await formal(source.id);
  const old = (await service.getInterviewReview(id))!;
  await store.db
    .update(questions)
    .set({
      question: "数据库改后的公共问题",
      answer: "新公共正文",
      active: false,
    })
    .where(eq(questions.id, source.id));
  const same = await edit(id, { name: "补充岗位名" });
  assert.equal((await service.updateInterviewReview(id, same)).status, 200);
  const preserved = (await service.getInterviewReview(id))!;
  assert.equal(preserved.questions[0].prompt, value.questions[0].prompt);
  assert.equal(preserved.questions[0].questionSnapshot, source.question);
  assert.equal(preserved.questions[0].linkedAt, old.questions[0].linkedAt);
  assert.equal(preserved.questions[0].practiced, true);
  assert.equal(preserved.questions[0].active, false);
  assert.equal(
    (
      await service.createInterviewReview(
        payload({ questions: [question(source.id)] }),
      )
    ).status,
    422,
  );
  await formal(target.id);
  const changed = await edit(id);
  changed.questions[0].questionId = target.id;
  await service.updateInterviewReview(id, changed);
  assert.equal(
    (await service.getInterviewReview(id))?.questions[0].practiced,
    false,
  );
  const detached = await edit(id);
  detached.questions[0].questionId = null;
  await service.updateInterviewReview(id, detached);
  const unlinked = (await service.getInterviewReview(id))!;
  assert.equal(unlinked.questions[0].linkedAt, null);
  assert.equal(unlinked.questions[0].questionSnapshot, null);
});
test("invalid source links, missing saved rows and reordered identities reject atomically; appending new questions preserves prior order", async () => {
  const { id } = await create(payload({ questions: [question(), question()] }));
  const before = await snapshot([
    "interview_reviews",
    "interview_review_questions",
    "interview_review_actions",
  ]);
  const value = await edit(id);
  assert.equal(
    (
      await service.updateInterviewReview(id, {
        ...value,
        questions: value.questions.slice(0, 1),
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await service.updateInterviewReview(id, {
        ...value,
        questions: [...value.questions].reverse(),
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await service.updateInterviewReview(id, {
        ...value,
        questions: [...value.questions, { ...question(2147483647), gaps: [] }],
      })
    ).status,
    422,
  );
  assert.equal(
    await snapshot([
      "interview_reviews",
      "interview_review_questions",
      "interview_review_actions",
    ]),
    before,
  );
  assert.equal(
    (
      await service.updateInterviewReview(
        id,
        reviewUpdatePayload.parse({
          ...value,
          questions: [...value.questions, question()],
        }),
      )
    ).status,
    200,
  );
  assert.deepEqual(
    (await service.getInterviewReview(id))?.questions.map(
      (row) => row.position,
    ),
    [0, 1, 2],
  );
});
test("other users' reviews, actions and practice evidence cannot leak through fixed-user reads or composite foreign keys", async () => {
  await store.db.insert(users).values({ id: "other" });
  const value = payload();
  const [other] = await store.db
    .insert(interviewReviews)
    .values({
      userId: "other",
      requestId: value.requestId,
      creation: value,
      interviewDate: value.interviewDate,
    })
    .returning();
  await store.db.insert(interviewReviewQuestions).values({
    ...value.questions[0],
    userId: "other",
    reviewId: other.id,
    position: 0,
  });
  assert.equal(await service.getInterviewReview(other.id), null);
  assert.equal((await service.listInterviewReviews()).total, 0);
  assert.equal(
    (
      await service.updateInterviewReview(
        other.id,
        reviewUpdatePayload.parse({ ...value, expectedRevision: 1 }),
      )
    ).status,
    404,
  );
  await assert.rejects(() =>
    store.db.insert(interviewReviewQuestions).values({
      ...value.questions[0],
      id: randomUUID(),
      userId: "default",
      reviewId: other.id,
      position: 1,
    }),
  );
  const source = (await service.findReviewQuestionOptions("VendorGuard"))[0];
  const own = await create(payload({ questions: [question(source.id)] }));
  await store.db.insert(reviewEvents).values({
    userId: "other",
    questionId: source.id,
    status: "mastered",
    kind: "practice",
    attemptId: randomUUID(),
  });
  assert.equal(
    (await service.getInterviewReview(own.id))?.questions[0].practiced,
    false,
  );
});
test("node/action failures roll back creation and edits, and seed never overwrites saved review material", async () => {
  await store.databaseClient.unsafe(
    "create function reject_review_write() returns trigger language plpgsql as $$ begin raise exception 'injected'; end $$; create trigger reject_review_insert before insert on interview_review_questions for each row execute function reject_review_write()",
  );
  const value = payload();
  await assert.rejects(() => service.createInterviewReview(value));
  assert.equal((await service.listInterviewReviews()).total, 0);
  await store.databaseClient.unsafe(
    "drop trigger reject_review_insert on interview_review_questions",
  );
  const { id } = await create(value);
  const before = await snapshot([
    "interview_reviews",
    "interview_review_questions",
    "interview_review_actions",
  ]);
  await store.databaseClient.unsafe(
    "create trigger reject_review_action before insert on interview_review_actions for each row execute function reject_review_write()",
  );
  const failing = await edit(id, { note: "必须回滚" });
  await assert.rejects(() => service.updateInterviewReview(id, failing));
  assert.equal(
    await snapshot([
      "interview_reviews",
      "interview_review_questions",
      "interview_review_actions",
    ]),
    before,
  );
  await store.databaseClient.unsafe(
    "drop trigger reject_review_action on interview_review_actions; drop function reject_review_write()",
  );
  await seedQuestionBank(store.db);
  assert.equal(
    await snapshot([
      "interview_reviews",
      "interview_review_questions",
      "interview_review_actions",
    ]),
    before,
  );
});
test("API validation/search remain explicit and list pagination is stable across dates and out-of-range pages", async () => {
  const bad = { params: Promise.resolve({ id: "bad" }) };
  assert.equal(
    (await route.GET(new Request("http://localhost"), bad)).status,
    400,
  );
  assert.equal(
    (
      await route.GET(new Request("http://localhost"), {
        params: Promise.resolve({ id: randomUUID() }),
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await createRoute.POST(
        new Request("http://localhost", { method: "POST", body: "{" }),
      )
    ).status,
    400,
  );
  assert.equal(
    (await optionsRoute.GET(new Request("http://localhost?q=x&q=y"))).status,
    400,
  );
  const options = await optionsRoute.GET(
    new Request("http://localhost?q=VendorGuard"),
  );
  assert.equal(options.status, 200);
  const body = await options.json();
  assert.ok(body.choices.length);
  assert.equal("answer" in body.choices[0], false);
  for (let index = 0; index < 11; index++)
    await create(
      payload({
        interviewDate: `2026-10-${String(index + 1).padStart(2, "0")}`,
        name: `第${index + 1}次面试`,
      }),
    );
  const first = await service.listInterviewReviews();
  assert.equal(first.pages, 2);
  assert.equal(first.rows[0].interviewDate, "2026-10-11");
  assert.equal(first.rows.length, 10);
  const last = await service.listInterviewReviews(999);
  assert.equal(last.page, 2);
  assert.equal(last.rows[0].interviewDate, "2026-10-01");
});
