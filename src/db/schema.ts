import {
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
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
      .references(() => questions.id, { onDelete: "cascade" }),
    status: statusEnum("status").notNull(),
    reviewCount: integer("review_count").notNull().default(0),
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
  (table) => [primaryKey({ columns: [table.userId, table.questionId] })],
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
      .references(() => questions.id, { onDelete: "cascade" }),
    status: statusEnum("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("review_events_user_date_idx").on(table.userId, table.createdAt),
  ],
);

export type Question = typeof questions.$inferSelect;
export type QuestionStatus = (typeof statusEnum.enumValues)[number];
