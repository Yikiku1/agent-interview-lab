import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { LearningScopeFields } from "@/components/question/learning-scope-fields";
import { InvalidFilters } from "@/components/question/invalid-filters";
import { GapStateButton } from "@/components/practice/gap-state-button";
import { getPracticeGaps } from "@/lib/practice-notes";
import {
  gapLabels,
  gapQueue,
  parseGapQuery,
} from "@/lib/practice-notes-contract";
import { getLearningTarget } from "@/lib/learning-target";
import { scopeForTarget } from "@/lib/learning-contract";
import { filtersQuery } from "@/lib/learning-options";
export const dynamic = "force-dynamic";
export default async function PracticeGapsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await searchParams;
  let query;
  try {
    query = parseGapQuery(search);
  } catch {
    return <InvalidFilters href="/practice-gaps" />;
  }
  const [rows, target] = await Promise.all([
    getPracticeGaps(query.filters, query.kind, query.resolved),
    getLearningTarget(),
  ]);
  const ids = gapQueue(rows, 5);
  return (
    <div className="page-stack">
      <div>
        <h1 className="page-title">我的卡点</h1>
        <p className="page-description">
          按卡点安排下一轮补练。记录按创建时间排列，补练按题目去重；停用题的资料保留。
        </p>
      </div>
      <form
        action="/practice-gaps"
        className="panel panel-padding flex flex-col gap-4"
      >
        <LearningScopeFields initial={query.filters} prefix="gaps" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="field">
            <label className="field-label" htmlFor="gap-kind">
              卡点类型
            </label>
            <select
              id="gap-kind"
              className="control"
              name="kind"
              defaultValue={query.kind ?? ""}
            >
              <option value="">全部类型</option>
              {Object.entries(gapLabels).map(([kind, label]) => (
                <option key={kind} value={kind}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="gap-resolved">
              解决状态
            </label>
            <select
              id="gap-resolved"
              className="control"
              name="resolved"
              defaultValue={
                query.resolved === undefined ? "all" : String(query.resolved)
              }
            >
              <option value="false">未解决</option>
              <option value="true">已解决</option>
              <option value="all">全部状态</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="submit">筛选卡点</Button>
          <Button variant="ghost" asChild>
            <Link href="/practice-gaps">查看全部范围</Link>
          </Button>
          {target ? (
            <Button variant="secondary" asChild>
              <Link
                href={`/practice-gaps?${filtersQuery(scopeForTarget(target)).toString()}`}
              >
                使用当前训练目标范围
              </Link>
            </Button>
          ) : null}
        </div>
      </form>
      <section className="panel panel-padding flex flex-col gap-4">
        <h2 className="section-title">定向补练</h2>
        <p className="text-sm text-muted-foreground">
          当前 {rows.length} 条记录，
          {
            new Set(
              rows
                .filter((row) => row.question.active && !row.gap.resolvedAt)
                .map((row) => row.question.id),
            ).size
          }{" "}
          道启用题仍有未解决卡点。
        </p>
        <div className="flex flex-wrap gap-3">
          {ids.length ? (
            ([3, 5] as const).map((size) => (
              <Button
                variant={size === 3 ? "default" : "secondary"}
                asChild
                key={size}
              >
                <Link
                  prefetch={false}
                  href={`/practice/session?mode=weak&size=${size}&queue=${gapQueue(rows, size).join(",")}`}
                >
                  补练 {Math.min(size, ids.length)} 题
                  {ids.length < 3 && size === 5 ? "（5 题档）" : ""}
                </Link>
              </Button>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              当前筛选下没有可以补练的未解决卡点。
            </p>
          )}
        </div>
      </section>
      {rows.length ? (
        <div className="flex flex-col gap-3">
          {rows.map(({ gap, question, reviewEventId }) => (
            <article
              key={gap.id}
              className="panel panel-padding flex flex-col gap-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-medium">
                  {gapLabels[gap.kind]} · {gap.resolvedAt ? "已解决" : "未解决"}
                </span>
                <time className="text-xs text-muted-foreground">
                  {gap.createdAt.toLocaleString("zh-CN", {
                    timeZone: "Asia/Shanghai",
                    hour12: false,
                  })}
                </time>
              </div>
              <Link
                className="font-medium leading-7 hover:text-accent"
                href={`/questions/${question.id}`}
              >
                {question.question}
                {!question.active ? " · 已停用，补练跳过" : ""}
              </Link>
              {gap.note ? (
                <p className="whitespace-pre-wrap break-words text-sm leading-7">
                  {gap.note}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-4">
                <GapStateButton
                  id={gap.id}
                  resolved={Boolean(gap.resolvedAt)}
                />
                {reviewEventId ? (
                  <Link
                    className="subtle-link"
                    href={`/questions/${question.id}/history/${reviewEventId}`}
                  >
                    查看当次回答
                  </Link>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    独立记录
                  </span>
                )}
                <Link
                  className="subtle-link"
                  href={`/questions/${question.id}/answer-card`}
                >
                  我的回答卡
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="当前范围没有卡点"
          description="在题目详情或练习对照答案时，记录下次要补的内容。"
        />
      )}
    </div>
  );
}
