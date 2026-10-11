import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, test } from "node:test";
import { startTestDatabase } from "../helpers/postgres";
import { seedQuestionBank } from "../../src/db/seed-bank";
import { gapQueue } from "../../src/lib/practice-notes-contract";
let database: Awaited<ReturnType<typeof startTestDatabase>>;
let store: typeof import("../../src/db");
let cards: typeof import("../../src/app/api/answer-cards/route");
let observations: typeof import("../../src/app/api/practice-observations/route");
let gaps: typeof import("../../src/app/api/practice-gaps/route");
let patch: typeof import("../../src/app/api/practice-gaps/[id]/route");
let queries: typeof import("../../src/lib/practice-notes");
let questions: typeof import("../../src/lib/questions");
before(async () => {
  database = await startTestDatabase();
  process.env.DATABASE_URL = database.url;
  store = await import("../../src/db");
  cards = await import("../../src/app/api/answer-cards/route");
  observations = await import("../../src/app/api/practice-observations/route");
  gaps = await import("../../src/app/api/practice-gaps/route");
  patch = await import("../../src/app/api/practice-gaps/[id]/route");
  queries = await import("../../src/lib/practice-notes");
  questions = await import("../../src/lib/questions");
});
after(async () => {
  if (store) await store.databaseClient.end();
  if (database) await database.stop();
});
beforeEach(async () => {
  await store.databaseClient.unsafe(
    "TRUNCATE users, questions RESTART IDENTITY CASCADE",
  );
  await store.databaseClient`insert into users (id) values ('default'), ('other')`;
  await store.databaseClient`insert into questions (question, answer, category, subcategory, difficulty, tags, active) values ('q1','原参考','Agent','简历专项 · VendorGuard','easy',ARRAY['简历专项','VendorGuard','P0','简历实战'],true), ('q2','参考2','Agent','测试','easy',ARRAY[]::text[],true), ('q3','参考3','Agent','测试','easy',ARRAY[]::text[],false)`;
  await store.databaseClient`insert into review_events (user_id, question_id, status, kind, answer, attempt_id, round_id) values ('default',1,'fuzzy','practice','原历史回答',${randomUUID()},${randomUUID()}), ('default',1,'fuzzy','legacy',null,null,null), ('other',1,'fuzzy','practice','他人回答',${randomUUID()},${randomUUID()}), ('default',2,'fuzzy','practice','另题回答',${randomUUID()},${randomUUID()})`;
});
const request = (path: string, body: unknown, method = "POST") =>
  new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const card = (overrides: Record<string, unknown> = {}) => ({
  questionId: 1,
  expectedRevision: 0,
  shortAnswer: " 我的回答 ",
  ...overrides,
});
const observation = (overrides: Record<string, unknown> = {}) => ({
  requestId: randomUUID(),
  questionId: 1,
  reviewEventId: 1,
  pointChecks: [
    {
      position: 1,
      pointTextSnapshot: " 当时要点 ",
      covered: true,
      note: "说明",
    },
  ],
  gaps: [
    { kind: "evidence", note: " 项目证据 " },
    { kind: "concept", note: "概念" },
  ],
  ...overrides,
});
async function originalSnapshot() {
  const tables = [
    "users",
    "questions",
    "user_question_progress",
    "review_events",
  ];
  const rows = [];
  for (const table of tables)
    rows.push(
      await store.databaseClient.unsafe(
        `select to_jsonb(t) as row from ${table} t order by to_jsonb(t)::text`,
      ),
    );
  return JSON.stringify(rows);
}
test("card normalization, persistence, retry, conflict and revision do not change practice history", async () => {
  const before = await originalSnapshot();
  const first = await cards.PUT(request("/api/answer-cards", card(), "PUT"));
  assert.equal(first.status, 201);
  assert.equal((await first.json()).card.shortAnswer, "我的回答");
  assert.equal(
    (await cards.PUT(request("/api/answer-cards", card(), "PUT"))).status,
    200,
  );
  const conflict = await cards.PUT(
    request("/api/answer-cards", card({ shortAnswer: "不同内容" }), "PUT"),
  );
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).card.revision, 1);
  assert.equal(
    (
      await cards.PUT(
        request("/api/answer-cards", card({ expectedRevision: 1 }), "PUT"),
      )
    ).status,
    200,
  );
  assert.equal(
    (await cards.PUT(request("/api/answer-cards", card(), "PUT"))).status,
    409,
  );
  const saved = await (
    await cards.GET(
      new Request("http://localhost/api/answer-cards?questionId=1"),
    )
  ).json();
  assert.equal(saved.card.revision, 2);
  assert.equal(saved.card.example, "");
  assert.equal(await originalSnapshot(), before);
});
test("concurrent card creation and updates serialize both missing and existing rows", async () => {
  const results = await Promise.all([
    cards.PUT(request("/api/answer-cards", card(), "PUT")),
    cards.PUT(
      request("/api/answer-cards", card({ shortAnswer: "other" }), "PUT"),
    ),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  const updates = await Promise.all([
    cards.PUT(
      request(
        "/api/answer-cards",
        card({ expectedRevision: 1, shortAnswer: "a" }),
        "PUT",
      ),
    ),
    cards.PUT(
      request(
        "/api/answer-cards",
        card({ expectedRevision: 1, shortAnswer: "b" }),
        "PUT",
      ),
    ),
  ]);
  assert.deepEqual(updates.map((r) => r.status).sort(), [200, 409]);
  assert.equal((await queries.getAnswerCard(1))?.revision, 2);
});
test("card strict validation, unknown questions and inactive records", async () => {
  for (const body of [
    card({ userId: "other" }),
    card({ expectedRevision: -1 }),
    card({ evidence: "x".repeat(10001) }),
    card({ questionId: "1" }),
  ])
    assert.equal(
      (await cards.PUT(request("/api/answer-cards", body, "PUT"))).status,
      400,
    );
  assert.equal(
    (
      await cards.PUT(
        request("/api/answer-cards", card({ questionId: 999 }), "PUT"),
      )
    ).status,
    404,
  );
  for (const query of [
    "questionId=1&questionId=2",
    "questionId=-1",
    "questionId=1&userId=other",
    "questionId=1e0",
  ])
    assert.equal(
      (
        await cards.GET(
          new Request(`http://localhost/api/answer-cards?${query}`),
        )
      ).status,
      400,
    );
  assert.equal(
    (
      await cards.GET(
        new Request("http://localhost/api/answer-cards?questionId=999"),
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await cards.PUT(
        request("/api/answer-cards", card({ questionId: 3 }), "PUT"),
      )
    ).status,
    201,
  );
  assert.ok(await questions.getQuestion(3, true));
  assert.equal(await questions.getQuestion(3), undefined);
});
test("observations preserve snapshots and canonical concurrent retries without changing original tables", async () => {
  const before = await originalSnapshot();
  const body = observation();
  const results = await Promise.all([
    observations.POST(request("/api/practice-observations", body)),
    observations.POST(
      request("/api/practice-observations", {
        ...body,
        gaps: [...body.gaps].reverse(),
      }),
    ),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 201]);
  const rows = await queries.getObservations(1);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].payload.pointChecks[0].pointTextSnapshot, "当时要点");
  assert.equal(rows[0].reviewEventId, 1);
  assert.equal(
    (
      await observations.POST(
        request("/api/practice-observations", {
          ...body,
          gaps: [{ kind: "other", note: "改变" }],
        }),
      )
    ).status,
    409,
  );
  const [counts] =
    await store.databaseClient`select (select count(*) from answer_point_checks)::int as points, (select count(*) from practice_gaps)::int as gaps`;
  assert.deepEqual(counts, { points: 1, gaps: 2 });
  assert.equal(await originalSnapshot(), before);
});
test("event association rejects legacy, other user, other question and missing events; standalone saves work", async () => {
  for (const id of [2, 3, 4, 999])
    assert.equal(
      (
        await observations.POST(
          request(
            "/api/practice-observations",
            observation({ reviewEventId: id }),
          ),
        )
      ).status,
      404,
    );
  assert.equal(
    (
      await observations.POST(
        request(
          "/api/practice-observations",
          observation({ reviewEventId: null }),
        ),
      )
    ).status,
    201,
  );
  assert.equal(
    (
      await observations.POST(
        request("/api/practice-observations", observation({ questionId: 999 })),
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await store.databaseClient`select count(*)::int as n from practice_observations`
    )[0].n,
    1,
  );
});
test("strict observation validation refuses duplicates and malformed data without inserts", async () => {
  for (const body of [
    observation({ userId: "other" }),
    observation({ requestId: "bad" }),
    observation({ pointChecks: [], gaps: [] }),
    observation({
      pointChecks: [
        { position: 0, pointTextSnapshot: "a", covered: true },
        { position: 0, pointTextSnapshot: "b", covered: false },
      ],
    }),
    observation({ gaps: [{ kind: "concept" }, { kind: "concept" }] }),
    observation({ gaps: [{ kind: "concept", note: "x".repeat(2001) }] }),
  ])
    assert.equal(
      (await observations.POST(request("/api/practice-observations", body)))
        .status,
      400,
    );
  assert.equal(
    (
      await store.databaseClient`select count(*)::int as n from practice_observations`
    )[0].n,
    0,
  );
});
test("observation child write failures roll back parent and all children; retry succeeds", async () => {
  const body = observation();
  await store.databaseClient.unsafe(
    "CREATE FUNCTION reject_gap() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test rejection'; END $$; CREATE TRIGGER reject_gap BEFORE INSERT ON practice_gaps FOR EACH ROW EXECUTE FUNCTION reject_gap()",
  );
  try {
    assert.equal(
      (await observations.POST(request("/api/practice-observations", body)))
        .status,
      500,
    );
    const [counts] =
      await store.databaseClient`select (select count(*) from practice_observations)::int as observations, (select count(*) from answer_point_checks)::int as points`;
    assert.deepEqual(counts, { observations: 0, points: 0 });
  } finally {
    await store.databaseClient.unsafe(
      "DROP TRIGGER reject_gap ON practice_gaps; DROP FUNCTION reject_gap()",
    );
  }
  assert.equal(
    (await observations.POST(request("/api/practice-observations", body)))
      .status,
    201,
  );
});
test("gap resolution is explicit and idempotent; original observation retries never reopen gaps", async () => {
  const body = observation();
  await observations.POST(request("/api/practice-observations", body));
  const rows = await queries.getPracticeGaps({}, undefined, false);
  const id = rows[0].gap.id;
  const update = (body: unknown) =>
    patch.PATCH(request(`/api/practice-gaps/${id}`, body, "PATCH"), {
      params: Promise.resolve({ id: String(id) }),
    });
  const one = await (await update({ resolved: true })).json();
  const two = await (await update({ resolved: true })).json();
  assert.equal(one.gap.resolvedAt, two.gap.resolvedAt);
  assert.equal(
    (await observations.POST(request("/api/practice-observations", body)))
      .status,
    200,
  );
  assert.equal((await queries.getPracticeGaps({}, undefined, false)).length, 1);
  assert.equal((await update({ toggle: true })).status, 400);
  await update({ resolved: false });
  assert.equal((await queries.getPracticeGaps({}, undefined, false)).length, 2);
  assert.equal(
    (
      await patch.PATCH(
        request("/api/practice-gaps/999", { resolved: true }, "PATCH"),
        { params: Promise.resolve({ id: "999" }) },
      )
    ).status,
    404,
  );
});
test("gap filters, inactive retention, deduped queue and owned data follow shared scope", async () => {
  for (const questionId of [1, 1, 2, 3])
    await observations.POST(
      request(
        "/api/practice-observations",
        observation({
          questionId,
          reviewEventId: null,
          gaps: [{ kind: "concept", note: String(questionId) }],
        }),
      ),
    );
  const all = await (
    await gaps.GET(new Request("http://localhost/api/practice-gaps"))
  ).json();
  assert.equal(all.gaps.length, 4);
  assert.deepEqual(gapQueue(all.gaps, 5), [1, 2]);
  assert.ok(
    all.gaps.find(
      (row: { question: { active: boolean } }) => !row.question.active,
    ),
  );
  const scoped = await (
    await gaps.GET(
      new Request(
        "http://localhost/api/practice-gaps?preset=resume_focus&project=VendorGuard&kind=concept",
      ),
    )
  ).json();
  assert.equal(scoped.gaps.length, 2);
  for (const query of [
    "kind=unknown",
    "resolved=no",
    "kind=concept&kind=evidence",
    "userId=other",
    "preset=general_core&project=VendorGuard",
  ])
    assert.equal(
      (
        await gaps.GET(
          new Request(`http://localhost/api/practice-gaps?${query}`),
        )
      ).status,
      400,
    );
});
test("seed upsert preserves cards, observations, point checks and gaps", async () => {
  await cards.PUT(request("/api/answer-cards", card(), "PUT"));
  await observations.POST(request("/api/practice-observations", observation()));
  const snapshot = async () =>
    JSON.stringify(
      await Promise.all([
        queries.getAnswerCard(1),
        queries.getObservations(1),
        queries.getPracticeGaps(),
      ]),
    );
  const before = await snapshot();
  await seedQuestionBank(store.db);
  assert.equal(await snapshot(), before);
});

test("failed card update leaves revision and saved fields intact", async () => {
  await cards.PUT(request("/api/answer-cards", card(), "PUT"));
  await store.databaseClient.unsafe(
    "CREATE FUNCTION reject_card() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test rejection'; END $$; CREATE TRIGGER reject_card BEFORE UPDATE ON personal_answer_cards FOR EACH ROW EXECUTE FUNCTION reject_card()",
  );
  try {
    assert.equal(
      (
        await cards.PUT(
          request(
            "/api/answer-cards",
            card({ expectedRevision: 1, shortAnswer: "changed" }),
            "PUT",
          ),
        )
      ).status,
      500,
    );
    assert.equal((await queries.getAnswerCard(1))?.revision, 1);
    assert.equal((await queries.getAnswerCard(1))?.shortAnswer, "我的回答");
  } finally {
    await store.databaseClient.unsafe(
      "DROP TRIGGER reject_card ON personal_answer_cards; DROP FUNCTION reject_card()",
    );
  }
});

test("reads and explicit resolution never expose or edit another user's notes", async () => {
  await store.databaseClient`insert into personal_answer_cards (user_id,question_id,short_answer) values ('other',1,'other card')`;
  const [parent] =
    await store.databaseClient`insert into practice_observations (user_id,question_id,request_id,payload) values ('other',1,${randomUUID()},'{}') returning id`;
  const [gap] =
    await store.databaseClient`insert into practice_gaps (observation_id,user_id,question_id,kind) values (${parent.id},'other',1,'concept') returning id`;
  assert.equal(await queries.getAnswerCard(1), null);
  assert.deepEqual(await queries.getPracticeGaps(), []);
  assert.equal(await queries.resolvePracticeGap(gap.id, true), null);
  assert.deepEqual(await queries.getObservations(1), []);
});
