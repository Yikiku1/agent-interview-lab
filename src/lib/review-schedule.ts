import type { QuestionStatus } from "@/db/schema";

const MASTERED_DAYS = [1, 3, 7, 14] as const;
const DAY = 24 * 60 * 60 * 1000;

export function scheduleReview(
  status: QuestionStatus,
  previousStage: number,
  completedAt: Date,
) {
  const stage =
    status === "mastered" ? Math.min(4, Math.max(0, previousStage) + 1) : 0;
  const days =
    status === "unknown"
      ? 1
      : status === "fuzzy"
        ? 3
        : MASTERED_DAYS[stage - 1];
  return {
    reviewStage: stage,
    nextReviewAt: new Date(completedAt.getTime() + days * DAY),
  };
}

export function reviewDateLabel(value: string | Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
