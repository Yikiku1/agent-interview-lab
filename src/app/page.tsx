import Link from "next/link";
import { ArrowRight, BookOpen, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatsStrip } from "@/components/ui/stats-strip";
import { ContinueButton } from "@/components/practice/continue-button";
import { CategoryProgress } from "@/components/question/category-progress";
import { getDashboard, getScopeCount } from "@/lib/questions";
import { getDailyPractice } from "@/lib/daily-practice-query";
import { getRequestTime } from "@/lib/request-time";
import { Progress } from "@/components/ui/progress";
import { getLearningTarget } from "@/lib/learning-target";
import {
  scopeForTarget,
  roundSizeForMinutes,
  parseLearningScope,
} from "@/lib/learning-contract";
import { filtersQuery, presetLabels } from "@/lib/learning-options";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const statsPromise = getDashboard();
  const presets = ["resume_focus", "project_story", "foundation_fill"] as const;
  const countsPromise = Promise.all(
    presets.map((preset) => getScopeCount(parseLearningScope({ preset }))),
  );
  const target = await getLearningTarget();
  const scope = target ? scopeForTarget(target) : {};
  const size = target
    ? roundSizeForMinutes(target.dailyMinutes as 5 | 10 | 20 | 40)
    : 10;
  const [stats, daily, scopeCounts] = await Promise.all([
    statsPromise,
    getDailyPractice(new Date(getRequestTime()), scope, size),
    countsPromise,
  ]);
  const dailyQuery = filtersQuery(scope);
  dailyQuery.set("mode", "daily");
  dailyQuery.set("size", String(size));
  dailyQuery.set("queue", daily.ids.join(","));
  const dailyHref = `/practice/session?${dailyQuery}`;
  return (
    <div className="page-stack">
      <section className="panel home-focus" aria-labelledby="home-title">
        <div>
          <h1 id="home-title" className="page-title">
            {target
              ? `${presetLabels[target.preset]} · 今日推荐`
              : "今日推荐练习"}
          </h1>
          <p className="page-description">
            {daily.ids.length
              ? `${daily.ids.length} 题 · 到期复习 ${daily.counts.due} · 薄弱巩固 ${daily.counts.weak} · ${scope.track ? `路径新题 ${daily.counts.path ?? 0}` : `核心新题 ${daily.counts.core}`}`
              : "暂无推荐题目"}
          </p>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            {daily.ids.length
              ? `本轮主题：${daily.themes.join("、")}。先独立回答，再对照要点。`
              : "当前没有可自动推荐的题目，可以手动选择范围内题目练习。"}
            {daily.excludedToday > 0 ? "今天已完成的题目已排除。" : ""}
          </p>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            当前范围 {daily.scopeTotal} 道 · 每轮建议 {size} 题
            {target?.projectScope ? ` · ${target.projectScope}` : ""}
            {target?.priority ? ` · ${target.priority}` : ""}
            {target?.interviewDate ? ` · 面试日期 ${target.interviewDate}` : ""}
          </p>
          {daily.outsideDue ? (
            <p className="mt-2 text-sm">
              <Link
                href={`/review?view=outside&${filtersQuery(scope)}`}
                className="subtle-link"
              >
                目标范围外有 {daily.outsideDue} 道到期题，单独复习
              </Link>
            </p>
          ) : null}
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
                <Link href={`/practice?${filtersQuery(scope)}&size=${size}`}>
                  手动选择练习
                </Link>
              </Button>
            )}
            <ContinueButton />
            <Button variant="ghost" asChild>
              <Link href="/mock-interviews">项目模拟面试</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/interview-reviews">真实面试复盘</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/stats">查看目标进度</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/learning-target">
                {target ? "调整训练目标" : "设置训练目标"}
              </Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link
                href={
                  daily.ids.length
                    ? `/practice?${filtersQuery(scope)}&size=${size}`
                    : `/questions?${filtersQuery(scope)}`
                }
              >
                {daily.ids.length ? "手动设置" : "浏览题库"}
              </Link>
            </Button>
          </div>
        </div>
        <div className="home-review">
          {!scope.track ? (
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
          ) : (
            <div>
              <h2 className="text-sm font-medium">目标范围内练习</h2>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                先复习到期题，再巩固薄弱题，最后按优先级进入未正式练过的路径题。当天已完成的题目自动排除。
              </p>
              <Link
                href={`/questions?${filtersQuery(scope)}`}
                className="subtle-link mt-3"
              >
                浏览当前范围 {daily.scopeTotal} 道题
              </Link>
            </div>
          )}
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
      <section aria-labelledby="paths-title">
        <div className="section-heading">
          <h2 id="paths-title" className="section-title">
            按求职场景练习
          </h2>
          <span className="text-xs text-muted-foreground">无需输入搜索词</span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {presets.map((preset, index) => (
            <article
              key={preset}
              className="panel panel-padding flex flex-col gap-3"
            >
              <h3 className="font-medium">{presetLabels[preset]}</h3>
              <p className="text-xs text-muted-foreground">
                当前启用 {scopeCounts[index]} 道题
              </p>
              <p className="text-sm text-muted-foreground">
                {preset === "resume_focus"
                  ? "优先准备简历主张与关键机制"
                  : preset === "project_story"
                    ? "练清职责、流程和取舍"
                    : "补齐简历关联的技术基础"}
              </p>
              {scopeCounts[index] ? (
                <Button asChild>
                  <Link
                    href={`/practice/session?preset=${preset}&mode=daily&size=5`}
                    prefetch={false}
                  >
                    开始 {presetLabels[preset]} 5 题
                  </Link>
                </Button>
              ) : (
                <p className="text-sm">当前范围没有题目</p>
              )}
              <Link
                href={`/questions?preset=${preset}`}
                className="subtle-link"
              >
                浏览范围题目
              </Link>
            </article>
          ))}
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
