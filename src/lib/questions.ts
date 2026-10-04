import "server-only";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "@/db";
import {
  questions,
  reviewEvents,
  userQuestionProgress,
  type QuestionStatus,
} from "@/db/schema";
import { categories, isCategory } from "@/lib/utils";

export const DEFAULT_USER_ID = "default";
export type Filters = {
  category?: string;
  difficulty?: string;
  status?: string;
  search?: string;
};

export function parseFilters(
  input: Record<string, string | string[] | undefined>,
): Filters {
  const get = (key: string) =>
    typeof input[key] === "string" ? (input[key] as string) : undefined;
  const category = get("category");
  const difficulty = get("difficulty");
  const status = get("status");
  return {
    category: category && isCategory(category) ? category : undefined,
    difficulty:
      difficulty && ["easy", "medium", "hard"].includes(difficulty)
        ? difficulty
        : undefined,
    status:
      status && ["unmarked", "mastered", "fuzzy", "unknown"].includes(status)
        ? status
        : undefined,
    search: get("search")?.trim().slice(0, 100) || undefined,
  };
}

function clauses(filters: Filters): SQL[] {
  const where: SQL[] = [];
  if (filters.category) where.push(eq(questions.category, filters.category));
  if (filters.difficulty)
    where.push(
      eq(
        questions.difficulty,
        filters.difficulty as "easy" | "medium" | "hard",
      ),
    );
  if (filters.status === "unmarked")
    where.push(sql`${userQuestionProgress.questionId} is null`);
  if (filters.status && filters.status !== "unmarked")
    where.push(
      eq(userQuestionProgress.status, filters.status as QuestionStatus),
    );
  if (filters.search)
    where.push(ilike(questions.question, `%${filters.search}%`));
  return where;
}

export async function listQuestions(
  filters: Filters = {},
  page = 1,
  pageSize = 12,
) {
  const condition = and(...clauses(filters));
  const base = db
    .select({ question: questions, status: userQuestionProgress.status })
    .from(questions)
    .leftJoin(
      userQuestionProgress,
      and(
        eq(userQuestionProgress.questionId, questions.id),
        eq(userQuestionProgress.userId, DEFAULT_USER_ID),
      ),
    );
  const rows = await base
    .where(condition)
    .orderBy(asc(questions.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const [{ total }] = await db
    .select({ total: count() })
    .from(questions)
    .leftJoin(
      userQuestionProgress,
      and(
        eq(userQuestionProgress.questionId, questions.id),
        eq(userQuestionProgress.userId, DEFAULT_USER_ID),
      ),
    )
    .where(condition);
  return { rows, total, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getPracticeQuestions(
  filters: Filters = {},
  weak?: "unknown" | "both",
) {
  const condition = weak
    ? and(
        ...clauses({ ...filters, status: undefined }),
        weak === "both"
          ? inArray(userQuestionProgress.status, ["unknown", "fuzzy"])
          : eq(userQuestionProgress.status, "unknown"),
      )
    : and(...clauses(filters));
  return db
    .select({ question: questions, status: userQuestionProgress.status })
    .from(questions)
    .leftJoin(
      userQuestionProgress,
      and(
        eq(userQuestionProgress.questionId, questions.id),
        eq(userQuestionProgress.userId, DEFAULT_USER_ID),
      ),
    )
    .where(condition)
    .orderBy(asc(questions.id));
}

export async function getQuestion(id: number) {
  const [row] = await db
    .select({ question: questions, status: userQuestionProgress.status })
    .from(questions)
    .leftJoin(
      userQuestionProgress,
      and(
        eq(userQuestionProgress.questionId, questions.id),
        eq(userQuestionProgress.userId, DEFAULT_USER_ID),
      ),
    )
    .where(eq(questions.id, id))
    .limit(1);
  return row;
}

export async function getReviewQuestions() {
  return db
    .select({
      question: questions,
      status: userQuestionProgress.status,
      lastReviewedAt: userQuestionProgress.lastReviewedAt,
    })
    .from(userQuestionProgress)
    .innerJoin(questions, eq(questions.id, userQuestionProgress.questionId))
    .where(
      and(
        eq(userQuestionProgress.userId, DEFAULT_USER_ID),
        inArray(userQuestionProgress.status, ["unknown", "fuzzy"]),
      ),
    )
    .orderBy(
      sql`case ${userQuestionProgress.status} when 'unknown' then 0 else 1 end`,
      desc(userQuestionProgress.lastReviewedAt),
    );
}

export async function getDashboard() {
  const all = await db
    .select({
      category: questions.category,
      status: userQuestionProgress.status,
    })
    .from(questions)
    .leftJoin(
      userQuestionProgress,
      and(
        eq(userQuestionProgress.questionId, questions.id),
        eq(userQuestionProgress.userId, DEFAULT_USER_ID),
      ),
    );
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const midnight = new Date(`${today}T00:00:00+08:00`);
  const [[{ totalReviews }], [{ todayReviews }]] = await Promise.all([
    db
      .select({ totalReviews: count() })
      .from(reviewEvents)
      .where(eq(reviewEvents.userId, DEFAULT_USER_ID)),
    db
      .select({ todayReviews: count() })
      .from(reviewEvents)
      .where(
        and(
          eq(reviewEvents.userId, DEFAULT_USER_ID),
          gte(reviewEvents.createdAt, midnight),
        ),
      ),
  ]);
  const byCategory = categories.map((category) => {
    const rows = all.filter((row) => row.category === category);
    const marked = rows.filter((row) => row.status !== null);
    const mastered = marked.filter((row) => row.status === "mastered").length;
    return {
      category,
      total: rows.length,
      marked: marked.length,
      mastered,
      rate: marked.length ? Math.round((mastered / marked.length) * 100) : 0,
    };
  });
  return {
    total: all.length,
    brushed: all.filter((row) => row.status !== null).length,
    mastered: all.filter((row) => row.status === "mastered").length,
    fuzzy: all.filter((row) => row.status === "fuzzy").length,
    unknown: all.filter((row) => row.status === "unknown").length,
    todayReviews,
    totalReviews,
    byCategory,
  };
}
