import type { QuestionStatus } from "@/db/schema";

const MAX_QUEUE_SIZE = 1000;
const MAX_QUESTION_ID = 2147483647;

export type PracticeMode = "sequential" | "random" | "weak" | "due" | "daily";

export function parsePracticeMode(value: string | undefined): PracticeMode {
  return value === "random" ||
    value === "weak" ||
    value === "due" ||
    value === "daily"
    ? value
    : "sequential";
}
export type RoundCompletion = {
  questionId: number;
  status: QuestionStatus;
  answer: string | null;
  attemptId: string;
  nextReviewAt: string | null;
};

export function parseRoundId(value: string | undefined): string | undefined {
  return value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
    ? value
    : undefined;
}

export function roundSize(value: string | undefined): 10 | 20 {
  return value === "20" ? 20 : 10;
}

export function roundLocation(
  url: string,
  roundId: string,
  ids: number[],
  currentId: number,
  finished = false,
) {
  const parsed = new URL(url, "http://localhost");
  parsed.searchParams.delete("index");
  parsed.searchParams.set("round", roundId);
  parsed.searchParams.set("queue", ids.join(","));
  parsed.searchParams.set("questionId", String(currentId));
  if (finished) parsed.searchParams.set("finished", "1");
  else parsed.searchParams.delete("finished");
  return parsed.pathname + parsed.search;
}

export function summarizeRound(
  ids: number[],
  completions: Record<number, RoundCompletion>,
) {
  const completed = ids.flatMap((id) =>
    completions[id] ? [completions[id]] : [],
  );
  return {
    total: ids.length,
    completed: completed.length,
    skipped: ids.length - completed.length,
    mastered: completed.filter((item) => item.status === "mastered").length,
    fuzzy: completed.filter((item) => item.status === "fuzzy").length,
    unknown: completed.filter((item) => item.status === "unknown").length,
    remainingIds: ids.filter((id) => !completions[id]),
    weakIds: completed
      .filter((item) => item.status !== "mastered")
      .map((item) => item.questionId),
  };
}

function isQuestionId(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= MAX_QUESTION_ID
  );
}

export function parseQueueIds(value: string | undefined): number[] | undefined {
  if (!value || value.length > 11000 || !/^[1-9]\d*(,[1-9]\d*)*$/.test(value))
    return;
  const ids = value.split(",").map(Number);
  if (
    ids.length > MAX_QUEUE_SIZE ||
    !ids.every(isQuestionId) ||
    new Set(ids).size !== ids.length
  )
    return;
  return ids;
}

type Row = { question: { id: number } };

export function orderSavedQueue<T extends Row>(rows: T[], ids: number[]): T[] {
  const byId = new Map(rows.map((row) => [row.question.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
}

export function sessionIndex(
  rows: Row[],
  currentId: number | undefined,
  queue: number[] = [],
  legacyIndex = 0,
) {
  const current = rows.findIndex((row) => row.question.id === currentId);
  if (current >= 0) return current;
  // Retired questions are skipped to the next surviving item in the old queue.
  const oldIndex = currentId === undefined ? -1 : queue.indexOf(currentId);
  if (oldIndex >= 0) {
    const positions = new Map(
      rows.map((row, index) => [row.question.id, index]),
    );
    for (const id of queue.slice(oldIndex + 1)) {
      const index = positions.get(id);
      if (index !== undefined) return index;
    }
    return Math.max(0, rows.length - 1);
  }
  return Number.isInteger(legacyIndex)
    ? Math.max(0, Math.min(legacyIndex, rows.length - 1))
    : 0;
}

export function snapshotSession(
  url: string,
  questionIds: number[],
  currentQuestionId: number,
) {
  const parsed = new URL(url, "http://localhost");
  for (const key of ["index", "queue", "questionId"])
    parsed.searchParams.delete(key);
  return {
    version: 2,
    url: parsed.pathname + "?" + parsed.searchParams.toString(),
    questionIds,
    currentQuestionId,
  };
}

export function resumeSessionUrl(raw: string | null): string | null {
  try {
    const saved = JSON.parse(raw ?? "null");
    if (
      !saved ||
      typeof saved.url !== "string" ||
      !/^\/practice\/session(?:\?|$)/.test(saved.url)
    )
      return null;
    const url = new URL(saved.url, "http://localhost");
    if (saved.version === 2) {
      if (
        !Array.isArray(saved.questionIds) ||
        !saved.questionIds.every(isQuestionId)
      )
        return null;
      const ids = parseQueueIds(saved.questionIds.join(","));
      if (
        !ids ||
        !isQuestionId(saved.currentQuestionId) ||
        !ids.includes(saved.currentQuestionId)
      )
        return null;
      url.searchParams.delete("index");
      url.searchParams.set("queue", ids.join(","));
      url.searchParams.set("questionId", String(saved.currentQuestionId));
    } else if (Number.isInteger(saved.index) && saved.index >= 0) {
      // Read old bookmarks once; the next save upgrades them to version 2.
      url.searchParams.set("index", String(saved.index));
    } else return null;
    return url.pathname + url.search;
  } catch {
    return null;
  }
}
