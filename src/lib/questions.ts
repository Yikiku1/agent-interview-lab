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
  isNull,
  lte,
  or,
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
import type { PracticeMode, RoundCompletion } from "@/lib/practice-session";

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
  const where: SQL[] = [eq(questions.active, true)];
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
    .orderBy(...(weak ? reviewOrder() : [asc(questions.id)]));
}

function reviewOrder() {
  return [
    sql`case ${userQuestionProgress.status} when 'unknown' then 0 else 1 end`,
    asc(userQuestionProgress.lastReviewedAt),
    asc(questions.id),
  ];
}

function dueCondition(now: Date) {
  return or(
    isNull(userQuestionProgress.nextReviewAt),
    lte(userQuestionProgress.nextReviewAt, now),
  );
}

function dueOrder() {
  return [
    sql`${userQuestionProgress.nextReviewAt} asc nulls first`,
    ...reviewOrder(),
  ];
}

export async function getPracticeSelection(
  filters: Filters,
  mode: Exclude<PracticeMode, "daily">,
  size: 10 | 20,
  seed: string,
  includeFuzzy: boolean,
  now = new Date(),
) {
  const condition =
    mode === "due"
      ? and(
          ...clauses({ ...filters, status: undefined }),
          sql`${userQuestionProgress.questionId} is not null`,
          dueCondition(now),
        )
      : mode === "weak"
        ? and(
            ...clauses({ ...filters, status: undefined }),
            includeFuzzy
              ? inArray(userQuestionProgress.status, ["unknown", "fuzzy"])
              : eq(userQuestionProgress.status, "unknown"),
          )
        : and(...clauses(filters));
  const rows = await db
    .select({ id: questions.id })
    .from(questions)
    .leftJoin(
      userQuestionProgress,
      and(
        eq(userQuestionProgress.questionId, questions.id),
        eq(userQuestionProgress.userId, DEFAULT_USER_ID),
      ),
    )
    .where(condition)
    .orderBy(
      ...(mode === "random"
        ? [sql`md5(${questions.id}::text || ${seed})`, asc(questions.id)]
        : mode === "weak"
          ? reviewOrder()
          : mode === "due"
            ? dueOrder()
            : [asc(questions.id)]),
    )
    .limit(size);
  return rows.map((row) => row.id);
}

export async function getRoundCompletions(
  roundId: string,
  ids: number[],
): Promise<RoundCompletion[]> {
  if (!ids.length) return [];
  const rows = await db
    .selectDistinctOn([reviewEvents.questionId], {
      questionId: reviewEvents.questionId,
      status: reviewEvents.status,
      answer: reviewEvents.answer,
      attemptId: reviewEvents.attemptId,
      nextReviewAt: userQuestionProgress.nextReviewAt,
    })
    .from(reviewEvents)
    .leftJoin(
      userQuestionProgress,
      and(
        eq(userQuestionProgress.questionId, reviewEvents.questionId),
        eq(userQuestionProgress.userId, DEFAULT_USER_ID),
      ),
    )
    .where(
      and(
        eq(reviewEvents.userId, DEFAULT_USER_ID),
        eq(reviewEvents.roundId, roundId),
        inArray(reviewEvents.questionId, ids),
      ),
    )
    .orderBy(
      asc(reviewEvents.questionId),
      desc(reviewEvents.createdAt),
      desc(reviewEvents.id),
    );
  return rows.flatMap((row) =>
    row.attemptId
      ? [
          {
            ...row,
            attemptId: row.attemptId,
            nextReviewAt: row.nextReviewAt?.toISOString() ?? null,
          },
        ]
      : [],
  );
}

export async function getDueReviewQuestions(now = new Date()) {
  return db
    .select({
      question: questions,
      status: userQuestionProgress.status,
      nextReviewAt: userQuestionProgress.nextReviewAt,
    })
    .from(userQuestionProgress)
    .innerJoin(questions, eq(questions.id, userQuestionProgress.questionId))
    .where(
      and(
        eq(userQuestionProgress.userId, DEFAULT_USER_ID),
        eq(questions.active, true),
        dueCondition(now),
      ),
    )
    .orderBy(...dueOrder());
}

// A saved queue keeps its selection even when mastery status changes.
export async function getQuestionsByIds(ids: number[]) {
  if (ids.length === 0) return [];
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
    .where(and(eq(questions.active, true), inArray(questions.id, ids)));
}

export async function getQuestion(id: number) {
  const [row] = await db
    .select({
      question: questions,
      status: userQuestionProgress.status,
      nextReviewAt: userQuestionProgress.nextReviewAt,
    })
    .from(questions)
    .leftJoin(
      userQuestionProgress,
      and(
        eq(userQuestionProgress.questionId, questions.id),
        eq(userQuestionProgress.userId, DEFAULT_USER_ID),
      ),
    )
    .where(and(eq(questions.id, id), eq(questions.active, true)))
    .limit(1);
  return row;
}

export async function getReviewQuestions() {
  return db
    .select({
      question: questions,
      status: userQuestionProgress.status,
      lastReviewedAt: userQuestionProgress.lastReviewedAt,
      nextReviewAt: userQuestionProgress.nextReviewAt,
    })
    .from(userQuestionProgress)
    .innerJoin(questions, eq(questions.id, userQuestionProgress.questionId))
    .where(
      and(
        eq(userQuestionProgress.userId, DEFAULT_USER_ID),
        inArray(userQuestionProgress.status, ["unknown", "fuzzy"]),
        eq(questions.active, true),
      ),
    )
    .orderBy(...reviewOrder());
}

export async function getQuestionHistory(
  questionId: number,
  requestedPage = 1,
  pageSize = 10,
) {
  const condition = and(
    eq(reviewEvents.userId, DEFAULT_USER_ID),
    eq(reviewEvents.questionId, questionId),
  );
  const [{ total }] = await db
    .select({ total: count() })
    .from(reviewEvents)
    .where(condition);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Number.isInteger(requestedPage)
    ? Math.min(pages, Math.max(1, requestedPage))
    : 1;
  const rows = await db
    .select({
      id: reviewEvents.id,
      status: reviewEvents.status,
      answer: reviewEvents.answer,
      kind: reviewEvents.kind,
      createdAt: reviewEvents.createdAt,
    })
    .from(reviewEvents)
    .where(condition)
    .orderBy(desc(reviewEvents.createdAt), desc(reviewEvents.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return { rows, total, pages, page };
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
    )
    .where(eq(questions.active, true));
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const midnight = new Date(`${today}T00:00:00+08:00`);
  const [
    [{ totalReviews, legacyReviews }],
    [{ todayReviews }],
    [{ dueReviews }],
  ] = await Promise.all([
    db
      .select({
        totalReviews: count(),
        legacyReviews:
          sql<number>`count(*) filter (where ${reviewEvents.kind} = 'legacy')`.mapWith(
            Number,
          ),
      })
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
    db
      .select({ dueReviews: count() })
      .from(userQuestionProgress)
      .innerJoin(questions, eq(questions.id, userQuestionProgress.questionId))
      .where(
        and(
          eq(userQuestionProgress.userId, DEFAULT_USER_ID),
          eq(questions.active, true),
          dueCondition(new Date()),
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
    marked: all.filter((row) => row.status !== null).length,
    mastered: all.filter((row) => row.status === "mastered").length,
    fuzzy: all.filter((row) => row.status === "fuzzy").length,
    unknown: all.filter((row) => row.status === "unknown").length,
    todayReviews,
    totalReviews,
    legacyReviews,
    dueReviews,
    byCategory,
  };
}
