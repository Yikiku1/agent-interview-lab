import assert from "node:assert/strict";
import { test } from "node:test";
import { reviewDateLabel, scheduleReview } from "../../src/lib/review-schedule";

const completedAt = new Date("2026-10-04T02:00:00Z");
const DAY = 86400000;

test("consecutive mastered completions use 1, 3, 7, 14 days and cap the stage", () => {
  let stage = 0;
  for (const days of [1, 3, 7, 14, 14, 14]) {
    const schedule = scheduleReview("mastered", stage, completedAt);
    assert.equal(
      schedule.nextReviewAt.getTime() - completedAt.getTime(),
      days * DAY,
    );
    stage = schedule.reviewStage;
  }
  assert.equal(stage, 4);
  assert.equal(completedAt.toISOString(), "2026-10-04T02:00:00.000Z");
});

test("unknown and fuzzy reset the streak and schedule short review intervals", () => {
  for (const [status, days] of [
    ["unknown", 1],
    ["fuzzy", 3],
  ] as const) {
    const schedule = scheduleReview(status, 4, completedAt);
    assert.equal(schedule.reviewStage, 0);
    assert.equal(
      schedule.nextReviewAt.getTime() - completedAt.getTime(),
      days * DAY,
    );
    assert.equal(
      scheduleReview("mastered", schedule.reviewStage, completedAt).reviewStage,
      1,
    );
  }
});

test("review labels use Shanghai time across a UTC date boundary", () => {
  const label = reviewDateLabel("2026-10-04T17:30:00Z");
  assert.match(label, /10(?:月|\/)5/);
  assert.match(label, /01:30/);
});
