import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const difficultyEnum = pgEnum("difficulty", ["easy", "medium", "hard"]);
export const statusEnum = pgEnum("question_status", [
  "mastered",
  "fuzzy",
  "unknown",
]);

export const users = pgTable("users", {
  id: varchar("id", { length: 128 }).primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const questions = pgTable(
  "questions",
  {
    id: serial("id").primaryKey(),
    question: text("question").notNull().unique(),
    answer: text("answer").notNull(),
    category: varchar("category", { length: 32 }).notNull(),
    subcategory: varchar("subcategory", { length: 64 }).notNull(),
    difficulty: difficultyEnum("difficulty").notNull(),
    tags: text("tags").array().notNull().default([]),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("questions_category_idx").on(table.category)],
);

export const userQuestionProgress = pgTable(
  "user_question_progress",
  {
    userId: varchar("user_id", { length: 128 })
      .notNull()
      .references(() => users.id),
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    status: statusEnum("status").notNull(),
    reviewCount: integer("review_count").notNull().default(0),
    reviewStage: integer("review_stage").notNull().default(0),
    nextReviewAt: timestamp("next_review_at", { withTimezone: true }),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.questionId] }),
    index("progress_review_due_idx").on(table.userId, table.nextReviewAt),
  ],
);

export const reviewEvents = pgTable(
  "review_events",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id", { length: 128 })
      .notNull()
      .references(() => users.id),
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    status: statusEnum("status").notNull(),
    kind: varchar("kind", { length: 16 })
      .$type<"legacy" | "practice">()
      .notNull()
      .default("legacy"),
    answer: text("answer"),
    attemptId: uuid("attempt_id"),
    roundId: uuid("round_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("review_events_user_date_idx").on(table.userId, table.createdAt),
    index("review_events_round_idx").on(
      table.userId,
      table.roundId,
      table.questionId,
      table.id,
    ),
    index("review_events_question_date_idx").on(
      table.userId,
      table.questionId,
      table.createdAt,
      table.id,
    ),
    uniqueIndex("review_events_user_attempt_idx").on(
      table.userId,
      table.attemptId,
    ),
  ],
);

export type Question = typeof questions.$inferSelect;
export type QuestionStatus = (typeof statusEnum.enumValues)[number];
