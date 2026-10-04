import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getDashboard } from "@/lib/questions";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const stats = await getDashboard();
  const summary = [
    ["总题目", stats.total],
    ["已刷", stats.brushed],
    ["已掌握", stats.mastered],
    ["模糊", stats.fuzzy],
    ["不会", stats.unknown],
  ] as const;
  return (
    <div className="space-y-9">
      <div>
        <h1 className="text-2xl font-semibold">学习统计</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          累计练习 {stats.totalReviews} 次，今日 {stats.todayReviews} 次。
        </p>
      </div>
      <section>
        <h2 className="mb-4 text-base font-semibold">总体进度</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {summary.map(([label, value]) => (
            <div
              key={label}
              className="rounded-md border border-border bg-surface p-5"
            >
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-3 text-2xl font-semibold tabular-nums">
                {value}
              </p>
            </div>
          ))}
        </div>
      </section>
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-base font-semibold">分类掌握率</h2>
          <p className="text-xs text-muted-foreground">
            已掌握题目数 / 已标记题目数；未刷题目不计入分母
          </p>
        </div>
        <div className="border-t border-border">
          {stats.byCategory.map((item) => (
            <div
              key={item.category}
              className="grid grid-cols-[72px_minmax(0,1fr)_54px] items-center gap-4 border-b border-border py-4 sm:grid-cols-[120px_minmax(0,1fr)_110px_60px]"
            >
              <div className="text-sm font-medium">{item.category}</div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${item.rate}%` }}
                />
              </div>
              <div className="hidden text-right text-xs tabular-nums text-muted-foreground sm:block">
                {item.mastered} / {item.marked} 已标记
              </div>
              <div className="text-right text-sm font-semibold tabular-nums">
                {item.marked ? `${item.rate}%` : "—"}
              </div>
            </div>
          ))}
        </div>
      </section>
      <Button asChild>
        <Link href="/practice">继续刷题</Link>
      </Button>
    </div>
  );
}
