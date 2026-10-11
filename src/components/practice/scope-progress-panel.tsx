import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { Pagination } from "@/components/ui/pagination";
import { Progress } from "@/components/ui/progress";
import { StatsStrip } from "@/components/ui/stats-strip";
import { QuestionFilters } from "@/components/question/question-filters";
import { StatusBadge } from "@/components/question/status-badge";
import { filtersQuery } from "@/lib/learning-options";
import { gapLabels } from "@/lib/practice-notes-contract";
import { scopeProgressLabel } from "@/lib/scope-progress-contract";
import type { getScopeProgress } from "@/lib/scope-progress";

export function ScopeProgressPanel({
  progress,
}: {
  progress: Awaited<ReturnType<typeof getScopeProgress>>;
}) {
  const query = filtersQuery(progress.filters);
  const percent =
    progress.coverage === null
      ? null
      : Math.floor(progress.coverage * 1000) / 10;
  const pageHref = (page: number) => {
    const params = progress.usesTarget
      ? new URLSearchParams()
      : filtersQuery(progress.filters);
    if (!progress.usesTarget) params.set("scope", "custom");
    params.set("page", String(page));
    return `/stats?${params}#unpracticed`;
  };
  return (
    <section
      aria-labelledby="scope-progress-title"
      className="flex flex-col gap-5"
    >
      <div className="section-heading mb-0">
        <div>
          <h2 id="scope-progress-title" className="section-title">
            {progress.usesTarget ? "当前目标进度" : "所选范围进度"}
          </h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            {scopeProgressLabel(progress.filters)} · 只统计启用题
            {progress.usesTarget && !progress.target ? " · 尚未配置目标" : ""}
          </p>
        </div>
        <Button variant="secondary" asChild>
          <Link href="/learning-target">调整训练目标</Link>
        </Button>
      </div>
      <details className="panel panel-padding">
        <summary className="cursor-pointer text-sm font-medium min-h-11 leading-7">
          查看其他范围的进度
        </summary>
        <div className="mt-4">
          <p className="mb-3 text-sm text-muted-foreground">
            筛选只改变这次查看的范围。保存训练目标后，重新打开统计页会使用新目标。
          </p>
          <QuestionFilters
            key={query.toString()}
            filters={progress.filters}
            action="/stats"
            hiddenFields={{ scope: "custom" }}
            resetHref="/stats"
            resetLabel="恢复当前目标"
          />
          <Link className="subtle-link mt-3" href="/stats">
            查看当前目标进度
          </Link>
        </div>
      </details>
      <div className="panel panel-padding flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="font-medium">正式练习覆盖</h3>
          <p className="text-sm tabular-nums" data-testid="scope-coverage">
            {progress.total
              ? `${progress.covered} / ${progress.total} 题 · ${percent}%`
              : "当前范围没有题目"}
          </p>
        </div>
        {percent !== null ? (
          <Progress value={percent} label="当前范围正式练习覆盖率" />
        ) : null}
        <p className="text-xs leading-6 text-muted-foreground">
          点击“完成本题”并保存后计入；重复完成同一题仍只覆盖一道题。
        </p>
      </div>
      <div data-testid="scope-metrics">
        <StatsStrip
          metrics={[
            { label: "范围题数", value: progress.total },
            { label: "正式练过", value: progress.covered },
            { label: "未正式练过", value: progress.unpracticed.total },
            { label: "个人回答卡", value: progress.cards },
            { label: "证据已填写", value: progress.evidenceFilled },
            { label: "未解决卡点", value: progress.openGaps },
          ]}
        />
      </div>
      <p className="text-xs leading-6 text-muted-foreground">
        证据已填写表示本人在卡片中填了证据文字，仍需自行核实与准备。
      </p>
      <div>
        <h3 className="mb-3 text-sm font-medium">当前范围 · 本人自评</h3>
        <div data-testid="scope-self-assessment">
          <StatsStrip
            metrics={[
              { label: "掌握", value: progress.mastered, status: "mastered" },
              { label: "模糊", value: progress.fuzzy, status: "fuzzy" },
              { label: "不会", value: progress.unknown, status: "unknown" },
              { label: "未标记", value: progress.unmarked },
            ]}
          />
        </div>
        <p className="mt-2 text-xs leading-6 text-muted-foreground">
          自评反映当前掌握状态；查看答案、标记状态、保存卡片或自查都不计入正式覆盖。
        </p>
      </div>
      <section aria-labelledby="scope-gaps-title">
        <div className="section-heading">
          <h3 id="scope-gaps-title" className="section-title">
            范围内未解决卡点
          </h3>
          <Link className="subtle-link" href={`/practice-gaps?${query}`}>
            查看卡点与补练
          </Link>
        </div>
        {progress.openGaps ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {progress.gaps.map((gap) => (
              <div className="panel p-4" key={gap.kind}>
                <p className="text-sm">
                  {gapLabels[gap.kind]}{" "}
                  <strong className="ml-2 tabular-nums">{gap.total}</strong>
                </p>
                {gap.total ? (
                  <Link
                    className="subtle-link mt-3 min-h-11 text-sm"
                    href={`/practice-gaps?${query}&kind=${gap.kind}`}
                  >
                    查看并补练
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="当前范围没有未解决卡点"
            description="对照答案时记录具体卡点，下一轮可按卡点定向补练。"
          />
        )}
      </section>
      <section
        id="unpracticed"
        aria-labelledby="unpracticed-title"
        className="scroll-mt-6 flex flex-col gap-4"
      >
        <div className="section-heading mb-0">
          <h3 id="unpracticed-title" className="section-title">
            未正式练过的题目
          </h3>
          <span className="text-xs text-muted-foreground">
            {progress.unpracticed.total} 道 · 按题目顺序
          </span>
        </div>
        {progress.unpracticed.rows.length ? (
          <>
            <div className="flex flex-wrap gap-3">
              {([3, 5] as const).map((size) => (
                <Button
                  key={size}
                  variant={size === 3 ? "default" : "secondary"}
                  asChild
                >
                  <Link
                    prefetch={false}
                    href={`/practice/session?mode=sequential&size=${size}&queue=${progress.unpracticed.rows
                      .slice(0, size)
                      .map((row) => row.id)
                      .join(",")}`}
                  >
                    练习本页未练{" "}
                    {Math.min(size, progress.unpracticed.rows.length)} 题
                    {progress.unpracticed.rows.length < 3 && size === 5
                      ? "（5 题档）"
                      : ""}
                  </Link>
                </Button>
              ))}
            </div>
            <ul className="panel" data-testid="unpracticed-list">
              {progress.unpracticed.rows.map((question) => (
                <li
                  key={question.id}
                  className="border-b border-border last:border-0"
                >
                  <Link
                    href={`/questions/${question.id}`}
                    className="flex min-h-20 items-center justify-between gap-4 px-5 py-4"
                  >
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium leading-7">
                        {question.question}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {question.category} / {question.subcategory}
                      </p>
                    </div>
                    <StatusBadge status={question.status} />
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination
              page={progress.unpracticed.page}
              pages={progress.unpracticed.pages}
              href={pageHref}
              label="未练题分页"
            />
          </>
        ) : (
          <Empty
            title={
              progress.total ? "当前范围题目均已正式练过" : "当前范围没有题目"
            }
            description={
              progress.total
                ? "可以根据自评、卡点或复习安排继续巩固。"
                : "调整范围条件后继续查看。"
            }
          />
        )}
      </section>
    </section>
  );
}
