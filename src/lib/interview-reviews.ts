import "server-only";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  interviewReviewActions,
  interviewReviewQuestions,
  interviewReviews,
  questions,
  reviewEvents,
  users,
} from "@/db/schema";
import { DEFAULT_USER_ID, questionCondition } from "./questions";
import {
  reviewCreatePayload,
  reviewUpdatePayload,
  type ReviewCreatePayload,
  type ReviewUpdatePayload,
} from "./interview-review-contract";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const ownedReview = (id: string) =>
  and(
    eq(interviewReviews.id, id),
    eq(interviewReviews.userId, DEFAULT_USER_ID),
  );
// The event-id boundary also excludes an old answer saved in the same millisecond as the link.
export function reviewFollowUpExists() {
  return sql<boolean>`exists (select 1 from ${reviewEvents} where ${reviewEvents.userId} = ${interviewReviewQuestions.userId} and ${reviewEvents.questionId} = ${interviewReviewQuestions.questionId} and ${reviewEvents.kind} = 'practice' and ${reviewEvents.id} > ${interviewReviewQuestions.practiceAfterEventId} and ${reviewEvents.createdAt} >= ${interviewReviewQuestions.linkedAt})`;
}
async function readReview(tx: Tx, id: string) {
  const [review] = await tx
    .select()
    .from(interviewReviews)
    .where(ownedReview(id));
  if (!review) return null;
  const rows = await tx
    .select({
      id: interviewReviewQuestions.id,
      position: interviewReviewQuestions.position,
      prompt: interviewReviewQuestions.prompt,
      answerSummary: interviewReviewQuestions.answerSummary,
      gaps: interviewReviewQuestions.gaps,
      gapNote: interviewReviewQuestions.gapNote,
      improvement: interviewReviewQuestions.improvement,
      questionId: interviewReviewQuestions.questionId,
      questionSnapshot: interviewReviewQuestions.questionSnapshot,
      linkedAt: interviewReviewQuestions.linkedAt,
      active: questions.active,
      practiced: reviewFollowUpExists(),
      practiceEventId: sql<
        number | null
      >`(select ${reviewEvents.id} from ${reviewEvents} where ${reviewEvents.userId} = ${interviewReviewQuestions.userId} and ${reviewEvents.questionId} = ${interviewReviewQuestions.questionId} and ${reviewEvents.kind} = 'practice' and ${reviewEvents.id} > ${interviewReviewQuestions.practiceAfterEventId} and ${reviewEvents.createdAt} >= ${interviewReviewQuestions.linkedAt} order by ${reviewEvents.id} desc limit 1)`,
    })
    .from(interviewReviewQuestions)
    .leftJoin(questions, eq(questions.id, interviewReviewQuestions.questionId))
    .where(
      and(
        eq(interviewReviewQuestions.reviewId, id),
        eq(interviewReviewQuestions.userId, DEFAULT_USER_ID),
      ),
    )
    .orderBy(asc(interviewReviewQuestions.position));
  return {
    id: review.id,
    interviewDate: review.interviewDate,
    name: review.name,
    note: review.note,
    revision: review.revision,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
    questions: rows.map((row) => ({
      ...row,
      linkedAt: row.linkedAt?.toISOString() ?? null,
    })),
  };
}
export type InterviewReviewView = NonNullable<
  Awaited<ReturnType<typeof readReview>>
>;
export async function getInterviewReview(id: string) {
  return db.transaction((tx) => readReview(tx, id), {
    isolationLevel: "repeatable read",
    accessMode: "read only",
  });
}
export async function listInterviewReviews(requestedPage = 1) {
  return db.transaction(
    async (tx) => {
      const [total] = await tx
        .select({ n: count() })
        .from(interviewReviews)
        .where(eq(interviewReviews.userId, DEFAULT_USER_ID));
      const pages = Math.max(1, Math.ceil(total.n / 10));
      const page = Math.max(
        1,
        Math.min(
          Number.isSafeInteger(requestedPage) ? requestedPage : 1,
          pages,
        ),
      );
      const rows = await tx
        .select({
          id: interviewReviews.id,
          interviewDate: interviewReviews.interviewDate,
          name: interviewReviews.name,
          createdAt: interviewReviews.createdAt,
          revision: interviewReviews.revision,
        })
        .from(interviewReviews)
        .where(eq(interviewReviews.userId, DEFAULT_USER_ID))
        .orderBy(
          desc(interviewReviews.interviewDate),
          desc(interviewReviews.createdAt),
          desc(interviewReviews.id),
        )
        .limit(10)
        .offset((page - 1) * 10);
      const summary = rows.length
        ? await tx
            .select({
              reviewId: interviewReviewQuestions.reviewId,
              total: count(),
              linked:
                sql<number>`count(*) filter (where ${interviewReviewQuestions.questionId} is not null)`.mapWith(
                  Number,
                ),
              practiced:
                sql<number>`count(*) filter (where ${reviewFollowUpExists()})`.mapWith(
                  Number,
                ),
            })
            .from(interviewReviewQuestions)
            .where(
              and(
                eq(interviewReviewQuestions.userId, DEFAULT_USER_ID),
                inArray(
                  interviewReviewQuestions.reviewId,
                  rows.map((row) => row.id),
                ),
              ),
            )
            .groupBy(interviewReviewQuestions.reviewId)
        : [];
      return {
        total: total.n,
        page,
        pages,
        rows: rows.map((row) => ({
          ...row,
          createdAt: row.createdAt.toISOString(),
          ...summary.find((item) => item.reviewId === row.id),
        })),
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
export async function findReviewQuestionOptions(search: string) {
  if (!search.trim()) return [];
  return db
    .select({
      id: questions.id,
      question: questions.question,
      category: questions.category,
    })
    .from(questions)
    .where(questionCondition({ search: search.trim() }))
    .orderBy(asc(questions.id))
    .limit(20);
}
async function prepareQuestions(
  tx: Tx,
  payload: ReviewCreatePayload,
  previous: (typeof interviewReviewQuestions.$inferSelect)[],
) {
  // Persisted rows retain their identity/order. New questions append; no implicit deletion of personal records.
  if (previous.some((row, index) => payload.questions[index]?.id !== row.id))
    return null;
  const previousById = new Map(previous.map((row) => [row.id, row]));
  const newLinks = [
    ...new Set(
      payload.questions
        .filter(
          (row) =>
            row.questionId !== null &&
            previousById.get(row.id)?.questionId !== row.questionId,
        )
        .map((row) => row.questionId!),
    ),
  ].sort((a, b) => a - b);
  const sources = newLinks.length
    ? await tx
        .select({ id: questions.id, question: questions.question })
        .from(questions)
        .where(and(inArray(questions.id, newLinks), eq(questions.active, true)))
        .orderBy(asc(questions.id))
        .for("share")
    : [];
  if (sources.length !== newLinks.length) return null;
  const cutoffs = newLinks.length
    ? await tx
        .select({
          questionId: reviewEvents.questionId,
          id: sql<number>`max(${reviewEvents.id})`.mapWith(Number),
        })
        .from(reviewEvents)
        .where(
          and(
            eq(reviewEvents.userId, DEFAULT_USER_ID),
            inArray(reviewEvents.questionId, newLinks),
          ),
        )
        .groupBy(reviewEvents.questionId)
    : [];
  const now = new Date();
  return payload.questions.map((row, position) => {
    const prior = previousById.get(row.id);
    const sameLink =
      row.questionId !== null && prior?.questionId === row.questionId;
    return {
      ...row,
      position,
      userId: DEFAULT_USER_ID,
      questionSnapshot:
        row.questionId === null
          ? null
          : sameLink
            ? prior!.questionSnapshot
            : sources.find((source) => source.id === row.questionId)!.question,
      linkedAt:
        row.questionId === null ? null : sameLink ? prior!.linkedAt : now,
      practiceAfterEventId:
        row.questionId === null
          ? null
          : sameLink
            ? prior!.practiceAfterEventId
            : (cutoffs.find((cutoff) => cutoff.questionId === row.questionId)
                ?.id ?? 0),
      updatedAt: now,
    };
  });
}
export async function createInterviewReview(payload: ReviewCreatePayload) {
  return db.transaction(async (tx) => {
    await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, DEFAULT_USER_ID))
      .for("update");
    const [existing] = await tx
      .select()
      .from(interviewReviews)
      .where(
        and(
          eq(interviewReviews.userId, DEFAULT_USER_ID),
          eq(interviewReviews.requestId, payload.requestId),
        ),
      );
    if (existing)
      return {
        status:
          JSON.stringify(reviewCreatePayload.parse(existing.creation)) ===
          JSON.stringify(payload)
            ? 200
            : 409,
        id: existing.id,
      };
    const rows = await prepareQuestions(tx, payload, []);
    if (!rows) return { status: 422, id: null };
    const [review] = await tx
      .insert(interviewReviews)
      .values({
        userId: DEFAULT_USER_ID,
        requestId: payload.requestId,
        creation: payload,
        interviewDate: payload.interviewDate,
        name: payload.name,
        note: payload.note,
      })
      .returning();
    await tx
      .insert(interviewReviewQuestions)
      .values(rows.map((row) => ({ ...row, reviewId: review.id })));
    return { status: 201, id: review.id };
  });
}
export async function updateInterviewReview(
  id: string,
  payload: ReviewUpdatePayload,
) {
  return db.transaction(async (tx) => {
    const [review] = await tx
      .select()
      .from(interviewReviews)
      .where(ownedReview(id))
      .for("update");
    if (!review) return { status: 404, review: null };
    const [oldRequest] = await tx
      .select()
      .from(interviewReviewActions)
      .where(
        and(
          eq(interviewReviewActions.reviewId, id),
          eq(interviewReviewActions.requestId, payload.requestId),
        ),
      );
    if (oldRequest)
      return {
        status:
          JSON.stringify(reviewUpdatePayload.parse(oldRequest.payload)) ===
          JSON.stringify(payload)
            ? 200
            : 409,
        review: await readReview(tx, id),
      };
    if (review.revision !== payload.expectedRevision)
      return { status: 409, review: await readReview(tx, id) };
    const oldRows = await tx
      .select()
      .from(interviewReviewQuestions)
      .where(eq(interviewReviewQuestions.reviewId, id))
      .orderBy(asc(interviewReviewQuestions.position));
    const rows = await prepareQuestions(tx, payload, oldRows);
    if (!rows) return { status: 422, review: await readReview(tx, id) };
    const oldIds = new Set(oldRows.map((row) => row.id));
    for (const row of rows) {
      if (oldIds.has(row.id))
        await tx
          .update(interviewReviewQuestions)
          .set(row)
          .where(
            and(
              eq(interviewReviewQuestions.reviewId, id),
              eq(interviewReviewQuestions.id, row.id),
            ),
          );
      else
        await tx
          .insert(interviewReviewQuestions)
          .values({ ...row, reviewId: id });
    }
    await tx
      .update(interviewReviews)
      .set({
        interviewDate: payload.interviewDate,
        name: payload.name,
        note: payload.note,
        revision: review.revision + 1,
        updatedAt: new Date(),
      })
      .where(ownedReview(id));
    await tx.insert(interviewReviewActions).values({
      reviewId: id,
      userId: DEFAULT_USER_ID,
      requestId: payload.requestId,
      payload,
    });
    return { status: 200, review: await readReview(tx, id) };
  });
}
