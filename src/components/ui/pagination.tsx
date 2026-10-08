import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Pagination({
  page,
  pages,
  href,
  label = "题目分页",
}: {
  page: number;
  pages: number;
  href: (page: number) => string;
  label?: string;
}) {
  return (
    <nav aria-label={label} className="flex items-center justify-between gap-3">
      <span className="text-xs tabular-nums text-muted-foreground">
        第 {page} / {pages} 页
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button variant="secondary" size="sm" asChild>
            <Link href={href(page - 1)}>
              <ArrowLeft data-icon="inline-start" />
              上一页
            </Link>
          </Button>
        ) : (
          <Button variant="secondary" size="sm" disabled>
            <ArrowLeft data-icon="inline-start" />
            上一页
          </Button>
        )}
        {page < pages ? (
          <Button variant="secondary" size="sm" asChild>
            <Link href={href(page + 1)}>
              下一页
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        ) : (
          <Button variant="secondary" size="sm" disabled>
            下一页
            <ArrowRight data-icon="inline-end" />
          </Button>
        )}
      </div>
    </nav>
  );
}
