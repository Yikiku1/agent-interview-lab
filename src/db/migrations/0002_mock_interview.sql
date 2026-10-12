CREATE TABLE mock_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar(128) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  project varchar(32) NOT NULL,
  question_id integer NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  reference jsonb NOT NULL,
  foundations jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mock_rounds_identity_unique UNIQUE(id, user_id),
  CONSTRAINT mock_rounds_project_check CHECK(project IN ('VendorGuard', '发票实习')),
  CONSTRAINT mock_rounds_revision_check CHECK(revision > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX mock_rounds_user_request_idx ON mock_rounds(user_id, request_id);
--> statement-breakpoint
CREATE INDEX mock_rounds_user_date_idx ON mock_rounds(user_id, created_at, id);
--> statement-breakpoint
CREATE TABLE mock_nodes (
  round_id uuid NOT NULL,
  user_id varchar(128) NOT NULL,
  position integer NOT NULL,
  source_question_id integer NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  parent_position integer,
  prompt text NOT NULL,
  state varchar(16) NOT NULL DEFAULT 'pending',
  answer text NOT NULL DEFAULT '',
  elapsed_seconds integer NOT NULL DEFAULT 0,
  gaps text[] NOT NULL DEFAULT '{}',
  gap_note text NOT NULL DEFAULT '',
  completed_at timestamptz,
  PRIMARY KEY(round_id, position),
  CONSTRAINT mock_nodes_round_identity_fk FOREIGN KEY(round_id, user_id) REFERENCES mock_rounds(id, user_id) ON DELETE RESTRICT,
  CONSTRAINT mock_nodes_position_check CHECK(position BETWEEN 0 AND 4 AND ((position < 2 AND parent_position IS NULL) OR (position >= 2 AND parent_position IS NOT NULL AND parent_position = 1))),
  CONSTRAINT mock_nodes_state_check CHECK(state IN ('pending', 'answered', 'skipped') AND ((state = 'pending' AND completed_at IS NULL) OR (state <> 'pending' AND completed_at IS NOT NULL))),
  CONSTRAINT mock_nodes_content_check CHECK(length(prompt) BETWEEN 1 AND 10000 AND length(answer) <= 10000 AND length(gap_note) <= 2000 AND elapsed_seconds BETWEEN 0 AND 86400 AND gaps <@ ARRAY['concept', 'expression', 'evidence', 'follow_up', 'other']::text[])
);
--> statement-breakpoint
CREATE TABLE mock_round_actions (
  round_id uuid NOT NULL,
  user_id varchar(128) NOT NULL,
  request_id uuid NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(round_id, request_id),
  CONSTRAINT mock_round_actions_round_identity_fk FOREIGN KEY(round_id, user_id) REFERENCES mock_rounds(id, user_id) ON DELETE RESTRICT
);
