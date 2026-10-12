import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Sql } from "postgres";
import {
  learningMigrationVersion,
  readLearningMigration,
} from "./migrate-learning-foundation";

export const mockMigrationVersion = "0002_mock_interview";
export const mockTables = [
  "mock_rounds",
  "mock_nodes",
  "mock_round_actions",
] as const;
export async function migrateMockInterview(client: Sql) {
  const source = await readFile(
    "src/db/migrations/0002_mock_interview.sql",
    "utf8",
  );
  const checksum = (text: string) =>
    createHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex");
  const priorChecksum = checksum(await readLearningMigration());
  const currentChecksum = checksum(source);
  return client.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(72401821)`;
    await tx`set local search_path to public, pg_catalog`;
    const [journal] =
      await tx`select to_regclass('public.app_schema_migrations') as relation`;
    if (!journal.relation)
      throw new Error(
        "W5 升级要求已通过 W0 增量迁移的数据库；新空库使用 db:push",
      );
    const [prior] =
      await tx`select checksum from app_schema_migrations where version=${learningMigrationVersion}`;
    if (prior?.checksum !== priorChecksum)
      throw new Error("W0 迁移记录缺失或不一致，请先核对原库升级状态");
    const [current] =
      await tx`select checksum from app_schema_migrations where version=${mockMigrationVersion}`;
    if (current) {
      if (current.checksum !== currentChecksum)
        throw new Error("已应用的 W5 迁移文件不一致；不能改写历史迁移");
      return { version: mockMigrationVersion, applied: false };
    }
    for (const table of mockTables) {
      const [existing] =
        await tx`select to_regclass(${`public.${table}`}) as relation`;
      if (existing.relation)
        throw new Error(`发现无 W5 迁移记录的 ${table}，不能自动接管`);
    }
    for (const statement of source
      .split("--> statement-breakpoint")
      .map((value) => value.trim())
      .filter(Boolean))
      await tx.unsafe(statement);
    await tx`insert into app_schema_migrations(version, checksum) values(${mockMigrationVersion}, ${currentChecksum})`;
    return { version: mockMigrationVersion, applied: true };
  });
}
