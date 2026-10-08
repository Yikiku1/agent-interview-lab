import assert from "node:assert/strict";
import { test } from "node:test";
import {
  orderSavedQueue,
  parseQueueIds,
  resumeSessionUrl,
  sessionIndex,
  snapshotSession,
  parseRoundId,
  roundLocation,
  roundSize,
  summarizeRound,
} from "../../src/lib/practice-session";

const row = (id: number) => ({ question: { id } });

test("resume keeps the current question after earlier questions change mastery", () => {
  const saved = snapshotSession(
    "http://localhost/practice/session?mode=weak&index=1",
    [11, 22, 33],
    22,
  );
  const url = new URL(
    resumeSessionUrl(JSON.stringify(saved))!,
    "http://localhost",
  );
  const ids = parseQueueIds(url.searchParams.get("queue")!)!;
  // The database returns the fixed selection, including now-mastered question 11.
  const rows = orderSavedQueue([row(33), row(11), row(22)], ids);
  const index = sessionIndex(
    rows,
    Number(url.searchParams.get("questionId")),
    ids,
  );
  assert.deepEqual(
    rows.map((r) => r.question.id),
    [11, 22, 33],
  );
  assert.equal(rows[index].question.id, 22);
  assert.equal(url.searchParams.has("index"), false);
});

test("random order survives resume and retired items advance to the next survivor", () => {
  const ids = [33, 11, 22, 44];
  const rows = orderSavedQueue([row(44), row(22), row(33)], ids);
  assert.deepEqual(
    rows.map((r) => r.question.id),
    [33, 22, 44],
  );
  assert.equal(rows[sessionIndex(rows, 11, ids)].question.id, 22);
  assert.equal(sessionIndex([], 11, ids), 0);
});

test("invalid storage and queue input fall back without accepting unsafe IDs", () => {
  for (const input of [
    null,
    "{",
    "null",
    JSON.stringify({ url: "https://example.com", index: 1 }),
    JSON.stringify({
      url: "/practice/session?",
      version: 2,
      questionIds: [1],
      currentQuestionId: 2,
    }),
  ]) {
    assert.equal(resumeSessionUrl(input), null);
  }
  for (const input of [
    "0,1",
    "1,1",
    "-1",
    "1.5",
    "1,x",
    "2147483648",
    Array.from({ length: 1001 }, (_, i) => i + 1).join(","),
  ]) {
    assert.equal(parseQueueIds(input), undefined);
  }
});

test("legacy bookmarks still open and new snapshots remove old queue parameters", () => {
  const url = resumeSessionUrl(
    JSON.stringify({ url: "/practice/session?mode=random&seed=9", index: 7 }),
  );
  assert.equal(
    new URL(url!, "http://localhost").searchParams.get("index"),
    "7",
  );
  const saved = snapshotSession(
    "/practice/session?queue=1,2&questionId=1&index=5&mode=random&seed=9",
    [2, 1],
    2,
  );
  assert.equal(saved.url, "/practice/session?mode=random&seed=9");
});

test("round URLs and home bookmarks preserve the current position and summary", () => {
  const round = "7f5a4675-5aca-42f9-a033-2db1987b520f";
  const location = roundLocation(
    "/practice/session?mode=random&seed=42&index=0",
    round,
    [3, 1, 2],
    1,
    true,
  );
  const url = new URL(location, "http://localhost");
  assert.equal(parseRoundId(url.searchParams.get("round")!), round);
  assert.equal(url.searchParams.get("questionId"), "1");
  assert.equal(url.searchParams.has("index"), false);
  assert.equal(url.searchParams.get("finished"), "1");
  const resumed = new URL(
    resumeSessionUrl(JSON.stringify(snapshotSession(location, [3, 1, 2], 1)))!,
    "http://localhost",
  );
  assert.deepEqual(
    [...resumed.searchParams].sort(),
    [...url.searchParams].sort(),
  );
  assert.equal(
    new URL(
      roundLocation(location, round, [3, 1, 2], 2),
      "http://localhost",
    ).searchParams.has("finished"),
    false,
  );
  assert.equal(roundSize("20"), 20);
  assert.equal(roundSize("999"), 10);
  assert.equal(parseRoundId("bad"), undefined);
});

test("round summaries count saved completions once and ignore events outside the queue", () => {
  const completion = (
    questionId: number,
    status: "mastered" | "fuzzy" | "unknown",
  ) => ({
    questionId,
    status,
    answer: null,
    attemptId: "unused",
    nextReviewAt: null,
  });
  const summary = summarizeRound([3, 1, 2, 4], {
    1: completion(1, "mastered"),
    2: completion(2, "unknown"),
    3: completion(3, "fuzzy"),
    99: completion(99, "mastered"),
  });
  assert.deepEqual(summary, {
    total: 4,
    completed: 3,
    skipped: 1,
    mastered: 1,
    fuzzy: 1,
    unknown: 1,
    remainingIds: [4],
    weakIds: [3, 2],
  });
});
