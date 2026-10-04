import Link from "next/link";
import { ArrowLeft, ArrowRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/question/status-badge";
import { listQuestions, parseFilters } from "@/lib/questions";
import { categories, difficultyLabels } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const rawPage = Number(params.page ?? 1);
  const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;
  const firstResult = await listQuestions(filters, page);
  const currentPage = Math.min(page, firstResult.pages);
  const { rows, total, pages } =
    currentPage === page
      ? firstResult
      : await listQuestions(filters, currentPage);
  const pageHref = (target: number) => {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });
    query.set("page", String(target));
    return `/questions?${query.toString()}`;
  };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">题库</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          共 {total} 道符合条件的题目
        </p>
      </div>
      <form
        action="/questions"
        className="grid gap-3 rounded-md border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[minmax(180px,1fr)_150px_130px_130px_auto]"
        role="search"
      >
        <label className="relative">
          <span className="sr-only">搜索题目</span>
          <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
          <input
            name="search"
            defaultValue={filters.search}
            placeholder="搜索题目"
            className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label>
          <span className="sr-only">分类</span>
          <select
            name="category"
            defaultValue={filters.category ?? ""}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">全部分类</option>
            {categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">难度</span>
          <select
            name="difficulty"
            defaultValue={filters.difficulty ?? ""}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">全部难度</option>
            {Object.entries(difficultyLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">状态</span>
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">全部状态</option>
            <option value="unmarked">未标记</option>
            <option value="mastered">已掌握</option>
            <option value="fuzzy">模糊</option>
            <option value="unknown">不会</option>
          </select>
        </label>
        <Button type="submit">筛选</Button>
      </form>
      <div className="border-t border-border">
        {rows.length === 0 ? (
          <div className="py-20 text-center text-sm text-muted-foreground">
            没有找到符合条件的题目。试试调整筛选条件。
          </div>
        ) : (
          rows.map(({ question, status }) => (
            <Link
              key={question.id}
              href={`/questions/${question.id}`}
              className="group flex items-start justify-between gap-4 border-b border-border py-5 hover:text-accent"
            >
              <div className="min-w-0">
                <h2 className="font-medium leading-6">{question.question}</h2>
                <p className="mt-2 text-xs text-muted-foreground">
                  {question.category} / {question.subcategory}{" "}
                  <span className="mx-2">·</span>
                  {difficultyLabels[question.difficulty]}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge status={status} />
                <ArrowRight className="hidden size-4 text-muted-foreground sm:block" />
              </div>
            </Link>
          ))
        )}
      </div>
      {total > 0 && (
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            第 {currentPage} / {pages} 页
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" asChild>
              <Link
                href={currentPage > 1 ? pageHref(currentPage - 1) : "#"}
                aria-disabled={currentPage <= 1}
                className={
                  currentPage <= 1 ? "pointer-events-none opacity-50" : ""
                }
              >
                <ArrowLeft className="size-4" />
                上一页
              </Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link
                href={currentPage < pages ? pageHref(currentPage + 1) : "#"}
                aria-disabled={currentPage >= pages}
                className={
                  currentPage >= pages ? "pointer-events-none opacity-50" : ""
                }
              >
                下一页
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
