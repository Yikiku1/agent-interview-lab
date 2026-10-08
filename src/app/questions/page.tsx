import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { Pagination } from "@/components/ui/pagination";
import { QuestionFilters } from "@/components/question/question-filters";
import { QuestionList } from "@/components/question/question-list";
import { listQuestions, parseFilters } from "@/lib/questions";

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
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">题库</h1>
          <p className="page-description">
            按知识点查找题目，读懂答案，再用自己的话练习。
          </p>
        </div>
        <span className="text-sm tabular-nums text-muted-foreground">
          {total} 道符合条件
        </span>
      </div>
      <QuestionFilters filters={filters} />
      {rows.length ? (
        <QuestionList rows={rows} />
      ) : (
        <Empty
          title="没有找到符合条件的题目"
          description="试试更短的关键词，或调整分类、难度与掌握状态。"
        >
          <Button variant="secondary" asChild>
            <Link href="/questions">清除筛选</Link>
          </Button>
        </Empty>
      )}
      {total > 0 ? (
        <Pagination page={currentPage} pages={pages} href={pageHref} />
      ) : null}
    </div>
  );
}
