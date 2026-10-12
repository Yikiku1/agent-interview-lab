import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { Pagination } from "@/components/ui/pagination";
import { listInterviewReviews } from "@/lib/interview-reviews";
export const dynamic = "force-dynamic";
export default async function InterviewReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { page } = await searchParams;
  if (
    page !== undefined &&
    (typeof page !== "string" || !/^[1-9]\d{0,5}$/.test(page))
  )
    return (
      <Empty title="复盘页码无效" description="从第一页重新查看。">
        <Link className="subtle-link" href="/interview-reviews">
          返回复盘列表
        </Link>
      </Empty>
    );
  const result = await listInterviewReviews(page ? Number(page) : 1);
  return (
    <div className="reading-column page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">真实面试复盘</h1>
          <p className="page-description">
            保留当次问题、自己的回答和下一次改进，再关联题库补练。
          </p>
        </div>
        <Button asChild>
          <Link href="/interview-reviews/new">记录一次面试</Link>
        </Button>
      </div>
      {result.rows.length ? (
        <>
          <p className="text-sm text-muted-foreground">
            共 {result.total} 次面试 · 按面试日期从新到旧
          </p>
          <ul className="panel">
            {result.rows.map((review) => (
              <li
                key={review.id}
                className="border-b border-border last:border-0"
              >
                <Link
                  className="block p-5 min-h-20"
                  href={`/interview-reviews/${review.id}`}
                >
                  <p className="font-medium leading-7 break-words">
                    {review.name || "未命名面试"}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {review.interviewDate} · {review.total ?? 0} 个问题 · 已关联{" "}
                    {review.linked ?? 0} · 关联后正式练过{" "}
                    {review.practiced ?? 0}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination
            page={result.page}
            pages={result.pages}
            href={(next) => `/interview-reviews?page=${next}`}
            label="面试复盘分页"
          />
        </>
      ) : (
        <Empty
          title="还没有面试复盘"
          description="仅记下一个实际问题也可以保存，之后再补回答和关联题。"
        />
      )}
    </div>
  );
}
