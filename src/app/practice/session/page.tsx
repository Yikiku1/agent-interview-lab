import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { getRequestTime } from "@/lib/request-time";
import { PracticeSession } from "@/components/practice/practice-session";
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
  roundLocation,
  roundSize,
  sessionIndex,
  type PracticeMode,
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
  const requestedMode = get("mode");
  const mode: PracticeMode =
    requestedMode === "random" ||
    requestedMode === "weak" ||
    requestedMode === "due"
      ? requestedMode
      : "sequential";
  const savedQueue = parseQueueIds(get("queue"));
  const queue =
    savedQueue ??
    (await getPracticeSelection(
      parseFilters(params),
      mode,
      roundSize(get("size")),
      get("seed") ?? "7919",
      get("includeFuzzy") === "1",
    ));
  const rows = orderSavedQueue(await getQuestionsByIds(queue), queue);
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
          title={mode === "due" ? "暂时没有到期题目" : "当前条件下没有题目"}
          description={
            mode === "due"
              ? "可以先练新题，或查看全部薄弱题。"
              : "调整分类、难度或状态后再试。"
          }
        >
          <Button asChild>
            <Link href={mode === "due" ? "/review?view=weak" : "/practice"}>
              调整练习范围
            </Link>
          </Button>
        </Empty>
      </div>
    );
  const roundId = parseRoundId(get("round"));
  if (!roundId || !savedQueue) {
    const url = new URL("http://localhost/practice/session");
    for (const [name, value] of Object.entries(params))
      if (typeof value === "string") url.searchParams.set(name, value);
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
  return (
    <PracticeSession
      key={roundId}
      rows={rows}
      initialIndex={initialIndex}
      mode={mode}
      roundId={roundId}
      initialCompletions={completions}
      initialFinished={get("finished") === "1"}
      referenceTime={getRequestTime()}
    />
  );
}
