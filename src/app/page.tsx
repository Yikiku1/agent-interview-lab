import Link from "next/link";
import { ArrowRight, BookOpen, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatsStrip } from "@/components/ui/stats-strip";
import { ContinueButton } from "@/components/practice/continue-button";
import { CategoryProgress } from "@/components/question/category-progress";
import { getDashboard } from "@/lib/questions";
import { getDailyPractice } from "@/lib/daily-practice-query";
import { getRequestTime } from "@/lib/request-time";
import { Progress } from "@/components/ui/progress";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [stats, daily] = await Promise.all([
    getDashboard(),
    getDailyPractice(new Date(getRequestTime())),
  ]);
  const dailyHref = `/practice/session?mode=daily&queue=${daily.ids.join(",")}`;
  return (
    <div className="page-stack">
      <section className="panel home-focus" aria-labelledby="home-title">
        <div>
          <h1 id="home-title" className="page-title">
            今日推荐练习
          </h1>
          <p className="page-description">
            {daily.ids.length
              ? `${daily.ids.length} 题 · 到期复习 ${daily.counts.due} · 薄弱巩固 ${daily.counts.weak} · 核心新题 ${daily.counts.core}`
              : "暂无推荐题目"}
          </p>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            {daily.ids.length
              ? `本轮主题：${daily.themes.join("、")}。先独立回答，再对照要点。`
              : "当前没有符合条件的到期、薄弱或核心新题，可以手动选择题目练习。"}
            {daily.excludedToday > 0 ? "今天已完成的题目已排除。" : ""}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {daily.ids.length ? (
              <Button asChild>
                <Link href={dailyHref} prefetch={false}>
                  <BookOpen data-icon="inline-start" />
                  开始推荐练习
                </Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/practice">手动选择练习</Link>
              </Button>
            )}
            <ContinueButton />
            <Button variant="ghost" asChild>
              <Link href={daily.ids.length ? "/practice" : "/questions"}>
                {daily.ids.length ? "手动设置" : "浏览题库"}
              </Link>
            </Button>
          </div>
        </div>
        <div className="home-review">
          <div>
            <h2 className="text-sm font-medium">核心训练路径</h2>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">
              核心题已练 {daily.coreProgress.completed} /{" "}
              {daily.coreProgress.total}
            </p>
            <div className="mt-3">
              <Progress
                value={
                  daily.coreProgress.total
                    ? (daily.coreProgress.completed /
                        daily.coreProgress.total) *
                      100
                    : 0
                }
                label="核心题练习覆盖率"
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {daily.coreProgress.currentCategory
                ? `当前主题：${daily.coreProgress.currentCategory}`
                : daily.coreProgress.total
                  ? "启用核心题均已练过"
                  : "暂无启用核心题"}
            </p>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              LLM → Python → 后端 → 数据库 → RAG → LLM 应用工程 → Agent
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
