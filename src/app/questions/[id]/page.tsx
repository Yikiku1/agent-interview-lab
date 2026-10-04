import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownAnswer } from "@/components/question/markdown-answer";
import { StatusActions } from "@/components/question/status-actions";
import { getQuestion } from "@/lib/questions";
import { difficultyLabels } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function QuestionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();
  const row = await getQuestion(numericId);
  if (!row) notFound();
  const { question, status } = row;
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/questions"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        返回题库
      </Link>
      <article className="space-y-7">
        <div className="border-b border-border pb-6">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-accent">
              {question.category} / {question.subcategory}
            </span>
            <span>·</span>
            <span>{difficultyLabels[question.difficulty]}</span>
          </div>
          <h1 className="text-xl font-semibold leading-9 sm:text-2xl">
            {question.question}
          </h1>
          <div className="mt-4 flex flex-wrap gap-2">
            {question.tags.map((tag) => (
              <span
                key={tag}
                className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground">
            参考答案
          </h2>
          <div className="mt-3 rounded-md border border-border bg-surface p-5 sm:p-7">
            <MarkdownAnswer>{question.answer}</MarkdownAnswer>
          </div>
        </section>
        <section className="border-t border-border pt-6">
          <h2 className="mb-4 text-sm font-semibold">掌握程度</h2>
          <StatusActions questionId={question.id} initialStatus={status} />
        </section>
        <div className="flex gap-2 border-t border-border pt-5">
          <Button asChild>
            <Link
              href={`/practice/session?category=${encodeURIComponent(question.category)}&index=0`}
            >
              <ArrowRight className="size-4" />
              开始刷题
            </Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/review">查看复习</Link>
          </Button>
        </div>
      </article>
    </div>
  );
}
