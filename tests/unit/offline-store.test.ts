import test from "node:test";
import assert from "node:assert/strict";
// Browser ESM deliberately contains no Node or framework dependency.
import {
  createStore,
  createStorage,
  emptyState,
  scheduleReview,
  parseBackup,
} from "../../mobile/www/store.js";
type NativeGlobal = typeof globalThis & {
  OfflineNative?: {
    readState: () => unknown;
    writeState: (text: string) => boolean;
  };
};
type CorruptibleBackup = {
  state: {
    progress: Record<number, { practiceCount: number }>;
    events: Record<string, unknown>[];
    session: {
      id: string;
      queue: number[];
      index: number;
      completed: Record<number, string>;
    } | null;
    cards: Record<number, unknown>;
  };
};
const questions = [{ id: 1 }, { id: 2 }];
function fixture() {
  let raw: string | null = null;
  let broken = false;
  return {
    storage: {
      read: () => raw,
      write: (text: string) => {
        if (broken) throw Error("disk full");
        raw = text;
      },
    },
    raw: () => raw,
    break: () => {
      broken = true;
    },
  };
}
const at = "2026-10-18T00:00:00.000Z";
test("native empty-state sentinel initializes a fresh profile", () => {
  const root = globalThis as NativeGlobal;
  const previous = root.OfflineNative;
  root.OfflineNative = {
    readState: () => "__INTERVIEW_LAB_EMPTY_STATE_V1__",
    writeState: () => true,
  };
  try {
    assert.deepEqual(
      createStore({ questions, storage: createStorage() }).getState(),
      emptyState(),
    );
  } finally {
    root.OfflineNative = previous;
  }
});
test("fresh installation is empty; state survives a new store and copies cannot mutate memory", () => {
  const f = fixture();
  const a = createStore({ questions, storage: f.storage });
  assert.deepEqual(a.getState(), emptyState());
  a.saveDraft(1, "draft");
  const b = createStore({ questions, storage: f.storage });
  assert.equal(b.getState().drafts[1], "draft");
  b.getState().drafts[1] = "changed";
  assert.equal(b.getState().drafts[1], "draft");
});
test("completion is idempotent; assessment does not complete or alter review schedule", () => {
  const f = fixture();
  const s = createStore({ questions, storage: f.storage });
  s.setStatus(1, "mastered");
  assert.equal(s.stats(at).attempts, 0);
  assert.equal(s.getState().progress[1].nextReviewAt, null);
  const e = {
    questionId: 1,
    attemptId: "attempt-1",
    status: "mastered",
    answer: "answer",
    completedAt: at,
  };
  s.complete(e);
  s.complete(e);
  assert.equal(s.stats(at).attempts, 1);
  assert.equal(s.getState().progress[1].practiceCount, 1);
  assert.throws(() => s.complete({ ...e, answer: "different" }));
  const next = s.getState().progress[1].nextReviewAt;
  s.setStatus(1, "fuzzy");
  assert.equal(s.getState().progress[1].nextReviewAt, next);
});
test("schedule matches desktop 1/3/7/14 mastered days and weak reset", () => {
  let stage = 0;
  for (const days of [1, 3, 7, 14, 14]) {
    const r = scheduleReview("mastered", stage, at);
    assert.equal(
      (Date.parse(r.nextReviewAt) - Date.parse(at)) / 86400000,
      days,
    );
    stage = r.reviewStage;
  }
  assert.equal(scheduleReview("fuzzy", 4, at).reviewStage, 0);
  assert.equal(
    scheduleReview("unknown", 4, at).nextReviewAt,
    "2026-10-19T00:00:00.000Z",
  );
});
test("failed storage does not modify memory or previous disk data", () => {
  const f = fixture();
  const s = createStore({ questions, storage: f.storage });
  s.saveDraft(1, "before");
  const raw = f.raw();
  f.break();
  assert.throws(() =>
    s.complete({
      questionId: 1,
      attemptId: "a",
      status: "fuzzy",
      completedAt: at,
    }),
  );
  assert.equal(s.stats(at).attempts, 0);
  assert.equal(s.getState().drafts[1], "before");
  assert.equal(f.raw(), raw);
});
test("fixed queue completion, drafts, cards, gaps, target, mock and review survive backup restore", () => {
  const f = fixture();
  const s = createStore({ questions, storage: f.storage });
  s.saveSession({ id: "round", queue: [1, 2], index: 0, completed: {} });
  s.saveDraft(2, "unfinished");
  s.saveCard(1, { shortAnswer: "mine", evidence: "code" });
  s.saveGap({
    id: "g",
    questionId: 1,
    note: "gap",
    kind: "concept",
    resolvedAt: null,
  });
  s.saveTarget({ preset: "all", dailySize: 5 });
  s.saveMockRound({
    id: "m",
    project: "VendorGuard",
    questionId: 1,
    endedAt: null,
    index: 0,
    nodes: Array.from({ length: 5 }, () => ({
      prompt: "why",
      answer: "because",
      gapNote: "",
      state: "pending",
    })),
    createdAt: at,
  });
  s.saveInterviewReview({
    id: "r",
    company: "example",
    updatedAt: at,
    questions: [
      {
        id: "q",
        prompt: "q",
        answer: "",
        gap: "",
        improvement: "",
        questionId: 2,
        linkedAt: at,
        baselineEventIds: [],
      },
    ],
    createdAt: at,
  });
  s.complete({
    questionId: 1,
    attemptId: "a",
    status: "unknown",
    completedAt: at,
  });
  assert.equal(s.getState().session.completed[1], "a");
  assert.equal(s.stats(at).attempts, 1);
  const restored = createStore({
    questions: [...questions, { id: 3 }],
    storage: fixture().storage,
  });
  restored.importBackup(s.exportBackup());
  assert.deepEqual(restored.getState(), s.getState());
  assert.equal(restored.stats(at).total, 3);
});
test("malformed, future versions, unknown question refs, duplicate ids and invalid dates reject atomically", () => {
  const f = fixture();
  const s = createStore({ questions, storage: f.storage });
  s.saveDraft(1, "keep");
  const original = s.getState();
  const backup = JSON.parse(s.exportBackup());
  const variants = [
    { ...backup, version: 2 },
    { ...backup, state: { ...backup.state, version: 0 } },
    { ...backup, state: { ...backup.state, drafts: { 999: "bad" } } },
    { ...backup, exportedAt: "2026-02-30T00:00:00.000Z" },
    {
      ...backup,
      state: {
        ...backup.state,
        gaps: [
          { id: "x", questionId: 1 },
          { id: "x", questionId: 2 },
        ],
      },
    },
  ];
  for (const v of variants) {
    assert.throws(() => s.importBackup(JSON.stringify(v)));
    assert.deepEqual(s.getState(), original);
  }
  assert.throws(() => parseBackup("x".repeat(8 * 1024 * 1024 + 1), questions));
  assert.throws(() => s.importBackup("{bad"));
});
test("native-style false acknowledgment rejects write and keeps empty state", () => {
  const s = createStore({
    questions,
    storage: { read: () => null, write: () => false },
  });
  assert.throws(() => s.saveDraft(1, "x"), /保存失败/);
  assert.deepEqual(s.getState(), emptyState());
});
test("forged completion counts, duplicate attempts, prototype keys and mismatched queue references reject", () => {
  const s = createStore({ questions, storage: fixture().storage });
  s.complete({
    questionId: 1,
    attemptId: "a",
    status: "mastered",
    completedAt: at,
  });
  const base = JSON.parse(s.exportBackup());
  for (const mutate of [
    (b: CorruptibleBackup) => b.state.progress[1].practiceCount++,
    (b: CorruptibleBackup) => b.state.events.push({ ...b.state.events[0] }),
    (b: CorruptibleBackup) =>
      (b.state.session = {
        id: "s",
        queue: [2],
        index: 0,
        completed: { 2: "a" },
      }),
    (b: CorruptibleBackup) =>
      (b.state.cards[1] = JSON.parse('{"__proto__":{"polluted":true}}')),
  ]) {
    const b = structuredClone(base);
    mutate(b);
    assert.throws(() => s.importBackup(JSON.stringify(b)));
    assert.equal(s.stats(at).attempts, 1);
  }
});
test("changing fixed round clears previous draft while restoring same round retains it", () => {
  const s = createStore({ questions, storage: fixture().storage });
  s.saveSession({ id: "one", queue: [1], index: 0, completed: {} });
  s.saveDraft(1, "one");
  s.saveSession({ id: "one", queue: [1], index: 0, completed: {} });
  assert.equal(s.getState().drafts[1], "one");
  s.saveSession({ id: "two", queue: [1], index: 0, completed: {} });
  assert.deepEqual(s.getState().drafts, {});
});
test("bridge read corruption cannot silently create a fresh profile", () => {
  for (const raw of [undefined, "", false, 0, {}]) {
    let writes = 0;
    assert.throws(
      () =>
        Reflect.apply(createStore, null, [
          {
            questions,
            storage: {
              read: () => raw,
              write: () => {
                writes++;
              },
            },
          },
        ]),
      /设备读取失败/,
    );
    assert.equal(writes, 0);
  }
});
test("malformed feature payloads reject backup atomically before UI can consume them", () => {
  const s = createStore({ questions, storage: fixture().storage });
  s.saveDraft(1, "keep");
  const before = s.getState();
  const malformed = [
    { target: { preset: "all", dailySize: 999 } },
    {
      target: {
        preset: "all",
        dailySize: 5,
        reviewDrafts: { new: { questionId: "1" } },
      },
    },
    { cards: { 1: { evidence: [] } } },
    {
      gaps: [
        { id: "g", questionId: 1, kind: "bogus", note: "", resolvedAt: null },
      ],
    },
    {
      mockRounds: [
        {
          id: "m",
          questionId: 1,
          project: "VendorGuard",
          createdAt: at,
          endedAt: null,
          index: 0,
          nodes: [],
        },
      ],
    },
    {
      interviewReviews: [
        {
          id: "r",
          company: "",
          createdAt: at,
          updatedAt: at,
          questions: [
            {
              id: "q",
              prompt: "why",
              answer: "",
              gap: "",
              improvement: "",
              questionId: 1,
              linkedAt: at,
              baselineEventIds: null,
            },
          ],
        },
      ],
    },
  ];
  for (const fields of malformed) {
    const b = JSON.parse(s.exportBackup());
    b.state = { ...b.state, ...fields };
    assert.throws(() => s.importBackup(JSON.stringify(b)));
    assert.deepEqual(s.getState(), before);
  }
});
