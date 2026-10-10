CREATE TABLE "answer_point_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"observation_id" uuid NOT NULL,
	"user_id" varchar(128) NOT NULL,
	"question_id" integer NOT NULL,
	"position" integer NOT NULL,
	"point_text_snapshot" text NOT NULL,
	"covered" boolean NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "answer_point_checks_position_check" CHECK ("answer_point_checks"."position" between 0 and 2),
	CONSTRAINT "answer_point_checks_text_check" CHECK (length(trim("answer_point_checks"."point_text_snapshot")) between 1 and 2000 and coalesce(length("answer_point_checks"."note"), 0) <= 2000)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_schema_migrations" (
	"version" varchar(64) PRIMARY KEY NOT NULL,
	"checksum" varchar(64) NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(128) NOT NULL,
	"request_id" uuid NOT NULL,
	"preset" varchar(32) NOT NULL,
	"project_scope" varchar(32),
	"priority" varchar(2),
	"daily_minutes" integer NOT NULL,
	"interview_date" date,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learning_targets_preset_check" CHECK ("learning_targets"."preset" in ('general_core', 'resume_focus', 'project_story', 'foundation_fill')),
	CONSTRAINT "learning_targets_project_check" CHECK ("learning_targets"."project_scope" in ('VendorGuard', '发票实习', '综合', '技术基础')),
	CONSTRAINT "learning_targets_priority_check" CHECK ("learning_targets"."priority" in ('P0', 'P1', 'P2')),
	CONSTRAINT "learning_targets_minutes_check" CHECK ("learning_targets"."daily_minutes" in (5, 10, 20, 40)),
	CONSTRAINT "learning_targets_scope_check" CHECK (
    ("learning_targets"."preset" <> 'general_core' or ("learning_targets"."project_scope" is null and "learning_targets"."priority" is null)) and
    ("learning_targets"."preset" <> 'project_story' or "learning_targets"."project_scope" is null or "learning_targets"."project_scope" <> '技术基础') and
    ("learning_targets"."preset" <> 'foundation_fill' or "learning_targets"."project_scope" is null or "learning_targets"."project_scope" = '技术基础')
  )
);
--> statement-breakpoint
CREATE TABLE "personal_answer_cards" (
	"user_id" varchar(128) NOT NULL,
	"question_id" integer NOT NULL,
	"short_answer" text,
	"example" text,
	"contribution_boundary" text,
	"evidence" text,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "personal_answer_cards_user_id_question_id_pk" PRIMARY KEY("user_id","question_id"),
	CONSTRAINT "personal_answer_cards_revision_check" CHECK ("personal_answer_cards"."revision" > 0),
	CONSTRAINT "personal_answer_cards_length_check" CHECK (
    coalesce(length("personal_answer_cards"."short_answer"), 0) <= 10000 and
    coalesce(length("personal_answer_cards"."example"), 0) <= 10000 and
    coalesce(length("personal_answer_cards"."contribution_boundary"), 0) <= 10000 and
    coalesce(length("personal_answer_cards"."evidence"), 0) <= 10000
  )
);
--> statement-breakpoint
CREATE TABLE "practice_gaps" (
	"id" serial PRIMARY KEY NOT NULL,
	"observation_id" uuid NOT NULL,
	"user_id" varchar(128) NOT NULL,
	"question_id" integer NOT NULL,
	"kind" varchar(16) NOT NULL,
	"note" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "practice_gaps_kind_check" CHECK ("practice_gaps"."kind" in ('concept', 'expression', 'evidence', 'follow_up', 'other')),
	CONSTRAINT "practice_gaps_note_check" CHECK (coalesce(length("practice_gaps"."note"), 0) <= 2000)
);
--> statement-breakpoint
CREATE TABLE "practice_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(128) NOT NULL,
	"question_id" integer NOT NULL,
	"review_event_id" integer,
	"request_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "practice_observations_identity_unique" UNIQUE("id","user_id","question_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "answer_point_checks_observation_position_idx" ON "answer_point_checks" USING btree ("observation_id","position");
--> statement-breakpoint
CREATE UNIQUE INDEX "learning_targets_active_user_idx" ON "learning_targets" USING btree ("user_id") WHERE "learning_targets"."active" = true;
--> statement-breakpoint
CREATE UNIQUE INDEX "learning_targets_user_request_idx" ON "learning_targets" USING btree ("user_id","request_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "practice_gaps_observation_kind_idx" ON "practice_gaps" USING btree ("observation_id","kind");
--> statement-breakpoint
CREATE INDEX "practice_gaps_open_idx" ON "practice_gaps" USING btree ("user_id","kind","question_id") WHERE "practice_gaps"."resolved_at" is null;
--> statement-breakpoint
CREATE UNIQUE INDEX "practice_observations_user_request_idx" ON "practice_observations" USING btree ("user_id","request_id");
--> statement-breakpoint
CREATE INDEX "practice_observations_question_date_idx" ON "practice_observations" USING btree ("user_id","question_id","created_at");
--> statement-breakpoint
ALTER TABLE "review_events" ADD CONSTRAINT "review_events_identity_unique" UNIQUE("id","user_id","question_id");
--> statement-breakpoint
ALTER TABLE "answer_point_checks" ADD CONSTRAINT "answer_point_checks_observation_identity_fk" FOREIGN KEY ("observation_id","user_id","question_id") REFERENCES "public"."practice_observations"("id","user_id","question_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "learning_targets" ADD CONSTRAINT "learning_targets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "personal_answer_cards" ADD CONSTRAINT "personal_answer_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "personal_answer_cards" ADD CONSTRAINT "personal_answer_cards_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "practice_gaps" ADD CONSTRAINT "practice_gaps_observation_identity_fk" FOREIGN KEY ("observation_id","user_id","question_id") REFERENCES "public"."practice_observations"("id","user_id","question_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "practice_observations" ADD CONSTRAINT "practice_observations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "practice_observations" ADD CONSTRAINT "practice_observations_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "practice_observations" ADD CONSTRAINT "practice_observations_event_identity_fk" FOREIGN KEY ("review_event_id","user_id","question_id") REFERENCES "public"."review_events"("id","user_id","question_id") ON DELETE restrict ON UPDATE no action;
