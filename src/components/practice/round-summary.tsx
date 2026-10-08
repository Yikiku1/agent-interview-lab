import Link from "next/link";
import { ArrowRight, Check, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatsStrip } from "@/components/ui/stats-strip";
import { StatusBadge } from "@/components/question/status-badge";
import { DueLabel } from "@/components/question/due-label";
import { summarizeRound, type RoundCompletion } from "@/lib/practice-session";

export function RoundSummary({
  questions,
  completions,
  onResume,
  referenceTime,
}: {
  questions: { id: number; question: string }[];
  completions: Record<number, RoundCompletion>;
  onResume: (questionId: number) => void;
  referenceTime: number;
}) {
  const summary = summarizeRound(
    questions.map((row) => row.id),
    completions,
  );
  const weakHref = `/practice/session?mode=weak&queue=${summary.weakIds.join(",")}`;
  const remaining = summary.remainingIds.length > 0;
  return (
    <div className="reading-column page-stack">
      <div>
        <h1 id="round-summary-title" tabIndex={-1} className="page-title">
          本轮总结
        </h1>
        <p className="page-description">
          {remaining
            ? "已保存的练习都在这里。可以继续完成这一轮，也可以先巩固薄弱题。"
            : "这一轮已完成。对照本轮结果，安排下一步练习。"}
        </p>
      </div>
      <section className="panel round-result" aria-label="本轮结果">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-3 text-sm text-muted-foreground">本轮已完成</p>
            <p>
              <strong className="round-count">{summary.completed}</strong>
              <span className="ml-2 text-lg tabular-nums text-muted-foreground">
                / {summary.total} 题
              </span>
            </p>
          </div>
          <span
            className="flex size-12 items-center justify-center rounded-lg bg-accent-soft text-accent"
            aria-hidden="true"
          >
            <Check className="size-6" />
          </span>
        </div>
        <Progress
          value={(summary.completed / summary.total) * 100}
          label="本轮完成比例"
        />
        <div className="flex flex-wrap gap-3">
          {remaining ? (
            <Button onClick={() => onResume(summary.remainingIds[0])}>
              继续未完成题目
              <ArrowRight data-icon="inline-end" />
            </Button>
          ) : summary.weakIds.length > 0 ? (
            <Button asChild>
              <Link prefetch={false} href={weakHref}>
                <RotateCcw data-icon="inline-start" />
                再练本轮薄弱题
              </Link>
            </Button>
          ) : (
            <Button asChild>
              <Link href="/practice">
                开始新一轮
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          )}
          {remaining && summary.weakIds.length > 0 ? (
            <Button variant="secondary" asChild>
              <Link prefetch={false} href={weakHref}>
                再练本轮薄弱题
              </Link>
            </Button>
          ) : null}
          {remaining || summary.weakIds.length > 0 ? (
            <Button variant="secondary" asChild>
              <Link href="/practice">开始新一轮</Link>
            </Button>
          ) : null}
          <Button variant="ghost" asChild>
            <Link href="/review">查看复习安排</Link>
          </Button>
        </div>
        <p className="text-xs leading-6 text-muted-foreground">
          {summary.completed
            ? "回答与自评已保存，已完成的题目已安排下次复习。"
            : "本轮尚未完成题目，草稿会保留。"}
        </p>
      </section>
      <StatsStrip
        metrics={[
          { label: "掌握", value: summary.mastered, status: "mastered" },
          { label: "模糊", value: summary.fuzzy, status: "fuzzy" },
          { label: "不会", value: summary.unknown, status: "unknown" },
          { label: "未完成", value: summary.skipped },
        ]}
      />
      <section aria-labelledby="round-details-title">
        <div className="section-heading">
          <h2 id="round-details-title" className="section-title">
            逐题记录
          </h2>
          <span className="text-xs text-muted-foreground">
            本轮最后一次已保存的自评
          </span>
        </div>
        <ol className="panel overflow-hidden">
          {questions.map((question, index) => {
            const completed = completions[question.id];
            return (
              <li key={question.id} className="round-record">
                <span className="pt-0.5 text-xs tabular-nums text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <Link
                    href={`/questions/${question.id}#history`}
                    prefetch={false}
                    className="text-sm font-medium leading-7 hover:text-accent"
                  >
                    {question.question}
                  </Link>
                  {completed?.nextReviewAt ? (
                    <div className="mt-1">
                      <DueLabel
                        at={completed.nextReviewAt}
                        now={referenceTime}
                      />
                    </div>
                  ) : null}
                </div>
                <div className="pt-0.5">
                  {completed ? (
                    <StatusBadge status={completed.status} />
                  ) : (
                    <Badge>未完成</Badge>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
