import Link from "next/link";
import { notFound } from "next/navigation";
import { getQuestion } from "@/lib/questions";
import { getAnswerCard, getPersonalEvent } from "@/lib/practice-notes";
import { positiveId } from "@/lib/practice-notes-contract";
import { AnswerCardEditor } from "@/components/question/answer-card-editor";
export const dynamic = "force-dynamic";
export default async function AnswerCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [route, search] = await Promise.all([params, searchParams]);
  const id = positiveId.safeParse(route.id);
  if (!id.success) notFound();
  const [row, card] = await Promise.all([
    getQuestion(id.data, true),
    getAnswerCard(id.data),
  ]);
  if (!row) notFound();
  const sourceId =
    search.fromEvent === undefined
      ? null
      : positiveId.safeParse(search.fromEvent);
  if (sourceId && !sourceId.success) notFound();
  const source = sourceId?.success
    ? await getPersonalEvent(id.data, sourceId.data)
    : null;
  if (sourceId && !source) notFound();
  return (
    <div className="reading-column page-stack">
      <div>
        <Link className="subtle-link" href={`/questions/${id.data}`}>
          返回题目
        </Link>
        <h1 className="page-title mt-4">我的回答卡</h1>
        <p className="page-description">
          {row.question.question}
          {!row.question.active ? " · 已停用，资料保留" : ""}
        </p>
      </div>
      {source ? (
        <details className="panel panel-padding">
          <summary className="cursor-pointer">查看准备带入的历史回答</summary>
          <p className="mt-3 whitespace-pre-wrap break-words leading-7">
            {source.answer || "这次是口头作答，未填写文字。"}
          </p>
        </details>
      ) : null}
      <AnswerCardEditor
        key={id.data}
        questionId={id.data}
        initial={
          card
            ? {
                revision: card.revision,
                shortAnswer: card.shortAnswer ?? "",
                example: card.example ?? "",
                contributionBoundary: card.contributionBoundary ?? "",
                evidence: card.evidence ?? "",
              }
            : null
        }
        sourceAnswer={source?.answer}
      />
    </div>
  );
}
