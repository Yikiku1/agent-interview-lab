CREATE TABLE interview_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar(128) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  creation jsonb NOT NULL,
  interview_date date NOT NULL,
  name varchar(200) NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  revision integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT interview_reviews_identity_unique UNIQUE(id, user_id),
  CONSTRAINT interview_reviews_content_check CHECK(revision > 0 AND length(note) <= 4000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX interview_reviews_user_request_idx ON interview_reviews(user_id, request_id);
--> statement-breakpoint
CREATE INDEX interview_reviews_user_date_idx ON interview_reviews(user_id, interview_date, created_at, id);
--> statement-breakpoint
CREATE TABLE interview_review_questions (
  review_id uuid NOT NULL,
  id uuid NOT NULL,
  user_id varchar(128) NOT NULL,
  position integer NOT NULL,
  prompt text NOT NULL,
  answer_summary text NOT NULL DEFAULT '',
  gaps text[] NOT NULL DEFAULT '{}',
  gap_note text NOT NULL DEFAULT '',
  improvement text NOT NULL DEFAULT '',
  question_id integer REFERENCES questions(id) ON DELETE RESTRICT,
  question_snapshot text,
  linked_at timestamptz,
  practice_after_event_id integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(review_id, id),
  CONSTRAINT interview_review_questions_position_unique UNIQUE(review_id, position),
  CONSTRAINT interview_review_questions_owner_fk FOREIGN KEY(review_id, user_id) REFERENCES interview_reviews(id, user_id) ON DELETE RESTRICT,
  CONSTRAINT interview_review_questions_content_check CHECK(position BETWEEN 0 AND 19 AND length(prompt) BETWEEN 1 AND 10000 AND length(answer_summary) <= 10000 AND length(gap_note) <= 2000 AND length(improvement) <= 10000 AND gaps <@ ARRAY['concept', 'expression', 'evidence', 'follow_up', 'other']::text[]),
  CONSTRAINT interview_review_questions_link_check CHECK((question_id IS NULL AND question_snapshot IS NULL AND linked_at IS NULL AND practice_after_event_id IS NULL) OR (question_id IS NOT NULL AND question_snapshot IS NOT NULL AND linked_at IS NOT NULL AND practice_after_event_id IS NOT NULL AND practice_after_event_id >= 0))
);
--> statement-breakpoint
CREATE INDEX interview_review_questions_user_question_idx ON interview_review_questions(user_id, question_id);
--> statement-breakpoint
CREATE TABLE interview_review_actions (
  review_id uuid NOT NULL,
  user_id varchar(128) NOT NULL,
  request_id uuid NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(review_id, request_id),
  CONSTRAINT interview_review_actions_owner_fk FOREIGN KEY(review_id, user_id) REFERENCES interview_reviews(id, user_id) ON DELETE RESTRICT
);
