import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { questions, userQuestionProgress } from "@/db/schema";
import { DEFAULT_USER_ID } from "@/lib/questions";

const payload = z.object({
  questionId: z.number().int().positive().max(2147483647),
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
      .where(and(eq(questions.id, questionId), eq(questions.active, true)))
      .limit(1);
    if (!question)
      return NextResponse.json({ error: "题目不存在" }, { status: 404 });
    await db
      .insert(userQuestionProgress)
      .values({ userId: DEFAULT_USER_ID, questionId, status, reviewCount: 0 })
      .onConflictDoUpdate({
        target: [userQuestionProgress.userId, userQuestionProgress.questionId],
        set: {
          status,
          updatedAt: new Date(),
        },
      });
    return NextResponse.json({ status });
  } catch {
    return NextResponse.json(
      { error: "保存失败，请稍后重试" },
      { status: 500 },
    );
  }
}
