import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import {
  emptyPracticeDraft,
  getDraftSnapshot,
  MAX_ANSWER_LENGTH,
  parsePracticeDraft,
  practiceDraftKey,
  subscribeDrafts,
  writePracticeDraft,
  restorePracticeDraft,
} from "../../src/lib/practice-draft";

test("drafts preserve the exact answer and pending submission across restoration", () => {
  const draft = { ...emptyPracticeDraft(), answer: "  我的回答\n第二行  " };
  assert.deepEqual(parsePracticeDraft(JSON.stringify(draft)), draft);
  const pending = {
    ...draft,
    submission: {
      attemptId: randomUUID(),
      status: "fuzzy",
      answer: draft.answer,
    },
  };
  assert.deepEqual(parsePracticeDraft(JSON.stringify(pending)), pending);
  assert.deepEqual(
    parsePracticeDraft(JSON.stringify({ ...pending, completed: true })),
    { ...pending, completed: true },
  );
  assert.notEqual(practiceDraftKey(1), practiceDraftKey(2));
});

test("malformed and inconsistent drafts are rejected instead of submitting a different answer", () => {
  for (const raw of [
    null,
    "{",
    "null",
    JSON.stringify({ ...emptyPracticeDraft(), version: 2 }),
    JSON.stringify({ ...emptyPracticeDraft(), completed: true }),
    JSON.stringify({
      ...emptyPracticeDraft(),
      answer: "x".repeat(MAX_ANSWER_LENGTH + 1),
    }),
    JSON.stringify({
      ...emptyPracticeDraft(),
      submission: {
        attemptId: randomUUID(),
        status: "mastered",
        answer: "different",
      },
    }),
  ]) {
    assert.equal(parsePracticeDraft(raw), null);
  }
});

test("storage quota failures preserve the edited draft and notify subscribers", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error("quota exceeded");
        },
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  });
  try {
    let notifications = 0;
    const unsubscribe = subscribeDrafts(() => {
      notifications++;
    });
    const draft = { ...emptyPracticeDraft(), answer: "Still usable" };
    assert.equal(writePracticeDraft(42, draft), false);
    assert.deepEqual(parsePracticeDraft(getDraftSnapshot(42)), draft);
    assert.equal(notifications, 1);
    unsubscribe();
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("saved events restore lost responses but preserve explicit new drafts and conflicts", () => {
  const attemptId = randomUUID();
  const recorded = {
    questionId: 1,
    status: "mastered" as const,
    answer: "saved answer",
    attemptId,
    nextReviewAt: null,
  };
  const pending = {
    ...emptyPracticeDraft(),
    answer: "  saved answer  ",
    submission: {
      attemptId,
      status: "mastered" as const,
      answer: "  saved answer  ",
    },
  };
  assert.equal(restorePracticeDraft(pending, recorded).completed, true);
  assert.equal(restorePracticeDraft(null, recorded).answer, "saved answer");
  assert.deepEqual(
    restorePracticeDraft(emptyPracticeDraft(), recorded),
    emptyPracticeDraft(),
  );
  const conflicting = {
    ...pending,
    answer: "different",
    submission: { ...pending.submission, answer: "different" },
    failure: { status: 409, message: "conflict" },
  };
  assert.deepEqual(restorePracticeDraft(conflicting, recorded), conflicting);
  const stale = {
    ...pending,
    completed: true,
    submission: { ...pending.submission, attemptId: randomUUID() },
  };
  assert.equal(
    restorePracticeDraft(stale, recorded).submission?.attemptId,
    attemptId,
  );
});

test("terminal failures retain the pending answer and malformed failure metadata is rejected", () => {
  const answer = "回答仍然保留";
  const pending = {
    ...emptyPracticeDraft(),
    answer,
    submission: { attemptId: randomUUID(), status: "unknown", answer },
    failure: { status: 409, message: "content conflict" },
  };
  assert.deepEqual(parsePracticeDraft(JSON.stringify(pending)), pending);
  for (const invalid of [
    { ...pending, completed: true },
    { ...pending, submission: null },
    { ...pending, failure: { status: 500, message: "temporary" } },
  ])
    assert.equal(parsePracticeDraft(JSON.stringify(invalid)), null);
});

test("round-scoped storage isolates new rounds and imports only uncompleted legacy answer text", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  const entries = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => entries.get(key) ?? null,
        setItem: (key: string, value: string) => entries.set(key, value),
      },
    },
  });
  try {
    const first = randomUUID(),
      second = randomUUID();
    writePracticeDraft(
      601,
      { ...emptyPracticeDraft(), answer: "first round" },
      first,
    );
    assert.equal(
      parsePracticeDraft(getDraftSnapshot(601, first))?.answer,
      "first round",
    );
    assert.equal(getDraftSnapshot(601, second), null);
    entries.set(
      practiceDraftKey(602),
      JSON.stringify({
        ...emptyPracticeDraft(),
        answer: "legacy",
        submission: {
          attemptId: randomUUID(),
          status: "fuzzy",
          answer: "legacy",
        },
      }),
    );
    assert.deepEqual(parsePracticeDraft(getDraftSnapshot(602, first)), {
      ...emptyPracticeDraft(),
      answer: "legacy",
    });
    assert.equal(getDraftSnapshot(602, first, false), null);
    entries.set(
      practiceDraftKey(602),
      JSON.stringify({
        ...parsePracticeDraft(entries.get(practiceDraftKey(602))!)!,
        completed: true,
      }),
    );
    assert.equal(getDraftSnapshot(602, second), null);
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
