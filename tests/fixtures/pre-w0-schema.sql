CREATE TYPE "public"."difficulty" AS ENUM('easy', 'medium', 'hard');--> statement-breakpoint
CREATE TYPE "public"."question_status" AS ENUM('mastered', 'fuzzy', 'unknown');--> statement-breakpoint
CREATE TABLE "questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"category" varchar(32) NOT NULL,
	"subcategory" varchar(64) NOT NULL,
	"difficulty" "difficulty" NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "questions_question_unique" UNIQUE("question")
);
--> statement-breakpoint
CREATE TABLE "review_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(128) NOT NULL,
	"question_id" integer NOT NULL,
	"status" "question_status" NOT NULL,
	"kind" varchar(16) DEFAULT 'legacy' NOT NULL,
	"answer" text,
	"attempt_id" uuid,
	"round_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_question_progress" (
	"user_id" varchar(128) NOT NULL,
	"question_id" integer NOT NULL,
	"status" "question_status" NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"review_stage" integer DEFAULT 0 NOT NULL,
	"next_review_at" timestamp with time zone,
	"last_reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_question_progress_user_id_question_id_pk" PRIMARY KEY("user_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "review_events" ADD CONSTRAINT "review_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_events" ADD CONSTRAINT "review_events_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_question_progress" ADD CONSTRAINT "user_question_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_question_progress" ADD CONSTRAINT "user_question_progress_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "questions_category_idx" ON "questions" USING btree ("category");--> statement-breakpoint
CREATE INDEX "review_events_user_date_idx" ON "review_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "review_events_round_idx" ON "review_events" USING btree ("user_id","round_id","question_id","id");--> statement-breakpoint
CREATE INDEX "review_events_question_date_idx" ON "review_events" USING btree ("user_id","question_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "review_events_user_attempt_idx" ON "review_events" USING btree ("user_id","attempt_id");--> statement-breakpoint
CREATE INDEX "progress_review_due_idx" ON "user_question_progress" USING btree ("user_id","next_review_at");