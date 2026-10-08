import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatsStrip } from "@/components/ui/stats-strip";
import { CategoryProgress } from "@/components/question/category-progress";
import { getDashboard } from "@/lib/questions";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const stats = await getDashboard();
  const weak = stats.fuzzy + stats.unknown;
  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">学习统计</h1>
          <p className="page-description">
            累计练习{" "}
            <strong className="font-medium text-foreground">
              {stats.totalReviews}
            </strong>{" "}
            次，今日{" "}
            <strong className="font-medium text-foreground">
              {stats.todayReviews}
            </strong>{" "}
            次。每完成一题，都会积累一次练习。
          </p>
        </div>
        <Button asChild>
          <Link href={weak ? "/review?view=weak" : "/practice"}>
            {weak ? "巩固薄弱题" : "开始练习"}
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </div>
      <section aria-labelledby="stats-overview-title">
        <div className="section-heading">
          <h2 id="stats-overview-title" className="section-title">
            总体进度
          </h2>
        </div>
        <StatsStrip
          metrics={[
            { label: "题库总数", value: stats.total },
            { label: "已标记", value: stats.marked },
            { label: "已掌握", value: stats.mastered, status: "mastered" },
            { label: "模糊", value: stats.fuzzy, status: "fuzzy" },
            { label: "不会", value: stats.unknown, status: "unknown" },
            { label: "到期复习", value: stats.dueReviews },
          ]}
        />
      </section>
      <section aria-labelledby="stats-category-title">
        <div className="section-heading">
          <h2 id="stats-category-title" className="section-title">
            分类掌握率
          </h2>
          <span className="text-xs text-muted-foreground">已掌握 / 已标记</span>
        </div>
        <CategoryProgress categories={stats.byCategory} detailed />
        <p className="mt-3 text-xs leading-6 text-muted-foreground">
          未标记的题目不计入掌握率；点击分类可以查看对应题目。
        </p>
      </section>
      <p className="text-xs leading-6 text-muted-foreground">
        调整掌握状态不增加练习次数。
        {stats.legacyReviews > 0
          ? `累计次数包含旧版状态记录 ${stats.legacyReviews} 次。`
          : ""}
      </p>
    </div>
  );
}
