import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { questions, reviewEvents, userQuestionProgress } from "@/db/schema";
import { DEFAULT_USER_ID } from "@/lib/questions";
import { MAX_ANSWER_LENGTH } from "@/lib/practice-draft";
import { scheduleReview } from "@/lib/review-schedule";

const payload = z.object({
  questionId: z.number().int().positive().max(2147483647),
  attemptId: z.uuid(),
  status: z.enum(["mastered", "fuzzy", "unknown"]),
  answer: z.string().max(MAX_ANSWER_LENGTH),
  roundId: z.uuid().optional(),
});

export async function POST(request: Request) {
  let parsed;
  try {
    parsed = payload.safeParse(await request.json());
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }
  if (!parsed.success)
    return NextResponse.json(
      { error: "题目、状态或回答无效" },
      { status: 400 },
    );
  const { questionId, attemptId, status } = parsed.data;
  const roundId = parsed.data.roundId ?? null;
  const answer = parsed.data.answer.trim() || null;
  try {
    const result = await db.transaction(async (tx) => {
      const [question] = await tx
        .select({ id: questions.id })
        .from(questions)
        .where(and(eq(questions.id, questionId), eq(questions.active, true)))
        .for("share");
      if (!question) return { error: "题目不存在", code: 404 };
      const [inserted] = await tx
        .insert(reviewEvents)
        .values({
          userId: DEFAULT_USER_ID,
          questionId,
          attemptId,
          status,
          answer,
          kind: "practice",
          roundId,
        })
        .onConflictDoNothing({
          target: [reviewEvents.userId, reviewEvents.attemptId],
        })
        .returning();
      if (!inserted) {
        const [existing] = await tx
          .select()
          .from(reviewEvents)
          .where(
            and(
              eq(reviewEvents.userId, DEFAULT_USER_ID),
              eq(reviewEvents.attemptId, attemptId),
            ),
          );
        if (
          !existing ||
          existing.questionId !== questionId ||
          existing.status !== status ||
          existing.answer !== answer ||
          existing.roundId !== roundId
        )
          return {
            error: "这次练习已经提交了不同的内容，请开始新的练习",
            code: 409,
          };
        const [progress] = await tx
          .select({ nextReviewAt: userQuestionProgress.nextReviewAt })
          .from(userQuestionProgress)
          .where(
            and(
              eq(userQuestionProgress.userId, DEFAULT_USER_ID),
              eq(userQuestionProgress.questionId, questionId),
            ),
          );
        return {
          event: existing,
          nextReviewAt: progress?.nextReviewAt ?? null,
          code: 200,
        };
      }
      await tx
        .insert(userQuestionProgress)
        .values({ userId: DEFAULT_USER_ID, questionId, status, reviewCount: 0 })
        .onConflictDoNothing();
      const condition = and(
        eq(userQuestionProgress.userId, DEFAULT_USER_ID),
        eq(userQuestionProgress.questionId, questionId),
      );
      const [previous] = await tx
        .select()
        .from(userQuestionProgress)
        .where(condition)
        .for("update");
      const schedule = scheduleReview(
        status,
        previous.reviewStage,
        inserted.createdAt,
      );
      await tx
        .update(userQuestionProgress)
        .set({
          status,
          reviewCount: previous.reviewCount + 1,
          lastReviewedAt: inserted.createdAt,
          updatedAt: new Date(),
          ...schedule,
        })
        .where(condition);
      return {
        event: inserted,
        nextReviewAt: schedule.nextReviewAt,
        code: 201,
      };
    });
    if (result.error)
      return NextResponse.json(
        { error: result.error },
        { status: result.code },
      );
    return NextResponse.json(
      {
        id: result.event!.id,
        status: result.event!.status,
        nextReviewAt: result.nextReviewAt,
      },
      { status: result.code },
    );
  } catch {
    return NextResponse.json(
      { error: "练习保存失败，回答已保留，请重试" },
      { status: 500 },
    );
  }
}
