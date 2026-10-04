import Link from "next/link";
import { ArrowRight, BookOpen, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContinueButton } from "@/components/practice/continue-button";
import { getDashboard } from "@/lib/questions";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const stats = await getDashboard();
  const metrics = [
    { label: "今日刷题", value: stats.todayReviews, detail: "次练习" },
    { label: "总刷题", value: stats.totalReviews, detail: "次练习" },
    { label: "已掌握", value: stats.mastered, detail: "道题" },
    { label: "模糊", value: stats.fuzzy, detail: "道题" },
    { label: "不会", value: stats.unknown, detail: "道题" },
  ];
  return (
    <div className="space-y-9">
      <div className="flex flex-wrap items-end justify-between gap-5 border-b border-border pb-7">
        <div>
          <p className="mb-2 font-mono text-xs font-medium uppercase text-accent">
            Interview workspace
          </p>
          <h1 className="text-2xl font-semibold sm:text-3xl">面试训练台</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
            专注 Agent 开发与 LLM 应用开发面试。选一组题目，思考、核对答案，再记录掌握程度。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/practice">
              <BookOpen className="size-4" />
              开始刷题
            </Link>
          </Button>
          <ContinueButton />
        </div>
      </div>

      <section aria-labelledby="overview-title">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 id="overview-title" className="text-base font-semibold">
            练习概览
          </h2>
          <Link href="/stats" className="text-sm text-accent hover:underline">
            查看统计 <ArrowRight className="inline size-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-md border border-border bg-surface p-4 sm:p-5"
            >
              <p className="text-xs text-muted-foreground">{metric.label}</p>
              <p className="mt-3 text-2xl font-semibold tabular-nums">
                {metric.value}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {metric.detail}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="categories-title">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 id="categories-title" className="text-base font-semibold">
            分类进度
          </h2>
          <span className="text-xs text-muted-foreground">
            掌握率 = 已掌握 / 已标记
          </span>
        </div>
        <div className="grid gap-x-8 gap-y-1 md:grid-cols-2">
          {stats.byCategory.map((item) => (
            <Link
              key={item.category}
              href={`/questions?category=${encodeURIComponent(item.category)}`}
              className="group flex items-center gap-4 border-b border-border py-4 hover:text-accent"
            >
              <span className="w-20 shrink-0 text-sm font-medium">
                {item.category}
              </span>
              <div className="min-w-0 flex-1">
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${item.rate}%` }}
                  />
                </div>
              </div>
              <span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {item.marked}/{item.total} 已刷
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground group-hover:text-accent" />
            </Link>
          ))}
        </div>
      </section>

      {stats.unknown + stats.fuzzy > 0 && (
        <section className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">
              {stats.unknown + stats.fuzzy} 道
            </strong>
            薄弱题目等待复习
          </p>
          <Button variant="secondary" asChild>
            <Link href="/review">
              <RotateCcw className="size-4" />
              进入复习
            </Link>
          </Button>
        </section>
      )}
    </div>
  );
}
