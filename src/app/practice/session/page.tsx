import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { getRequestTime } from "@/lib/request-time";
import { getDailyPractice } from "@/lib/daily-practice-query";
import { getCoreLearningEntry } from "@/db/core-answers";
import { getResumeLearningEntry } from "@/db/resume-questions";
import { PracticeSession } from "@/components/practice/practice-session";
import { InvalidFilters } from "@/components/question/invalid-filters";
import { getLearningTarget } from "@/lib/learning-target";
import { roundSizeForMinutes, scopeForTarget } from "@/lib/learning-contract";
import {
  getPracticeSelection,
  getQuestionsByIds,
  getRoundCompletions,
  parseFilters,
} from "@/lib/questions";
import {
  orderSavedQueue,
  parseQueueIds,
  parseRoundId,
  parsePracticeMode,
  roundLocation,
  roundSize,
  sessionIndex,
} from "@/lib/practice-session";

export const dynamic = "force-dynamic";

export default async function PracticeSessionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const get = (name: string) =>
    typeof params[name] === "string" ? params[name] : undefined;
  const mode = parsePracticeMode(get("mode"));
  const referenceTime = getRequestTime();
  const savedQueue = parseQueueIds(get("queue"));
  let queue = savedQueue;
  if (!queue) {
    let filters;
    try {
      filters = parseFilters(params);
    } catch {
      return <InvalidFilters href="/practice" />;
    }
    let size = roundSize(get("size"));
    if (mode === "daily" && !Object.values(filters).some(Boolean)) {
      const target = await getLearningTarget();
      if (target) {
        filters = scopeForTarget(target);
        if (!get("size"))
          size = roundSizeForMinutes(target.dailyMinutes as 5 | 10 | 20 | 40);
      }
    }
    queue =
      mode === "daily"
        ? (await getDailyPractice(new Date(referenceTime), filters, size)).ids
        : await getPracticeSelection(
            filters,
            mode,
            size,
            get("seed") ?? "7919",
            get("includeFuzzy") === "1",
            new Date(referenceTime),
          );
  }
  const rows = orderSavedQueue(await getQuestionsByIds(queue), queue);
  const priorSkipped = Number(get("skipped") ?? 0);
  const skippedCount =
    queue.length -
    rows.length +
    (Number.isInteger(priorSkipped) && priorSkipped > 0 && priorSkipped <= 1000
      ? priorSkipped
      : 0);
  const initialIndex = sessionIndex(
    rows,
    Number(get("questionId")),
    queue,
    Number(get("index") ?? 0),
  );
  if (!rows.length)
    return (
      <div className="reading-column">
        <h1 className="page-title mb-6">练习</h1>
        <Empty
          title={
            savedQueue
              ? "本轮题目已停用"
              : mode === "daily"
                ? "暂无推荐题目"
                : mode === "due"
                  ? "暂时没有到期题目"
                  : "当前条件下没有题目"
          }
          description={
            savedQueue
              ? "当前队列已没有启用题目，可以手动选择或从首页开始新一轮。"
              : mode === "daily"
                ? "当前没有符合条件的推荐题目，今天已完成的题目会排除。也可以手动选择题目练习。"
                : mode === "due"
                  ? "可以先练新题，或查看全部薄弱题。"
                  : "调整分类、难度或状态后再试。"
          }
        >
          <Button asChild>
            <Link href={mode === "due" ? "/review?view=weak" : "/practice"}>
              调整练习范围
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/questions">浏览题库</Link>
          </Button>
        </Empty>
      </div>
    );
  const roundId = parseRoundId(get("round"));
  if (!roundId || !savedQueue) {
    const url = new URL("http://localhost/practice/session");
    for (const [name, value] of Object.entries(params))
      if (typeof value === "string") url.searchParams.set(name, value);
    if (skippedCount > 0) url.searchParams.set("skipped", String(skippedCount));
    redirect(
      roundLocation(
        url.href,
        roundId ?? randomUUID(),
        rows.map((row) => row.question.id),
        rows[initialIndex].question.id,
        get("finished") === "1",
      ),
    );
  }
  const completions = await getRoundCompletions(
    roundId,
    rows.map((row) => row.question.id),
  );
  const resumeEntries = Object.fromEntries(
    rows.flatMap(({ question }) => {
      const entry = getResumeLearningEntry(question);
      return entry ? [[question.id, entry]] : [];
    }),
  );
  return (
    <PracticeSession
      key={roundId}
      rows={rows.map((row) =>
        resumeEntries[row.question.id]
          ? { ...row, question: { ...row.question, answer: "" } }
          : row,
      )}
      resumeEntries={resumeEntries}
      learningEntries={Object.fromEntries(
        rows.flatMap(({ question }) => {
          const entry = getCoreLearningEntry(
            question.question,
            question.category,
          );
          return entry ? [[question.id, entry]] : [];
        }),
      )}
      skippedCount={skippedCount}
      initialIndex={initialIndex}
      mode={mode}
      roundId={roundId}
      initialCompletions={completions}
      initialFinished={get("finished") === "1"}
      referenceTime={referenceTime}
    />
  );
}
