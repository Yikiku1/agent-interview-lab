import "server-only";
import { and, asc, count, eq, isNull, not, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  learningTargets,
  interviewReviewQuestions,
  personalAnswerCards,
  practiceGaps,
  questions,
  reviewEvents,
  userQuestionProgress,
} from "@/db/schema";
import { DEFAULT_USER_ID, questionCondition } from "@/lib/questions";
import { gapKinds, scopeForTarget } from "@/lib/learning-contract";
import type { Filters } from "@/lib/question-filters";
import { reviewFollowUpExists } from "./interview-reviews";
// ECMAScript trim whitespace, including non-breaking spaces and BOM from pasted text.
const trimWhitespace =
  "\t\n\v\f\r \u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff";

export async function getScopeProgress(
  customFilters?: Filters,
  requestedPage = 1,
) {
  // Target, denominator, counters and list describe one read-only database snapshot.
  return db.transaction(
    async (tx) => {
      const [target] = await tx
        .select()
        .from(learningTargets)
        .where(
          and(
            eq(learningTargets.userId, DEFAULT_USER_ID),
            eq(learningTargets.active, true),
          ),
        );
      const filters = customFilters ?? (target ? scopeForTarget(target) : {});
      const scope = tx.$with("scope_questions").as(
        tx
          .select({
            id: questions.id,
            question: questions.question,
            category: questions.category,
            subcategory: questions.subcategory,
            difficulty: questions.difficulty,
            status: userQuestionProgress.status,
          })
          .from(questions)
          .leftJoin(
            userQuestionProgress,
            and(
              eq(userQuestionProgress.questionId, questions.id),
              eq(userQuestionProgress.userId, DEFAULT_USER_ID),
            ),
          )
          .where(questionCondition(filters)),
      );
      const formal = sql<boolean>`exists (select 1 from ${reviewEvents} where ${reviewEvents.questionId} = ${scope.id} and ${reviewEvents.userId} = ${DEFAULT_USER_ID} and ${reviewEvents.kind} = 'practice')`;
      const [[summary], [cards], gapRows, [reviewSummary]] = await Promise.all([
        tx
          .with(scope)
          .select({
            total: count(),
            covered: sql<number>`count(*) filter (where ${formal})`.mapWith(
              Number,
            ),
            mastered:
              sql<number>`count(*) filter (where ${scope.status} = 'mastered')`.mapWith(
                Number,
              ),
            fuzzy:
              sql<number>`count(*) filter (where ${scope.status} = 'fuzzy')`.mapWith(
                Number,
              ),
            unknown:
              sql<number>`count(*) filter (where ${scope.status} = 'unknown')`.mapWith(
                Number,
              ),
            unmarked:
              sql<number>`count(*) filter (where ${scope.status} is null)`.mapWith(
                Number,
              ),
          })
          .from(scope),
        tx
          .with(scope)
          .select({
            total: count(),
            evidenceFilled:
              sql<number>`count(*) filter (where length(btrim(coalesce(${personalAnswerCards.evidence}, ''), ${trimWhitespace})) > 0)`.mapWith(
                Number,
              ),
          })
          .from(personalAnswerCards)
          .innerJoin(scope, eq(scope.id, personalAnswerCards.questionId))
          .where(eq(personalAnswerCards.userId, DEFAULT_USER_ID)),
        tx
          .with(scope)
          .select({ kind: practiceGaps.kind, total: count() })
          .from(practiceGaps)
          .innerJoin(scope, eq(scope.id, practiceGaps.questionId))
          .where(
            and(
              eq(practiceGaps.userId, DEFAULT_USER_ID),
              isNull(practiceGaps.resolvedAt),
            ),
          )
          .groupBy(practiceGaps.kind),
        tx
          .with(scope)
          .select({
            linked: count(),
            practiced:
              sql<number>`count(*) filter (where ${reviewFollowUpExists()})`.mapWith(
                Number,
              ),
          })
          .from(interviewReviewQuestions)
          .innerJoin(scope, eq(scope.id, interviewReviewQuestions.questionId))
          .where(eq(interviewReviewQuestions.userId, DEFAULT_USER_ID)),
      ]);
      const unpracticedTotal = summary.total - summary.covered;
      const pageSize = 12;
      const pages = Math.max(1, Math.ceil(unpracticedTotal / pageSize));
      const page = Number.isSafeInteger(requestedPage)
        ? Math.max(1, Math.min(requestedPage, pages))
        : 1;
      const unpracticed = await tx
        .with(scope)
        .select()
        .from(scope)
        .where(not(formal))
        .orderBy(asc(scope.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize);
      const gaps = gapKinds.map((kind) => ({
        kind,
        total: gapRows.find((row) => row.kind === kind)?.total ?? 0,
      }));
      return {
        filters,
        target: target ?? null,
        usesTarget: customFilters === undefined,
        ...summary,
        coverage: summary.total ? summary.covered / summary.total : null,
        cards: cards.total,
        evidenceFilled: cards.evidenceFilled,
        gaps,
        openGaps: gaps.reduce((sum, gap) => sum + gap.total, 0),
        interviewReviews: {
          ...reviewSummary,
          pending: reviewSummary.linked - reviewSummary.practiced,
        },
        unpracticed: {
          rows: unpracticed,
          total: unpracticedTotal,
          page,
          pages,
        },
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
