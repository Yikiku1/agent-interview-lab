import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Question, QuestionStatus } from "@/db/schema";
import { StatusBadge } from "@/components/question/status-badge";
import { DueLabel } from "@/components/question/due-label";
import { difficultyLabels } from "@/lib/utils";

export function QuestionList({
  rows,
  review = false,
  now,
}: {
  rows: {
    question: Question;
    status: QuestionStatus | null;
    nextReviewAt?: Date | null;
  }[];
  review?: boolean;
  now?: number;
}) {
  return (
    <ul className="panel question-list">
      {rows.map(({ question, status, nextReviewAt }) => (
        <li key={question.id}>
          <Link href={`/questions/${question.id}`} className="question-row">
            <h2 className="question-row-title">{question.question}</h2>
            <p className="question-row-meta">
              <span>
                {question.category} / {question.subcategory}
              </span>
              <span aria-hidden="true">·</span>
              <span>{difficultyLabels[question.difficulty]}</span>
            </p>
            <span className="question-row-status">
              <StatusBadge status={status} />
              <ArrowRight
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
            </span>
            {review ? (
              <span className="question-row-review">
                <DueLabel
                  at={nextReviewAt ?? null}
                  prefix="复习时间"
                  now={now}
                />
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
