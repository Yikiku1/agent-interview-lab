import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import {
  mockActionPayload,
  mockCreatePayload,
  mockDraftKey,
  mockDraftSchema,
  mockSummary,
  nextMockPosition,
} from "../../src/lib/mock-interview-contract";

test("mock payloads reject unsupported scopes, future positions, oversized answers and unknown fields", () => {
  assert.throws(() =>
    mockCreatePayload.parse({
      requestId: randomUUID(),
      project: "综合",
      questionId: 1,
    }),
  );
  const value = {
    requestId: randomUUID(),
    expectedRevision: 1,
    position: 0,
    action: "answer",
    answer: "  本人回答  ",
    elapsedSeconds: 12,
    gaps: ["evidence", "expression", "evidence"],
    gapNote: " 日志 ",
  };
  assert.deepEqual(mockActionPayload.parse(value).gaps, [
    "expression",
    "evidence",
  ]);
  assert.equal(mockActionPayload.parse(value).answer, "本人回答");
  for (const patch of [
    { position: 5 },
    { elapsedSeconds: -1 },
    { elapsedSeconds: 86401 },
    { action: "reopen" },
    { answer: "a".repeat(10001) },
    { gapNote: "a".repeat(2001) },
    { gaps: ["unknown"] },
    { reference: "forged" },
  ])
    assert.throws(() => mockActionPayload.parse({ ...value, ...patch }));
});
test("mock next node is the first pending position, independent of input order and skipped nodes", () => {
  assert.equal(
    nextMockPosition([
      { position: 4, state: "pending" },
      { position: 0, state: "answered" },
      { position: 1, state: "skipped" },
      { position: 2, state: "pending" },
    ]),
    2,
  );
  assert.equal(
    nextMockPosition([
      { position: 0, state: "answered" },
      { position: 1, state: "skipped" },
    ]),
    null,
  );
});
test("summary distinguishes completed oral answers, skipped answers, unfinished drafts and self-marked gaps", () => {
  assert.deepEqual(
    mockSummary([
      { state: "answered", answer: " ", gaps: ["expression"] },
      { state: "skipped", answer: "保留文字", gaps: ["evidence"] },
      {
        state: "pending",
        answer: "未答草稿",
        gaps: ["expression", "evidence"],
      },
      { state: "answered", answer: "文字", gaps: [] },
    ]),
    {
      answered: 2,
      skipped: 1,
      unanswered: 1,
      oralOnly: 1,
      expression: 2,
      evidence: 2,
    },
  );
});
test("versioned mock draft keys isolate rounds and positions from ordinary practice", () => {
  const round = randomUUID();
  assert.notEqual(mockDraftKey(round, 0), mockDraftKey(round, 1));
  assert.notEqual(mockDraftKey(round, 0), mockDraftKey(randomUUID(), 0));
  assert.match(mockDraftKey(round, 0), /practice:note:mock:v1/);
  assert.ok(
    mockDraftSchema.parse({
      version: 1,
      baseRevision: 1,
      answer: "",
      elapsedSeconds: 0,
      gaps: [],
      gapNote: "",
      pending: null,
    }),
  );
  assert.throws(() => mockDraftSchema.parse({ version: 2 }));
});
