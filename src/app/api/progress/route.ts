import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { questions, reviewEvents, userQuestionProgress } from "@/db/schema";
import { DEFAULT_USER_ID } from "@/lib/questions";

const payload = z.object({
  questionId: z.number().int().positive(),
  status: z.enum(["mastered", "fuzzy", "unknown"]),
});

export async function PUT(request: Request) {
  let parsed;
  try {
    parsed = payload.safeParse(await request.json());
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }
  if (!parsed.success)
    return NextResponse.json({ error: "状态或题目无效" }, { status: 400 });
  const { questionId, status } = parsed.data;
  try {
    const [question] = await db
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1);
    if (!question)
      return NextResponse.json({ error: "题目不存在" }, { status: 404 });
    await db.transaction(async (tx) => {
      await tx
        .insert(userQuestionProgress)
        .values({ userId: DEFAULT_USER_ID, questionId, status, reviewCount: 1 })
        .onConflictDoUpdate({
          target: [
            userQuestionProgress.userId,
            userQuestionProgress.questionId,
          ],
          set: {
            status,
            reviewCount: sql`${userQuestionProgress.reviewCount} + 1`,
            lastReviewedAt: new Date(),
            updatedAt: new Date(),
          },
        });
      await tx
        .insert(reviewEvents)
        .values({ userId: DEFAULT_USER_ID, questionId, status });
    });
    return NextResponse.json({ status });
  } catch {
    return NextResponse.json(
      { error: "保存失败，请稍后重试" },
      { status: 500 },
    );
  }
}
