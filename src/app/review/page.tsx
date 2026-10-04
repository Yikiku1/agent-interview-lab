import Link from "next/link";
import { ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/question/status-badge";
import { getReviewQuestions } from "@/lib/questions";
import { difficultyLabels } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const rows = await getReviewQuestions();
  const unknown = rows.filter((row) => row.status === "unknown").length;
  const fuzzy = rows.filter((row) => row.status === "fuzzy").length;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">复习</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            先处理不会，再巩固模糊；标记掌握后题目会离开复习列表。
          </p>
        </div>
        {rows.length > 0 && (
          <Button asChild>
            <Link href="/practice/session?mode=weak&includeFuzzy=1">
              <RotateCcw className="size-4" />
              开始复习
            </Link>
          </Button>
        )}
      </div>
      <div className="flex gap-5 border-b border-border pb-4 text-sm">
        <span className="text-rose-700 dark:text-rose-300">
          不会 <strong className="tabular-nums">{unknown}</strong>
        </span>
        <span className="text-amber-700 dark:text-amber-300">
          模糊 <strong className="tabular-nums">{fuzzy}</strong>
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="py-20 text-center">
          <p className="font-medium">暂无待复习题目</p>
          <p className="mt-2 text-sm text-muted-foreground">
            刷题时标记“不会”或“模糊”，题目就会出现在这里。
          </p>
          <Button className="mt-5" asChild>
            <Link href="/practice">去刷题</Link>
          </Button>
        </div>
      ) : (
        <div className="border-t border-border">
          {rows.map(({ question, status }) => (
            <Link
              key={question.id}
              href={`/questions/${question.id}`}
              className="group flex items-start justify-between gap-4 border-b border-border py-5 hover:text-accent"
            >
              <div className="min-w-0">
                <h2 className="font-medium leading-6">{question.question}</h2>
                <p className="mt-2 text-xs text-muted-foreground">
                  {question.category} / {question.subcategory} ·{" "}
                  {difficultyLabels[question.difficulty]}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge status={status} />
                <ArrowRight className="hidden size-4 text-muted-foreground sm:block" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
