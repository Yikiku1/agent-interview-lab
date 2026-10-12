import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, beforeEach, after, test } from "node:test";
import { eq } from "drizzle-orm";
import { startTestDatabase } from "../helpers/postgres";
import { seedQuestionBank } from "../../src/db/seed-bank";
import { mockRounds, mockNodes, questions, users } from "../../src/db/schema";
import {
  mockActionPayload,
  type MockActionPayload,
} from "../../src/lib/mock-interview-contract";

let database: Awaited<ReturnType<typeof startTestDatabase>>;
let store: typeof import("../../src/db");
let service: typeof import("../../src/lib/mock-interview");
let route: typeof import("../../src/app/api/mock-interviews/[id]/route");
before(async () => {
  database = await startTestDatabase();
  process.env.DATABASE_URL = database.url;
  store = await import("../../src/db");
  service = await import("../../src/lib/mock-interview");
  route = await import("../../src/app/api/mock-interviews/[id]/route");
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
async function create(
  project: "VendorGuard" | "发票实习" = "VendorGuard",
  requestId = randomUUID(),
) {
  const choice = (await service.getMockChoices()).find(
    (row) => row.project === project,
  )!;
  const payload = { project, requestId, questionId: choice.id };
  const result = await service.createMockRound(payload);
  assert.equal(result.status, 201);
  return { id: result.id!, payload, choice };
}
const action = (patch: Partial<MockActionPayload> = {}) =>
  mockActionPayload.parse({
    requestId: randomUUID(),
    expectedRevision: 1,
    action: "answer",
    position: 0,
    answer: "本人职责",
    elapsedSeconds: 3,
    gaps: [],
    gapNote: "",
    ...patch,
  });
async function ordinarySnapshot() {
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
  ])
    result.push(
      await store.databaseClient.unsafe(
        `select to_jsonb(t) as row from ${table} t order by to_jsonb(t)::text`,
      ),
    );
  return JSON.stringify(result);
}
test("both projects create five immutable linked nodes and keep references/future prompts server-side while GET stays readonly", async () => {
  const before = await ordinarySnapshot();
  for (const project of ["VendorGuard", "发票实习"] as const) {
    const { id, choice } = await create(project);
    const nodes = await store.db
      .select()
      .from(mockNodes)
      .where(eq(mockNodes.roundId, id))
      .orderBy(mockNodes.position);
    assert.equal(nodes.length, 5);
    assert.deepEqual(
      nodes.map((node) => node.parentPosition),
      [null, null, 1, 1, 1],
    );
    assert.ok(nodes.every((node) => node.sourceQuestionId === choice.id));
    const view = await service.getMockRound(id);
    assert.equal(view?.nodes.length, 1);
    assert.equal(view?.reference, null);
    assert.deepEqual(view?.foundations, []);
    assert.ok(!JSON.stringify(view).includes(nodes[2].prompt));
    const count = (
      await store.databaseClient`select count(*)::int as n from mock_round_actions`
    )[0].n;
    await route.GET(new Request("http://localhost"), {
      params: Promise.resolve({ id }),
    });
    assert.equal(
      (
        await store.databaseClient`select count(*)::int as n from mock_round_actions`
      )[0].n,
      count,
    );
  }
  assert.equal(await ordinarySnapshot(), before);
});
test("create retries are idempotent even after retirement and changed selection conflicts", async () => {
  const { id, payload } = await create();
  await store.db
    .update(questions)
    .set({ active: false })
    .where(eq(questions.id, payload.questionId));
  assert.equal((await service.createMockRound(payload)).id, id);
  assert.equal(
    (await service.createMockRound({ ...payload, project: "发票实习" })).status,
    409,
  );
  assert.equal(
    (await service.createMockRound({ ...payload, requestId: randomUUID() }))
      .status,
    422,
  );
  assert.equal(
    (await store.databaseClient`select count(*)::int as n from mock_rounds`)[0]
      .n,
    1,
  );
});
test("draft, answer, skip, oral answer and full finish restore order without modifying ordinary counts or W4 coverage", async () => {
  const before = await ordinarySnapshot();
  const { id } = await create();
  let payload = action({ action: "draft", gaps: ["expression", "evidence"] });
  let result = await service.applyMockAction(id, payload);
  assert.equal(result.round?.currentPosition, 0);
  assert.equal(result.round?.nodes[0].state, "pending");
  for (let position = 0; position < 5; position++) {
    payload = action({
      expectedRevision: result.round!.revision,
      position,
      action: position === 3 ? "skip" : "answer",
      answer: position === 4 ? "" : `节点 ${position}`,
      gaps: ["evidence"],
    });
    result = await service.applyMockAction(id, payload);
    assert.equal(result.status, 200);
  }
  assert.ok(result.round?.endedAt);
  assert.equal(result.round?.nodes.length, 5);
  assert.ok(result.round?.reference);
  assert.ok(result.round!.foundations.length > 0);
  assert.equal(result.round?.nodes[3].state, "skipped");
  assert.equal(result.round?.nodes[4].state, "answered");
  assert.deepEqual(await service.getMockRound(id), result.round);
  assert.equal(await ordinarySnapshot(), before);
});
test("repeated actions, late retries and changed payloads cannot duplicate or reverse progress", async () => {
  const { id } = await create();
  const one = action();
  const [a, b] = await Promise.all([
    service.applyMockAction(id, one),
    service.applyMockAction(id, one),
  ]);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.equal(a.round?.revision, 2);
  assert.equal(b.round?.revision, 2);
  await service.applyMockAction(
    id,
    action({ position: 1, expectedRevision: 2 }),
  );
  const retry = await service.applyMockAction(id, one);
  assert.equal(retry.status, 200);
  assert.equal(retry.round?.currentPosition, 2);
  assert.equal(
    (await service.applyMockAction(id, { ...one, answer: "不同文字" })).status,
    409,
  );
  assert.equal(
    (
      await store.databaseClient`select count(*)::int as n from mock_round_actions`
    )[0].n,
    2,
  );
});
test("competing revisions, future positions and decreasing timers are rejected with current server data", async () => {
  const { id } = await create();
  assert.equal(
    (await service.applyMockAction(id, action({ position: 1 }))).status,
    409,
  );
  const competing = await Promise.all([
    service.applyMockAction(
      id,
      action({ action: "draft", elapsedSeconds: 10 }),
    ),
    service.applyMockAction(
      id,
      action({ action: "draft", elapsedSeconds: 20 }),
    ),
  ]);
  assert.deepEqual(competing.map((item) => item.status).sort(), [200, 409]);
  const current = await service.getMockRound(id);
  assert.equal(
    (
      await service.applyMockAction(
        id,
        action({ expectedRevision: current!.revision, elapsedSeconds: 0 }),
      )
    ).status,
    409,
  );
});
test("early finish retains unanswered draft, remaining nodes and reference snapshot after source and target changes", async () => {
  const { id, choice } = await create();
  const original = (
    await store.db.select().from(mockNodes).where(eq(mockNodes.roundId, id))
  ).map((node) => node.prompt);
  await store.db
    .update(questions)
    .set({ active: false, answer: "Modified answer" })
    .where(eq(questions.id, choice.id));
  const result = await service.applyMockAction(
    id,
    action({ action: "finish", answer: "未答简记", gaps: ["expression"] }),
  );
  assert.ok(result.round?.endedAt);
  assert.equal(result.round?.nodes[0].state, "pending");
  assert.equal(result.round?.nodes[0].answer, "未答简记");
  assert.deepEqual(
    result.round?.nodes.map((node) => node.prompt),
    original,
  );
  assert.ok(result.round?.reference?.oral);
  assert.equal(
    (await service.applyMockAction(id, action({ expectedRevision: 2 }))).status,
    409,
  );
});
test("owned rounds and composite foreign keys isolate other users, while malformed APIs stay explicit", async () => {
  const { id } = await create();
  await store.db.insert(users).values({ id: "other" });
  await assert.rejects(() =>
    store.db
      .update(mockRounds)
      .set({ userId: "other" })
      .where(eq(mockRounds.id, id)),
  );
  await assert.rejects(() =>
    store.db
      .update(mockNodes)
      .set({ userId: "other" })
      .where(eq(mockNodes.roundId, id)),
  );
  const source = (await store.db.select().from(mockRounds))[0];
  const [other] = await store.db
    .insert(mockRounds)
    .values({
      ...source,
      id: randomUUID(),
      userId: "other",
      requestId: randomUUID(),
    })
    .returning();
  assert.equal(await service.getMockRound(other.id), null);
  assert.equal((await service.applyMockAction(other.id, action())).status, 404);
  assert.ok(
    (await service.listMockRounds()).every((round) => round.id !== other.id),
  );
  assert.equal(
    (
      await route.GET(new Request("http://localhost"), {
        params: Promise.resolve({ id: "bad" }),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await route.PUT(
        new Request("http://localhost", { method: "PUT", body: "{}" }),
        { params: Promise.resolve({ id }) },
      )
    ).status,
    400,
  );
});
test("node/action failures roll back all updates and seed never overwrites saved mock material", async () => {
  const { id } = await create();
  const before = JSON.stringify(await service.getMockRound(id));
  await store.databaseClient.unsafe(
    "CREATE FUNCTION reject_mock_action() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected'; END $$; CREATE TRIGGER reject_mock_action BEFORE INSERT ON mock_round_actions FOR EACH ROW EXECUTE FUNCTION reject_mock_action()",
  );
  await assert.rejects(() => service.applyMockAction(id, action()));
  assert.equal(JSON.stringify(await service.getMockRound(id)), before);
  await store.databaseClient.unsafe(
    "DROP TRIGGER reject_mock_action ON mock_round_actions; DROP FUNCTION reject_mock_action()",
  );
  await service.applyMockAction(id, action({ action: "draft" }));
  const saved = JSON.stringify(await service.getMockRound(id));
  await seedQuestionBank(store.db);
  assert.equal(JSON.stringify(await service.getMockRound(id)), saved);
});
