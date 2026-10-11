import { corePath } from "@/db/core-path";
import type { QuestionStatus } from "@/db/schema";
import {
  resumeMetadata,
  projectScopes,
  resumePriorities,
  type LearningRoundSize,
} from "@/lib/learning-contract";

export type DailyCandidate = {
  id: number;
  question: string;
  category: string;
  active: boolean;
  status: QuestionStatus | null;
  nextReviewAt: Date | null;
  lastPracticeAt: Date | null;
  completedToday: boolean;
  tags?: readonly string[];
  subcategory?: string;
};
export type DailySource = "due" | "weak" | "core" | "path";

const DAY_MS = 24 * 60 * 60 * 1000;
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;
const statusRank = { unknown: 0, fuzzy: 1, mastered: 2 };
const coreOrder = new Map<string, { category: string; index: number }>(
  corePath.map((entry, index) => [
    entry.question,
    { category: entry.category, index },
  ]),
);

export function beijingDayBounds(now: Date) {
  const start = new Date(
    Math.floor((now.getTime() + BEIJING_OFFSET_MS) / DAY_MS) * DAY_MS -
      BEIJING_OFFSET_MS,
  );
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

function pathIndex(row: DailyCandidate) {
  const entry = coreOrder.get(row.question);
  return entry?.category === row.category ? entry.index : undefined;
}

// Pure selection: only formal practice events supply lastPracticeAt/completedToday.
export function selectDailyPractice(
  candidates: readonly DailyCandidate[],
  now: Date,
  options: { size?: LearningRoundSize; resumePath?: boolean } = {},
) {
  const size = options.size ?? 10;
  const active = [
    ...new Map(
      candidates.filter((row) => row.active).map((row) => [row.id, row]),
    ).values(),
  ];
  const available = active.filter((row) => !row.completedToday);
  const core = active
    .filter((row) => pathIndex(row) !== undefined)
    .sort((a, b) => pathIndex(a)! - pathIndex(b)!);
  const newCore = core.filter((row) => row.lastPracticeAt === null);
  const queue: { id: number; source: DailySource; category: string }[] = [];
  const selected = new Set<number>();
  const counts: { due: number; weak: number; core: number; path?: number } = {
    due: 0,
    weak: 0,
    core: 0,
    ...(options.resumePath ? { path: 0 } : {}),
  };
  function append(rows: DailyCandidate[], source: DailySource) {
    for (const row of rows) {
      if (queue.length === size) break;
      if (selected.has(row.id)) continue;
      selected.add(row.id);
      queue.push({ id: row.id, source, category: row.category });
      counts[source] = (counts[source] ?? 0) + 1;
    }
  }
  append(
    available
      .filter((row) => row.nextReviewAt !== null && row.nextReviewAt <= now)
      .sort(
        (a, b) =>
          a.nextReviewAt!.getTime() - b.nextReviewAt!.getTime() ||
          statusRank[a.status ?? "mastered"] -
            statusRank[b.status ?? "mastered"] ||
          a.id - b.id,
      ),
    "due",
  );
  append(
    available
      .filter(
        (row) =>
          row.lastPracticeAt !== null &&
          (row.status === "unknown" || row.status === "fuzzy"),
      )
      .sort(
        (a, b) =>
          statusRank[a.status!] - statusRank[b.status!] ||
          a.lastPracticeAt!.getTime() - b.lastPracticeAt!.getTime() ||
          a.id - b.id,
      ),
    "weak",
  );
  if (options.resumePath) {
    const path = available
      .flatMap((row) => {
        const metadata = resumeMetadata({
          tags: row.tags ?? [],
          subcategory: row.subcategory ?? "",
        });
        return metadata && row.lastPracticeAt === null
          ? [{ row, metadata }]
          : [];
      })
      .sort(
        (a, b) =>
          resumePriorities.indexOf(a.metadata.priority) -
            resumePriorities.indexOf(b.metadata.priority) ||
          projectScopes.indexOf(a.metadata.project) -
            projectScopes.indexOf(b.metadata.project) ||
          a.row.id - b.row.id,
      );
    append(
      path.map((item) => item.row),
      "path",
    );
  } else {
    append(
      newCore.filter((row) => !row.completedToday),
      "core",
    );
  }
  return {
    queue,
    ids: queue.map((row) => row.id),
    counts,
    themes: [...new Set(queue.map((row) => row.category))],
    coreProgress: {
      completed: core.length - newCore.length,
      total: core.length,
      currentCategory: newCore[0]?.category ?? null,
    },
    excludedToday: active.filter((row) => row.completedToday).length,
  };
}
