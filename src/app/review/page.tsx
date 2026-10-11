import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { QuestionList } from "@/components/question/question-list";
import { getDueReviewQuestions, getReviewQuestions } from "@/lib/questions";
import { cn } from "@/lib/utils";
import { getRequestTime } from "@/lib/request-time";
import { getLearningTarget } from "@/lib/learning-target";
import { parseLearningScope, scopeForTarget } from "@/lib/learning-contract";
import { InvalidFilters } from "@/components/question/invalid-filters";

export const dynamic = "force-dynamic";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const weakView = params.view === "weak";
  const outsideView = params.view === "outside";
  let scope = {};
  if (outsideView) {
    try {
      scope = parseLearningScope(params);
    } catch {
      return <InvalidFilters href="/review" />;
    }
    if (!Object.values(scope).some(Boolean)) {
      const target = await getLearningTarget();
      if (target) scope = scopeForTarget(target);
    }
  }
  const [due, weak, outside] = await Promise.all([
    getDueReviewQuestions(),
    getReviewQuestions(),
    outsideView
      ? getDueReviewQuestions(new Date(getRequestTime()), scope, true)
      : Promise.resolve([]),
  ]);
  const rows = outsideView ? outside : weakView ? weak : due;
  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {outsideView ? "目标范围外的到期题" : "复习安排"}
          </h1>
          <p className="page-description">
            {outsideView
              ? "这些题不占目标推荐队列，可以在这里单独复习。"
              : weakView
                ? "先巩固不会的题目，再练模糊的知识点。"
                : "按到期时间巩固记忆，已掌握的题目也会按计划回来。"}
          </p>
        </div>
        {rows.length ? (
          <Button asChild>
            <Link
              prefetch={false}
              href={
                outsideView
                  ? `/practice/session?mode=due&queue=${outside
                      .slice(0, 10)
                      .map((row) => row.question.id)
                      .join(",")}`
                  : weakView
                    ? "/practice/session?mode=weak&includeFuzzy=1"
                    : "/practice/session?mode=due"
              }
            >
              <RotateCcw data-icon="inline-start" />
              开始{weakView ? "薄弱题" : "到期"}复习
            </Link>
          </Button>
        ) : null}
      </div>
      <nav aria-label="复习范围" className="segmented-control">
        {[
          {
            href: "/review",
            label: "到期复习",
            count: due.length,
            selected: !weakView && !outsideView,
          },
          ...(outsideView
            ? [
                {
                  href: "/review?view=outside",
                  label: "范围外到期",
                  count: outside.length,
                  selected: true,
                },
              ]
            : []),
          {
            href: "/review?view=weak",
            label: "全部薄弱题",
            count: weak.length,
            selected: weakView,
          },
        ].map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.selected ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center justify-center gap-2 rounded-sm px-4 text-sm text-muted-foreground transition-colors hover:bg-muted",
              tab.selected && "bg-surface font-medium text-accent",
            )}
          >
            <span>{tab.label}</span>
            <span className="tabular-nums">{tab.count}</span>
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <Empty
          title={weakView ? "暂无薄弱题目" : "暂时没有到期题目"}
          description={
            weakView
              ? "练习时选择不会或模糊，题目就会进入薄弱题列表。"
              : "复习进度已跟上。可以练习新题，或继续巩固薄弱知识点。"
          }
        >
          <Button asChild>
            <Link
              href={
                !weakView && weak.length ? "/review?view=weak" : "/practice"
              }
            >
              {!weakView && weak.length ? "练习薄弱题" : "开始练习"}
            </Link>
          </Button>
        </Empty>
      ) : (
        <QuestionList rows={rows} review now={getRequestTime()} />
      )}
      <div className="flex flex-col gap-1 text-xs leading-6 text-muted-foreground">
        <p>
          完成后安排下次复习：不会 1 天，模糊 3 天；连续掌握按 1 / 3 / 7 / 14
          天递增。
        </p>
        <p>
          时间均为北京时间。只调整掌握状态不会改变时间，尚无安排的题目需要先完成一次练习。
        </p>
      </div>
    </div>
  );
}
