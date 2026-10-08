import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { questions, reviewEvents, userQuestionProgress } from "@/db/schema";
import { DEFAULT_USER_ID } from "@/lib/questions";
import { beijingDayBounds, selectDailyPractice } from "@/lib/daily-practice";

export async function getDailyPractice(now = new Date()) {
  const { start, end } = beijingDayBounds(now);
  const practice = db
    .select({
      questionId: reviewEvents.questionId,
      lastPracticeAt: sql<Date>`max(${reviewEvents.createdAt})`
        .mapWith((value) => new Date(value))
        .as("last_practice_at"),
      completedToday:
        sql<boolean>`bool_or(${reviewEvents.createdAt} >= ${start.toISOString()}::timestamptz and ${reviewEvents.createdAt} < ${end.toISOString()}::timestamptz)`.as(
          "completed_today",
        ),
    })
    .from(reviewEvents)
    .where(
      and(
        eq(reviewEvents.userId, DEFAULT_USER_ID),
        eq(reviewEvents.kind, "practice"),
      ),
    )
    .groupBy(reviewEvents.questionId)
    .as("formal_practice");
  const rows = await db
    .select({
      id: questions.id,
      question: questions.question,
      category: questions.category,
      active: questions.active,
      status: userQuestionProgress.status,
      nextReviewAt: userQuestionProgress.nextReviewAt,
      lastPracticeAt: practice.lastPracticeAt,
      completedToday: practice.completedToday,
    })
    .from(questions)
    .leftJoin(
      userQuestionProgress,
      and(
        eq(userQuestionProgress.questionId, questions.id),
        eq(userQuestionProgress.userId, DEFAULT_USER_ID),
      ),
    )
    .leftJoin(practice, eq(practice.questionId, questions.id))
    .where(eq(questions.active, true));
  return selectDailyPractice(
    rows.map((row) => ({
      ...row,
      completedToday: row.completedToday ?? false,
    })),
    now,
  );
}
