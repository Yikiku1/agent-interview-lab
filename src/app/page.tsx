import Link from "next/link";
import { ArrowRight, BookOpen, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatsStrip } from "@/components/ui/stats-strip";
import { ContinueButton } from "@/components/practice/continue-button";
import { CategoryProgress } from "@/components/question/category-progress";
import { getDashboard } from "@/lib/questions";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const stats = await getDashboard();
  return (
    <div className="page-stack">
      <section className="panel home-focus" aria-labelledby="home-title">
        <div>
          <h1 id="home-title" className="page-title">
            开始今天的练习
          </h1>
          <p className="page-description">
            专注 Agent 与 LLM
            应用开发面试。先用自己的话回答，再对照答案，逐步补齐薄弱环节。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/practice">
                <BookOpen data-icon="inline-start" />
                开始练习
              </Link>
            </Button>
            <ContinueButton />
          </div>
        </div>
        <div className="home-review">
          <div>
            <h2 className="text-sm font-medium">到期复习</h2>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">
              {stats.dueReviews ? (
                <>
                  <strong className="text-lg font-semibold tabular-nums text-foreground">
                    {stats.dueReviews}
                  </strong>{" "}
                  道题等待复习
                </>
              ) : (
                "今天的复习已跟上进度"
              )}
            </p>
          </div>
          <Link
            href={stats.dueReviews ? "/practice/session?mode=due" : "/review"}
            prefetch={false}
            className="subtle-link min-h-11"
          >
            {stats.dueReviews ? "开始到期复习" : "查看复习安排"}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
      <section aria-labelledby="overview-title">
        <div className="section-heading">
          <h2 id="overview-title" className="section-title">
            练习概览
          </h2>
          <Link href="/stats" className="subtle-link">
            查看统计
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
        <StatsStrip
          metrics={[
            { label: "今日练习", value: stats.todayReviews, unit: "次" },
            { label: "累计练习", value: stats.totalReviews, unit: "次" },
            {
              label: "已掌握",
              value: stats.mastered,
              unit: "题",
              status: "mastered",
            },
            { label: "待巩固", value: stats.fuzzy + stats.unknown, unit: "题" },
          ]}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            模糊 {stats.fuzzy} · 不会 {stats.unknown}
          </span>
          {stats.fuzzy + stats.unknown > 0 ? (
            <Link href="/review?view=weak" className="subtle-link">
              <RotateCcw className="size-3.5" aria-hidden="true" />
              练习薄弱题
            </Link>
          ) : (
            <span>完成练习后会自动安排下次复习</span>
          )}
        </div>
      </section>
      <section aria-labelledby="categories-title">
        <div className="section-heading">
          <h2 id="categories-title" className="section-title">
            分类进度
          </h2>
          <span className="text-xs text-muted-foreground">
            掌握率 = 已掌握 / 已标记
          </span>
        </div>
        <CategoryProgress categories={stats.byCategory} />
      </section>
    </div>
  );
}
