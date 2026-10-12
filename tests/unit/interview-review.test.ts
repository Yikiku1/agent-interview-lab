import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import {
  mergeReviewFields,
  reviewCreatePayload,
  reviewDraftKey,
  reviewDraftSchema,
  reviewPracticeQueue,
  reviewPracticeState,
  reviewUpdatePayload,
} from "../../src/lib/interview-review-contract";
const row = () => ({
  id: randomUUID(),
  prompt: "  实际原问题  ",
  answerSummary: "",
  gaps: ["evidence", "expression", "evidence"],
  gapNote: "",
  improvement: "",
  questionId: null,
});
const payload = () => ({
  interviewDate: "2026-10-12",
  name: "",
  note: "",
  questions: [row()],
  requestId: randomUUID(),
});
test("real interview accepts a single unlinked question and validates dates, field limits, identities and immutable request fields", () => {
  const value = payload();
  assert.deepEqual(reviewCreatePayload.parse(value).questions[0].gaps, [
    "expression",
    "evidence",
  ]);
  assert.equal(
    reviewCreatePayload.parse(value).questions[0].prompt,
    "实际原问题",
  );
  for (const patch of [
    { interviewDate: "2026-02-30" },
    { interviewDate: "2026-1-1" },
    { name: "x".repeat(201) },
    { questions: [] },
    { questions: [value.questions[0], value.questions[0]] },
    { questions: Array.from({ length: 21 }, row) },
    { expectedRevision: 1 },
  ])
    assert.equal(
      reviewCreatePayload.safeParse({ ...value, ...patch }).success,
      false,
    );
  for (const patch of [
    { prompt: "  " },
    { prompt: "x".repeat(10001) },
    { answerSummary: "x".repeat(10001) },
    { gapNote: "x".repeat(2001) },
    { improvement: "x".repeat(10001) },
    { questionId: 0 },
    { practiced: true },
  ])
    assert.equal(
      reviewCreatePayload.safeParse({
        ...value,
        questions: [{ ...value.questions[0], ...patch }],
      }).success,
      false,
    );
  assert.equal(
    reviewUpdatePayload.safeParse({ ...value, expectedRevision: 0 }).success,
    false,
  );
});
test("review states and stable deduplicated queues keep unlinked, inactive and already practiced records distinct", () => {
  assert.equal(reviewPracticeState(null, null, false), "unlinked");
  assert.equal(reviewPracticeState(1, true, false), "pending");
  assert.equal(reviewPracticeState(1, false, false), "inactive");
  assert.equal(reviewPracticeState(1, false, true), "practiced");
  assert.deepEqual(
    reviewPracticeQueue(
      [
        { questionId: null, active: null, practiced: false },
        { questionId: 3, active: false, practiced: false },
        { questionId: 2, active: true, practiced: true },
        ...[8, 8, 4, 5, 6].map((questionId) => ({
          questionId,
          active: true,
          practiced: false,
        })),
      ],
      3,
    ),
    [8, 4, 5],
  );
});
test("review drafts retain empty unfinished text and isolate creation, saved reviews and ordinary practice", () => {
  const value = reviewCreatePayload.parse(payload());
  const { requestId, ...fields } = value;
  const draft = reviewDraftSchema.parse({
    version: 1,
    baseRevision: null,
    fields: {
      ...fields,
      questions: [{ ...fields.questions[0], prompt: "  " }],
    },
    labels: {},
    pending: value,
  });
  assert.equal(draft.fields.questions[0].prompt, "  ");
  assert.equal(draft.pending?.requestId, requestId);
  assert.notEqual(reviewDraftKey(), reviewDraftKey(randomUUID()));
  assert.notEqual(reviewDraftKey("one"), reviewDraftKey("two"));
  assert.match(reviewDraftKey(), /interview-review:v1:create$/);
});
test("explicit conflict merge preserves server-added questions and local edits by identity rather than position", () => {
  const base = reviewCreatePayload.parse(payload());
  const localNew = reviewCreatePayload.parse(payload()).questions[0];
  const serverNew = reviewCreatePayload.parse(payload()).questions[0];
  const merged = mergeReviewFields(
    { ...base, name: "server", questions: [...base.questions, serverNew] },
    {
      ...base,
      name: "local",
      questions: [
        { ...base.questions[0], improvement: "local improvement" },
        localNew,
      ],
    },
  );
  assert.equal(merged.name, "local");
  assert.equal(merged.questions[0].improvement, "local improvement");
  assert.deepEqual(
    merged.questions.map((question) => question.id),
    [base.questions[0].id, serverNew.id, localNew.id],
  );
});
