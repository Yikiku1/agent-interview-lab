import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Sql } from "postgres";

export const reviewMigrationVersion = "0003_interview_review";
export const reviewTables = [
  "interview_reviews",
  "interview_review_questions",
  "interview_review_actions",
] as const;
export async function migrateInterviewReview(client: Sql) {
  const priorVersions = ["0001_job_seeker_foundation", "0002_mock_interview"];
  const sources = await Promise.all(
    [...priorVersions, reviewMigrationVersion].map((version) =>
      readFile(`src/db/migrations/${version}.sql`, "utf8"),
    ),
  );
  const checksum = (source: string) =>
    createHash("sha256").update(source.replace(/\r\n/g, "\n")).digest("hex");
  return client.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(72401821)`;
    await tx`set local search_path to public, pg_catalog`;
    const [journal] =
      await tx`select to_regclass('public.app_schema_migrations') as relation`;
    if (!journal.relation)
      throw new Error(
        "W6 升级要求已通过 W0/W5 增量迁移的数据库；新空库使用 db:push",
      );
    for (const [index, version] of priorVersions.entries()) {
      const [prior] =
        await tx`select checksum from app_schema_migrations where version=${version}`;
      if (prior?.checksum !== checksum(sources[index]))
        throw new Error("W0/W5 迁移记录缺失或不一致，请核对原库升级状态");
    }
    const currentChecksum = checksum(sources[2]);
    const [current] =
      await tx`select checksum from app_schema_migrations where version=${reviewMigrationVersion}`;
    if (current) {
      if (current.checksum !== currentChecksum)
        throw new Error("已应用的 W6 迁移文件不一致；不能改写历史迁移");
      return { version: reviewMigrationVersion, applied: false };
    }
    for (const table of reviewTables) {
      const [existing] =
        await tx`select to_regclass(${`public.${table}`}) as relation`;
      if (existing.relation)
        throw new Error(`发现无 W6 迁移记录的 ${table}，不能自动接管`);
    }
    for (const statement of sources[2]
      .split("--> statement-breakpoint")
      .map((value) => value.trim())
      .filter(Boolean))
      await tx.unsafe(statement);
    await tx`insert into app_schema_migrations(version, checksum) values(${reviewMigrationVersion}, ${currentChecksum})`;
    return { version: reviewMigrationVersion, applied: true };
  });
}
