import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { Pagination } from "@/components/ui/pagination";
import { MarkdownAnswer } from "@/components/question/markdown-answer";
import { ResumeLearningAnswer } from "@/components/question/resume-learning-answer";
import { ObservationEditor } from "@/components/practice/observation-editor";
import { ObservationHistory } from "@/components/question/observation-history";
import { getObservations } from "@/lib/practice-notes";
import { getCoreLearningEntry } from "@/db/core-answers";
import { getResumeLearningEntry } from "@/db/resume-questions";
import { DueLabel } from "@/components/question/due-label";
import { StatusActions } from "@/components/question/status-actions";
import { StatusBadge } from "@/components/question/status-badge";
import { getQuestion, getQuestionHistory } from "@/lib/questions";
import { difficultyLabels } from "@/lib/utils";
import { getRequestTime } from "@/lib/request-time";

export const dynamic = "force-dynamic";

export default async function QuestionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0 || numericId > 2147483647)
    notFound();
  const [row, history, observations] = await Promise.all([
    getQuestion(numericId, true),
    getQuestionHistory(numericId, Number(search.historyPage ?? 1)),
    getObservations(numericId),
  ]);
  if (!row) notFound();
  const { question, status } = row;
  const resumeEntry = getResumeLearningEntry(question);
  return (
    <div className="reading-column page-stack">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/questions"
          className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-accent"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          返回题库
        </Link>
        {question.active ? (
          <Button asChild>
            <Link
              prefetch={false}
              href={`/practice/session?queue=${question.id}&questionId=${question.id}`}
            >
              练习本题
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        ) : (
          <Badge>已停用，资料保留</Badge>
        )}
      </div>
      <article className="flex flex-col gap-7">
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>
              {question.category} / {question.subcategory}
            </span>
            <span aria-hidden="true">·</span>
            <span>{difficultyLabels[question.difficulty]}</span>
            <StatusBadge status={status} />
          </div>
          <h1 className="question-title">{question.question}</h1>
          <div className="flex flex-wrap gap-2">
            {question.tags.map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>
        </header>
        <section
          aria-labelledby="detail-answer-title"
          className="panel panel-padding flex flex-col gap-5"
        >
          <h2 id="detail-answer-title" className="section-title">
            参考答案
          </h2>
          {resumeEntry ? (
            <ResumeLearningAnswer entry={resumeEntry} />
          ) : (
            <MarkdownAnswer>{question.answer}</MarkdownAnswer>
          )}
        </section>
        <div className="flex flex-wrap gap-4">
          <Link
            className="subtle-link"
            href={`/questions/${question.id}/answer-card`}
          >
            查看 / 编辑我的回答卡
          </Link>
          <Link className="subtle-link" href="/practice-gaps">
            查看卡点与补练
          </Link>
        </div>
        <div className="panel panel-padding">
          <ObservationEditor
            questionId={question.id}
            context="detail"
            points={
              resumeEntry?.points ??
              getCoreLearningEntry(question.question, question.category)
                ?.keyPoints ??
              []
            }
          />
        </div>
        <ObservationHistory rows={observations} />
        <section
          aria-labelledby="mastery-title"
          className="panel panel-padding flex flex-col gap-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="mastery-title" className="section-title">
              掌握程度
            </h2>
            <DueLabel at={row.nextReviewAt} now={getRequestTime()} />
          </div>
          {question.active ? (
            <StatusActions questionId={question.id} initialStatus={status} />
          ) : (
            <p className="text-sm text-muted-foreground">
              题目已停用，原自评与复习记录保留。
            </p>
          )}
        </section>
        <section
          id="history"
          aria-labelledby="history-title"
          className="flex scroll-mt-6 flex-col gap-3"
        >
          <div className="section-heading mb-0">
            <h2 id="history-title" className="section-title">
              历史回答
            </h2>
            <span className="text-xs text-muted-foreground">
              {history.total} 条记录 · 北京时间
            </span>
          </div>
          {history.rows.length === 0 ? (
            <Empty
              title="还没有完成记录"
              description="练习本题并点击“完成本题”，回答与当次自评会保存在这里。"
            />
          ) : (
            <div className="flex flex-col gap-3">
              {history.rows.map((event) => (
                <article key={event.id} className="panel panel-padding">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <time
                      dateTime={event.createdAt.toISOString()}
                      className="text-xs tabular-nums text-muted-foreground"
                    >
                      {event.createdAt.toLocaleString("zh-CN", {
                        timeZone: "Asia/Shanghai",
                        hour12: false,
                      })}
                      {event.kind === "legacy" ? " · 旧版状态记录" : null}
                    </time>
                    <StatusBadge status={event.status} />
                  </div>
                  {event.answer ? (
                    <p className="whitespace-pre-wrap break-words text-sm leading-7">
                      {event.answer}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {event.kind === "legacy"
                        ? "此旧版记录未保存回答。"
                        : "本次未填写文字回答。"}
                    </p>
                  )}
                  {event.kind === "practice" ? (
                    <div className="mt-4 flex flex-wrap gap-4">
                      <Link
                        className="subtle-link"
                        href={`/questions/${question.id}/history/${event.id}`}
                      >
                        查看当次回答与自查
                      </Link>
                      <Link
                        className="subtle-link"
                        href={`/questions/${question.id}/answer-card?fromEvent=${event.id}`}
                      >
                        查看 / 编辑我的回答卡
                      </Link>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
          {history.pages > 1 ? (
            <Pagination
              page={history.page}
              pages={history.pages}
              href={(page) =>
                `/questions/${question.id}?historyPage=${page}#history`
              }
              label="历史回答分页"
            />
          ) : null}
        </section>
      </article>
    </div>
  );
}
