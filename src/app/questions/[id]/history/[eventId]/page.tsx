import Link from "next/link";
import { notFound } from "next/navigation";
import { getQuestion } from "@/lib/questions";
import { getPersonalEvent, getObservations } from "@/lib/practice-notes";
import { positiveId } from "@/lib/practice-notes-contract";
import { ObservationHistory } from "@/components/question/observation-history";
import { ObservationEditor } from "@/components/practice/observation-editor";
import { StatusBadge } from "@/components/question/status-badge";
import { getResumeLearningEntry } from "@/db/resume-questions";
import { getCoreLearningEntry } from "@/db/core-answers";
export const dynamic = "force-dynamic";
export default async function HistoryAnswerPage({
  params,
}: {
  params: Promise<{ id: string; eventId: string }>;
}) {
  const route = await params;
  const id = positiveId.safeParse(route.id);
  const eventId = positiveId.safeParse(route.eventId);
  if (!id.success || !eventId.success) notFound();
  const [row, event, observations] = await Promise.all([
    getQuestion(id.data, true),
    getPersonalEvent(id.data, eventId.data),
    getObservations(id.data),
  ]);
  if (!row || !event) notFound();
  const points =
    getResumeLearningEntry(row.question)?.points ??
    getCoreLearningEntry(row.question.question, row.question.category)
      ?.keyPoints ??
    [];
  return (
    <div className="reading-column page-stack">
      <div>
        <Link className="subtle-link" href={`/questions/${id.data}#history`}>
          返回题目历史
        </Link>
        <h1 className="page-title mt-4">这次正式回答</h1>
        <p className="page-description">{row.question.question}</p>
      </div>
      <article className="panel panel-padding flex flex-col gap-4">
        <div className="flex flex-wrap justify-between gap-3">
          <time className="text-xs text-muted-foreground">
            {event.createdAt.toLocaleString("zh-CN", {
              timeZone: "Asia/Shanghai",
              hour12: false,
            })}{" "}
            · 北京时间
          </time>
          <StatusBadge status={event.status} />
        </div>
        <p className="whitespace-pre-wrap break-words leading-7">
          {event.answer || "本次未填写文字回答。"}
        </p>
        <Link
          className="subtle-link"
          href={`/questions/${id.data}/answer-card?fromEvent=${event.id}`}
        >
          查看 / 编辑我的回答卡
        </Link>
      </article>
      <div className="panel panel-padding">
        <ObservationEditor
          questionId={id.data}
          context={`event:${event.id}`}
          reviewEventId={event.id}
          points={points}
        />
      </div>
      <ObservationHistory
        rows={observations.filter((item) => item.reviewEventId === event.id)}
      />
    </div>
  );
}
