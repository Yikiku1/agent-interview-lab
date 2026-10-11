import assert from "node:assert/strict";
import { test } from "node:test";
import {
  selectDailyPractice,
  type DailyCandidate,
} from "../../src/lib/daily-practice";
import { parseFilters } from "../../src/lib/question-filters";
import { filtersQuery } from "../../src/lib/learning-options";
import {
  roundSize,
  parseQueueIds,
  roundLocation,
} from "../../src/lib/practice-session";

test("new scope filters preserve legacy filters and serialize without losing metadata or escaped search", () => {
  const filters = parseFilters({
    category: "Agent",
    difficulty: "medium",
    search: " a&b ",
    project: "VendorGuard",
    resumePriority: "P0",
    resumeKind: "简历实战",
  });
  assert.equal(filters.track, "resume");
  assert.equal(filters.search, "a&b");
  assert.deepEqual(
    parseFilters(Object.fromEntries(filtersQuery(filters))),
    filters,
  );
  assert.throws(() =>
    parseFilters({ preset: ["resume_focus", "general_core"] }),
  );
  assert.throws(() =>
    parseFilters({ preset: "foundation_fill", project: "VendorGuard" }),
  );
  assert.throws(() => parseFilters({ track: "unknown" }));
  assert.equal(
    parseFilters({ category: "old-invalid-category", size: "3" }).category,
    undefined,
  );
});

test("3/5/10/20 sizes retain fixed queues and existing round URLs", () => {
  for (const size of [3, 5, 10, 20])
    assert.equal(roundSize(String(size)), size);
  assert.equal(roundSize("4"), 10);
  const url = roundLocation(
    "/practice/session?size=3&preset=foundation_fill",
    "76b3c64b-07d9-41b2-aaba-e08a91de1b10",
    [9, 8, 7, 6, 5],
    7,
  );
  const params = new URL(url, "http://localhost").searchParams;
  assert.deepEqual(parseQueueIds(params.get("queue")!), [9, 8, 7, 6, 5]);
  assert.equal(params.get("questionId"), "7");
});

test("resume path fills short rounds by priority, project, ID after due and formal weak, excluding today and malformed metadata", () => {
  const now = new Date("2026-10-10T02:00:00Z");
  const yesterday = new Date("2026-10-09T02:00:00Z");
  const row = (
    id: number,
    priority = "P0",
    project = "VendorGuard",
    overrides: Partial<DailyCandidate> = {},
  ): DailyCandidate => ({
    id,
    question: "title does not identify scope",
    category: "Agent",
    active: true,
    status: null,
    nextReviewAt: null,
    lastPracticeAt: null,
    completedToday: false,
    tags: ["简历专项", priority, project, "简历实战"],
    subcategory: `简历专项 · ${project}`,
    ...overrides,
  });
  const rows = [
    row(1, "P1"),
    row(5, "P0", "发票实习"),
    row(4),
    row(3),
    row(10, "P2", "VendorGuard", {
      nextReviewAt: yesterday,
      status: "mastered",
      lastPracticeAt: yesterday,
    }),
    row(11, "P2", "VendorGuard", {
      status: "unknown",
      lastPracticeAt: yesterday,
    }),
    row(2, "P0", "VendorGuard", { completedToday: true }),
    row(12, "P0", "VendorGuard", {
      tags: ["简历专项", "P0", "P1", "VendorGuard", "简历实战"],
    }),
  ];
  const three = selectDailyPractice(rows, now, { size: 3, resumePath: true });
  assert.deepEqual(three.ids, [10, 11, 3]);
  assert.deepEqual(three.counts, { due: 1, weak: 1, core: 0, path: 1 });
  assert.deepEqual(
    selectDailyPractice(rows, now, { size: 5, resumePath: true }).ids,
    [10, 11, 3, 4, 5],
  );
  assert.deepEqual(
    selectDailyPractice(rows, now, { size: 20, resumePath: true }).ids,
    [10, 11, 3, 4, 5, 1],
  );
  assert.equal(three.excludedToday, 1);
  assert.equal(
    selectDailyPractice([], now, { size: 3, resumePath: true }).ids.length,
    0,
  );
});
