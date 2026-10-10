import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type {
  GapKind,
  LearningPreset,
  PracticeObservationPayload,
  ProjectScope,
  ResumePriority,
} from "../lib/learning-contract";

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
    unique("review_events_identity_unique").on(
      table.id,
      table.userId,
      table.questionId,
    ),
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

export const learningTargets = pgTable(
  "learning_targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: varchar("user_id", { length: 128 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    requestId: uuid("request_id").notNull(),
    preset: varchar("preset", { length: 32 }).$type<LearningPreset>().notNull(),
    projectScope: varchar("project_scope", {
      length: 32,
    }).$type<ProjectScope>(),
    priority: varchar("priority", { length: 2 }).$type<ResumePriority>(),
    dailyMinutes: integer("daily_minutes").notNull(),
    interviewDate: date("interview_date", { mode: "string" }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("learning_targets_active_user_idx")
      .on(table.userId)
      .where(sql`${table.active} = true`),
    uniqueIndex("learning_targets_user_request_idx").on(
      table.userId,
      table.requestId,
    ),
    check(
      "learning_targets_preset_check",
      sql`${table.preset} in ('general_core', 'resume_focus', 'project_story', 'foundation_fill')`,
    ),
    check(
      "learning_targets_project_check",
      sql`${table.projectScope} in ('VendorGuard', '发票实习', '综合', '技术基础')`,
    ),
    check(
      "learning_targets_priority_check",
      sql`${table.priority} in ('P0', 'P1', 'P2')`,
    ),
    check(
      "learning_targets_minutes_check",
      sql`${table.dailyMinutes} in (5, 10, 20, 40)`,
    ),
    check(
      "learning_targets_scope_check",
      sql`
    (${table.preset} <> 'general_core' or (${table.projectScope} is null and ${table.priority} is null)) and
    (${table.preset} <> 'project_story' or ${table.projectScope} is null or ${table.projectScope} <> '技术基础') and
    (${table.preset} <> 'foundation_fill' or ${table.projectScope} is null or ${table.projectScope} = '技术基础')
  `,
    ),
  ],
);

export const personalAnswerCards = pgTable(
  "personal_answer_cards",
  {
    userId: varchar("user_id", { length: 128 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    shortAnswer: text("short_answer"),
    example: text("example"),
    contributionBoundary: text("contribution_boundary"),
    evidence: text("evidence"),
    revision: integer("revision").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.questionId] }),
    check("personal_answer_cards_revision_check", sql`${table.revision} > 0`),
    check(
      "personal_answer_cards_length_check",
      sql`
    coalesce(length(${table.shortAnswer}), 0) <= 10000 and
    coalesce(length(${table.example}), 0) <= 10000 and
    coalesce(length(${table.contributionBoundary}), 0) <= 10000 and
    coalesce(length(${table.evidence}), 0) <= 10000
  `,
    ),
  ],
);

export const practiceObservations = pgTable(
  "practice_observations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: varchar("user_id", { length: 128 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    reviewEventId: integer("review_event_id"),
    requestId: uuid("request_id").notNull(),
    payload: jsonb("payload").$type<PracticeObservationPayload>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("practice_observations_user_request_idx").on(
      table.userId,
      table.requestId,
    ),
    unique("practice_observations_identity_unique").on(
      table.id,
      table.userId,
      table.questionId,
    ),
    index("practice_observations_question_date_idx").on(
      table.userId,
      table.questionId,
      table.createdAt,
    ),
    foreignKey({
      name: "practice_observations_event_identity_fk",
      columns: [table.reviewEventId, table.userId, table.questionId],
      foreignColumns: [
        reviewEvents.id,
        reviewEvents.userId,
        reviewEvents.questionId,
      ],
    }).onDelete("restrict"),
  ],
);

export const answerPointChecks = pgTable(
  "answer_point_checks",
  {
    id: serial("id").primaryKey(),
    observationId: uuid("observation_id").notNull(),
    userId: varchar("user_id", { length: 128 }).notNull(),
    questionId: integer("question_id").notNull(),
    position: integer("position").notNull(),
    pointTextSnapshot: text("point_text_snapshot").notNull(),
    covered: boolean("covered").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("answer_point_checks_observation_position_idx").on(
      table.observationId,
      table.position,
    ),
    foreignKey({
      name: "answer_point_checks_observation_identity_fk",
      columns: [table.observationId, table.userId, table.questionId],
      foreignColumns: [
        practiceObservations.id,
        practiceObservations.userId,
        practiceObservations.questionId,
      ],
    }).onDelete("restrict"),
    check(
      "answer_point_checks_position_check",
      sql`${table.position} between 0 and 2`,
    ),
    check(
      "answer_point_checks_text_check",
      sql`length(trim(${table.pointTextSnapshot})) between 1 and 2000 and coalesce(length(${table.note}), 0) <= 2000`,
    ),
  ],
);

export const practiceGaps = pgTable(
  "practice_gaps",
  {
    id: serial("id").primaryKey(),
    observationId: uuid("observation_id").notNull(),
    userId: varchar("user_id", { length: 128 }).notNull(),
    questionId: integer("question_id").notNull(),
    kind: varchar("kind", { length: 16 }).$type<GapKind>().notNull(),
    note: text("note"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("practice_gaps_observation_kind_idx").on(
      table.observationId,
      table.kind,
    ),
    index("practice_gaps_open_idx")
      .on(table.userId, table.kind, table.questionId)
      .where(sql`${table.resolvedAt} is null`),
    foreignKey({
      name: "practice_gaps_observation_identity_fk",
      columns: [table.observationId, table.userId, table.questionId],
      foreignColumns: [
        practiceObservations.id,
        practiceObservations.userId,
        practiceObservations.questionId,
      ],
    }).onDelete("restrict"),
    check(
      "practice_gaps_kind_check",
      sql`${table.kind} in ('concept', 'expression', 'evidence', 'follow_up', 'other')`,
    ),
    check(
      "practice_gaps_note_check",
      sql`coalesce(length(${table.note}), 0) <= 2000`,
    ),
  ],
);

export const appSchemaMigrations = pgTable("app_schema_migrations", {
  version: varchar("version", { length: 64 }).primaryKey(),
  checksum: varchar("checksum", { length: 64 }).notNull(),
  appliedAt: timestamp("applied_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Question = typeof questions.$inferSelect;
export type QuestionStatus = (typeof statusEnum.enumValues)[number];
