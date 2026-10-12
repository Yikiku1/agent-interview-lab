import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getInterviewReview } from "@/lib/interview-reviews";
import {
  reviewPracticeLabels,
  reviewPracticeQueue,
  reviewPracticeState,
} from "@/lib/interview-review-contract";
import { gapLabels } from "@/lib/practice-notes-contract";
import { Button } from "@/components/ui/button";
import { InterviewReviewEditor } from "@/components/interview-review/review-editor";
export const dynamic = "force-dynamic";
export default async function InterviewReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const review = await getInterviewReview(id.data);
  if (!review) notFound();
  return (
    <div className="reading-column page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">{review.name || "未命名面试"}</h1>
          <p className="page-description">
            {review.interviewDate} · {review.questions.length} 个实际问题
          </p>
        </div>
        <Link className="subtle-link" href="/interview-reviews">
          返回复盘列表
        </Link>
      </div>
      {review.note ? (
        <p className="text-sm leading-7 whitespace-pre-wrap break-words">
          {review.note}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        {([3, 5] as const).map((size) => {
          const queue = reviewPracticeQueue(review.questions, size);
          return queue.length ? (
            <Button
              key={size}
              variant={size === 3 ? "default" : "secondary"}
              asChild
            >
              <Link
                prefetch={false}
                href={`/practice/session?mode=sequential&size=${size}&queue=${queue.join(",")}`}
              >
                补练本次待练 {queue.length} 题
                {queue.length < 3 && size === 5 ? "（5 题档）" : ""}
              </Link>
            </Button>
          ) : null;
        })}
      </div>
      <p className="text-xs leading-6 text-muted-foreground">
        关联后新增的正式完成记录才计为练过；已有历史、只自评、记录复盘和打开补练均不计。补练状态按当前关联判断，重新关联会重新开始跟进。
      </p>
      <section aria-label="本次面试问题" className="flex flex-col gap-4">
        {review.questions.map((row) => (
          <article
            className="panel panel-padding flex flex-col gap-4"
            key={row.id}
          >
            <p className="text-xs text-muted-foreground">
              问题 {row.position + 1} ·{" "}
              {
                reviewPracticeLabels[
                  reviewPracticeState(row.questionId, row.active, row.practiced)
                ]
              }
              {row.questionId !== null && !row.active && row.practiced
                ? " · 关联题已停用"
                : ""}
            </p>
            <h2 className="font-medium leading-7 break-words whitespace-pre-wrap">
              {row.prompt}
            </h2>
            <div className="text-sm leading-7 whitespace-pre-wrap break-words">
              <h3 className="font-medium">当时的回答摘要</h3>
              <p>{row.answerSummary || "尚未填写回答摘要。"}</p>
            </div>
            <div className="text-sm leading-7 whitespace-pre-wrap break-words">
              <h3 className="font-medium">本人卡点与改进</h3>
              <p>
                {row.gaps.map((kind) => gapLabels[kind]).join("、") ||
                  "尚未标记卡点。"}
              </p>
              {row.gapNote ? <p>{row.gapNote}</p> : null}
              <p>{row.improvement || "尚未填写下一次改进。"}</p>
            </div>
            {row.questionId !== null ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm leading-7 break-words">
                  关联时的题库题目：{row.questionSnapshot}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    className="subtle-link"
                    href={`/questions/${row.questionId}`}
                  >
                    查看参考与个人卡点
                  </Link>
                  <Link
                    className="subtle-link"
                    href={`/questions/${row.questionId}/answer-card`}
                  >
                    编辑我的回答卡
                  </Link>
                  {row.active ? (
                    <Button variant="secondary" asChild>
                      <Link
                        prefetch={false}
                        href={`/practice/session?mode=sequential&size=3&queue=${row.questionId}`}
                      >
                        正式补练该题
                      </Link>
                    </Button>
                  ) : null}
                  {row.practiceEventId !== null ? (
                    <Link
                      className="subtle-link"
                      href={`/questions/${row.questionId}/history/${row.practiceEventId}`}
                    >
                      查看关联后的正式回答
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                题库没有的问题保留原文，可在下方编辑时关联已有题。
              </p>
            )}
          </article>
        ))}
      </section>
      <details className="panel panel-padding">
        <summary className="cursor-pointer font-medium min-h-11 leading-7">
          编辑复盘 / 添加问题
        </summary>
        <div className="mt-5">
          <InterviewReviewEditor
            initial={review}
            defaultDate={review.interviewDate}
            firstQuestionId={review.questions[0].id}
          />
        </div>
      </details>
    </div>
  );
}
