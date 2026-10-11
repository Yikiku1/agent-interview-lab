import "server-only";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  answerPointChecks,
  personalAnswerCards,
  practiceGaps,
  practiceObservations,
  questions,
  reviewEvents,
  userQuestionProgress,
  users,
} from "@/db/schema";
import { DEFAULT_USER_ID, questionCondition } from "@/lib/questions";
import type { Filters } from "@/lib/question-filters";
import type {
  GapKind,
  PracticeObservationPayload,
  personalAnswerCardPayload,
} from "@/lib/learning-contract";
import type { z } from "zod";
import { practiceObservationPayload } from "@/lib/learning-contract";

const cardCondition = (questionId: number) =>
  and(
    eq(personalAnswerCards.userId, DEFAULT_USER_ID),
    eq(personalAnswerCards.questionId, questionId),
  );
export async function getAnswerCard(questionId: number) {
  const [card] = await db
    .select()
    .from(personalAnswerCards)
    .where(cardCondition(questionId));
  return card ?? null;
}
export async function getPersonalEvent(questionId: number, eventId: number) {
  const [event] = await db
    .select()
    .from(reviewEvents)
    .where(
      and(
        eq(reviewEvents.id, eventId),
        eq(reviewEvents.questionId, questionId),
        eq(reviewEvents.userId, DEFAULT_USER_ID),
        eq(reviewEvents.kind, "practice"),
      ),
    );
  return event ?? null;
}
export async function saveAnswerCard(
  payload: z.infer<typeof personalAnswerCardPayload>,
) {
  return db.transaction(async (tx) => {
    // Serializes first creation as well as revisions; row locking a missing card cannot do that.
    await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, DEFAULT_USER_ID))
      .for("update");
    const [question] = await tx
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.id, payload.questionId));
    if (!question) return { status: 404, card: null };
    const [current] = await tx
      .select()
      .from(personalAnswerCards)
      .where(cardCondition(payload.questionId));
    const { questionId, expectedRevision, ...fields } = payload;
    if ((current?.revision ?? 0) !== expectedRevision) {
      const retry =
        current &&
        current.revision === expectedRevision + 1 &&
        (Object.keys(fields) as (keyof typeof fields)[]).every(
          (key) => (current[key] ?? "").trim() === fields[key],
        );
      return { status: retry ? 200 : 409, card: current ?? null };
    }
    const [card] = current
      ? await tx
          .update(personalAnswerCards)
          .set({
            ...fields,
            revision: expectedRevision + 1,
            updatedAt: new Date(),
          })
          .where(cardCondition(questionId))
          .returning()
      : await tx
          .insert(personalAnswerCards)
          .values({ userId: DEFAULT_USER_ID, questionId, ...fields })
          .returning();
    return { status: current ? 200 : 201, card };
  });
}

export async function saveObservation(payload: PracticeObservationPayload) {
  return db.transaction(async (tx) => {
    const [question] = await tx
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.id, payload.questionId));
    if (!question) return { status: 404, observation: null };
    if (payload.reviewEventId !== null) {
      const [event] = await tx
        .select({ id: reviewEvents.id })
        .from(reviewEvents)
        .where(
          and(
            eq(reviewEvents.id, payload.reviewEventId),
            eq(reviewEvents.userId, DEFAULT_USER_ID),
            eq(reviewEvents.questionId, payload.questionId),
            eq(reviewEvents.kind, "practice"),
          ),
        );
      if (!event) return { status: 404, observation: null };
    }
    const [inserted] = await tx
      .insert(practiceObservations)
      .values({
        userId: DEFAULT_USER_ID,
        questionId: payload.questionId,
        reviewEventId: payload.reviewEventId,
        requestId: payload.requestId,
        payload,
      })
      .onConflictDoNothing({
        target: [practiceObservations.userId, practiceObservations.requestId],
      })
      .returning();
    if (!inserted) {
      const [current] = await tx
        .select()
        .from(practiceObservations)
        .where(
          and(
            eq(practiceObservations.userId, DEFAULT_USER_ID),
            eq(practiceObservations.requestId, payload.requestId),
          ),
        );
      // JSONB ignores object key order; compare normalized semantic fields.
      const same =
        current &&
        JSON.stringify(practiceObservationPayload.parse(current.payload)) ===
          JSON.stringify(payload);
      return { status: same ? 200 : 409, observation: current ?? null };
    }
    const identity = {
      observationId: inserted.id,
      userId: DEFAULT_USER_ID,
      questionId: payload.questionId,
    };
    if (payload.pointChecks.length)
      await tx
        .insert(answerPointChecks)
        .values(
          payload.pointChecks.map((point) => ({ ...identity, ...point })),
        );
    if (payload.gaps.length)
      await tx
        .insert(practiceGaps)
        .values(payload.gaps.map((gap) => ({ ...identity, ...gap })));
    return { status: 201, observation: inserted };
  });
}
export async function getObservations(questionId: number) {
  return db
    .select()
    .from(practiceObservations)
    .where(
      and(
        eq(practiceObservations.userId, DEFAULT_USER_ID),
        eq(practiceObservations.questionId, questionId),
      ),
    )
    .orderBy(
      desc(practiceObservations.createdAt),
      desc(practiceObservations.id),
    );
}
export async function getPracticeGaps(
  filters: Filters = {},
  kind?: GapKind,
  resolved?: boolean,
) {
  return db
    .select({
      gap: practiceGaps,
      question: {
        id: questions.id,
        question: questions.question,
        active: questions.active,
      },
      reviewEventId: practiceObservations.reviewEventId,
    })
    .from(practiceGaps)
    .innerJoin(questions, eq(questions.id, practiceGaps.questionId))
    .innerJoin(
      practiceObservations,
      eq(practiceObservations.id, practiceGaps.observationId),
    )
    .leftJoin(
      userQuestionProgress,
      and(
        eq(userQuestionProgress.questionId, questions.id),
        eq(userQuestionProgress.userId, DEFAULT_USER_ID),
      ),
    )
    .where(
      and(
        eq(practiceGaps.userId, DEFAULT_USER_ID),
        questionCondition(filters, true),
        kind ? eq(practiceGaps.kind, kind) : undefined,
        resolved === undefined
          ? undefined
          : resolved
            ? sql`${practiceGaps.resolvedAt} is not null`
            : isNull(practiceGaps.resolvedAt),
      ),
    )
    .orderBy(asc(practiceGaps.createdAt), asc(practiceGaps.id));
}
export async function resolvePracticeGap(id: number, resolved: boolean) {
  // CASE leaves timestamps untouched for repeated explicit state requests.
  const [gap] = await db
    .update(practiceGaps)
    .set({
      resolvedAt: resolved
        ? sql`coalesce(${practiceGaps.resolvedAt}, now())`
        : null,
    })
    .where(
      and(eq(practiceGaps.id, id), eq(practiceGaps.userId, DEFAULT_USER_ID)),
    )
    .returning();
  return gap ?? null;
}
