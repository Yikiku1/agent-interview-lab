import assert from "node:assert/strict";
import { test } from "node:test";
import { corePath } from "../../src/db/core-path";
import {
  beijingDayBounds,
  selectDailyPractice,
  type DailyCandidate,
} from "../../src/lib/daily-practice";

const now = new Date("2026-10-08T02:00:00Z");
const yesterday = new Date("2026-10-07T02:00:00Z");
function candidate(
  id: number,
  overrides: Partial<DailyCandidate> = {},
): DailyCandidate {
  return {
    id,
    question: `ordinary ${id}`,
    category: "Agent",
    active: true,
    status: null,
    nextReviewAt: null,
    lastPracticeAt: null,
    completedToday: false,
    ...overrides,
  };
}
function core(index: number, overrides: Partial<DailyCandidate> = {}) {
  return candidate(index + 100, {
    question: corePath[index].question,
    category: corePath[index].category,
    ...overrides,
  });
}

test("daily prioritizes due, then formally practiced weak, then path-ordered core; counts reflect unique ids", () => {
  const rows = [
    core(6),
    core(0, {
      status: "unknown",
      lastPracticeAt: yesterday,
      nextReviewAt: yesterday,
    }),
    candidate(9, { status: "fuzzy", lastPracticeAt: yesterday }),
    candidate(8, {
      status: "mastered",
      lastPracticeAt: yesterday,
      nextReviewAt: new Date("2026-10-06T00:00:00Z"),
    }),
    core(1),
    candidate(7, { status: "unknown" }),
  ];
  const daily = selectDailyPractice(rows, now);
  assert.deepEqual(daily.ids, [8, 100, 9, 101, 106]);
  assert.deepEqual(daily.counts, { due: 2, weak: 1, core: 2 });
  assert.deepEqual(daily.themes, ["Agent", "LLM", "Python"]);
  assert.equal(new Set(daily.ids).size, daily.ids.length);
  assert.equal(daily.coreProgress.completed, 1);
});

test("12 due questions cap at earliest ten, include mastered and break ties by status then id", () => {
  const rows = Array.from({ length: 12 }, (_, i) =>
    candidate(12 - i, {
      status: "mastered",
      nextReviewAt: new Date(yesterday.getTime() + i * 1000),
    }),
  );
  assert.deepEqual(
    selectDailyPractice(rows.reverse(), now).ids,
    [12, 11, 10, 9, 8, 7, 6, 5, 4, 3],
  );
  const tied = [
    candidate(3, { status: "fuzzy", nextReviewAt: now }),
    candidate(4, { status: "unknown", nextReviewAt: now }),
    candidate(1, { status: "unknown", nextReviewAt: now }),
    candidate(2, { status: "mastered", nextReviewAt: now }),
  ];
  assert.deepEqual(selectDailyPractice(tied, now).ids, [1, 4, 3, 2]);
});

test("weak order uses latest formal completion instead of mere status edits", () => {
  const rows = [
    candidate(4, { status: "fuzzy", lastPracticeAt: new Date("2026-09-01") }),
    candidate(3, { status: "unknown", lastPracticeAt: yesterday }),
    candidate(2, { status: "unknown", lastPracticeAt: new Date("2026-09-01") }),
    candidate(1, { status: "unknown", lastPracticeAt: new Date("2026-09-01") }),
  ];
  assert.deepEqual(selectDailyPractice(rows, now).ids, [1, 2, 3, 4]);
});

test("null review schedule is not due; status-only core stays new; ordinary never-practiced is not weak", () => {
  const daily = selectDailyPractice(
    [
      candidate(1, { status: "unknown" }),
      core(1, { status: "mastered" }),
      core(0, { status: "unknown" }),
    ],
    now,
  );
  assert.deepEqual(daily.ids, [100, 101]);
  assert.deepEqual(daily.counts, { due: 0, weak: 0, core: 2 });
  assert.deepEqual(daily.coreProgress, {
    completed: 0,
    total: 2,
    currentCategory: "LLM",
  });
});

test("today exclusion applies to all sources and retired questions never enter progress or queue", () => {
  const rows = [
    core(0, { active: false }),
    core(1, {
      completedToday: true,
      lastPracticeAt: now,
      status: "unknown",
      nextReviewAt: yesterday,
    }),
    core(5),
    candidate(1, {
      completedToday: true,
      status: "mastered",
      nextReviewAt: yesterday,
    }),
  ];
  const daily = selectDailyPractice(rows, now);
  assert.deepEqual(daily.ids, [105]);
  assert.equal(daily.excludedToday, 2);
  assert.deepEqual(daily.coreProgress, {
    completed: 1,
    total: 2,
    currentCategory: "Python",
  });
});

test("three candidates and empty/all-practiced/disabled-topic states keep actual sizes and honest progress", () => {
  assert.equal(
    selectDailyPractice([core(2), core(1), core(0)], now).ids.length,
    3,
  );
  assert.deepEqual(selectDailyPractice([], now).coreProgress, {
    completed: 0,
    total: 0,
    currentCategory: null,
  });
  const done = selectDailyPractice(
    corePath.map((_, i) =>
      core(i, { status: "mastered", lastPracticeAt: yesterday }),
    ),
    now,
  );
  assert.equal(done.ids.length, 0);
  assert.deepEqual(done.coreProgress, {
    completed: 30,
    total: 30,
    currentCategory: null,
  });
  const noLlm = selectDailyPractice(
    corePath.map((_, i) => core(i, { active: corePath[i].category !== "LLM" })),
    now,
  );
  assert.equal(noLlm.coreProgress.total, 25);
  assert.equal(noLlm.coreProgress.currentCategory, "Python");
  assert.deepEqual(
    noLlm.ids,
    [105, 106, 107, 108, 109, 110, 111, 112, 113, 114],
  );
});

test("Beijing day uses inclusive midnight and exclusive next midnight independent of host timezone", () => {
  const before = beijingDayBounds(new Date("2026-10-07T15:59:59.999Z"));
  const after = beijingDayBounds(new Date("2026-10-07T16:00:00Z"));
  assert.equal(before.start.toISOString(), "2026-10-06T16:00:00.000Z");
  assert.equal(before.end.toISOString(), "2026-10-07T16:00:00.000Z");
  assert.equal(after.start.toISOString(), before.end.toISOString());
  assert.equal(after.end.toISOString(), "2026-10-08T16:00:00.000Z");
});
