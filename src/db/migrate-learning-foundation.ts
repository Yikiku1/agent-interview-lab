import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Sql } from "postgres";

export const learningMigrationVersion = "0001_job_seeker_foundation";
export const learningFoundationTables = [
  "learning_targets",
  "personal_answer_cards",
  "practice_observations",
  "answer_point_checks",
  "practice_gaps",
] as const;

export async function readLearningMigration() {
  return readFile(
    resolve("src/db/migrations/0001_job_seeker_foundation.sql"),
    "utf8",
  );
}

// The caller supplies the connection; importing this module never connects or migrates.
export async function migrateLearningFoundation(client: Sql) {
  const source = await readLearningMigration();
  // Ignore checkout line-ending differences when verifying a previously applied migration.
  const checksum = createHash("sha256")
    .update(source.replace(/\r\n/g, "\n"))
    .digest("hex");
  return client.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(72401821)`;
    await tx`set local search_path to public, pg_catalog`;
    await tx.unsafe(`CREATE TABLE IF NOT EXISTS app_schema_migrations (
      version varchar(64) PRIMARY KEY NOT NULL,
      checksum varchar(64) NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const [applied] =
      await tx`select checksum from app_schema_migrations where version = ${learningMigrationVersion}`;
    if (applied) {
      if (applied.checksum !== checksum)
        throw new Error(
          "已应用的 W0 迁移与当前文件不一致；请新增迁移，不能改写历史文件",
        );
      return { version: learningMigrationVersion, applied: false };
    }
    for (const table of [
      "users",
      "questions",
      "user_question_progress",
      "review_events",
    ]) {
      const [row] =
        await tx`select to_regclass(${`public.${table}`}) as relation`;
      if (!row.relation)
        throw new Error(`W0 迁移要求现有四表基线；缺少 ${table}`);
    }
    for (const table of learningFoundationTables) {
      const [row] =
        await tx`select to_regclass(${`public.${table}`}) as relation`;
      if (row.relation)
        throw new Error(
          `发现无 W0 迁移记录的 ${table}；请核对建库来源，不能自动接管已有表`,
        );
    }
    for (const statement of source
      .split("--> statement-breakpoint")
      .map((value) => value.trim())
      .filter(Boolean))
      await tx.unsafe(statement);
    await tx`insert into app_schema_migrations (version, checksum) values (${learningMigrationVersion}, ${checksum})`;
    return { version: learningMigrationVersion, applied: true };
  });
}
