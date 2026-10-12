import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { before, beforeEach, after, test } from "node:test";
import postgres from "postgres";
import { startTestDatabase } from "../helpers/postgres";
import { migrateLearningFoundation } from "../../src/db/migrate-learning-foundation";
import { migrateMockInterview } from "../../src/db/migrate-mock-interview";

let database: Awaited<ReturnType<typeof startTestDatabase>>;
let client: ReturnType<typeof postgres>;
before(async () => {
  database = await startTestDatabase({ pushSchema: false });
  client = postgres(database.url, { onnotice: () => {} });
});
after(async () => {
  if (client) await client.end();
  if (database) await database.stop();
});
beforeEach(async () => {
  await client.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  await client.unsafe(
    await readFile("tests/fixtures/pre-w0-schema.sql", "utf8"),
  );
  await client`insert into users(id) values('default')`;
  await migrateLearningFoundation(client);
});
async function original() {
  const result = [];
  for (const table of [
    "users",
    "questions",
    "user_question_progress",
    "review_events",
    "learning_targets",
    "personal_answer_cards",
    "practice_observations",
    "answer_point_checks",
    "practice_gaps",
  ])
    result.push(
      await client.unsafe(
        `select to_jsonb(t) as row from ${table} t order by to_jsonb(t)::text`,
      ),
    );
  result.push(
    await client`select sequencename,last_value from pg_sequences where schemaname='public' order by sequencename`,
  );
  return JSON.stringify(result);
}
test("versioned W5 migration serializes concurrent runs, preserves original tables/sequences and retries readonly", async () => {
  await client`insert into questions(question,answer,category,subcategory,difficulty,tags) values('原题','原文','Agent','测试','easy','{}')`;
  await client`insert into user_question_progress(user_id,question_id,status) values('default',1,'unknown')`;
  const before = await original();
  const result = await Promise.all([
    migrateMockInterview(client),
    migrateMockInterview(client),
  ]);
  assert.deepEqual(result.map((row) => row.applied).sort(), [false, true]);
  assert.equal(await original(), before);
  assert.equal((await migrateMockInterview(client)).applied, false);
  assert.equal(
    (await client`select count(*)::int as n from app_schema_migrations`)[0].n,
    2,
  );
});
test("unmanaged tables and DDL failures roll back without partial W5 schema or journal changes", async () => {
  const before = await original();
  await client.unsafe("CREATE TABLE mock_nodes(sentinel text)");
  await assert.rejects(() => migrateMockInterview(client), /不能自动接管/);
  await client.unsafe(
    "DROP TABLE mock_nodes; CREATE INDEX mock_rounds_user_request_idx ON users(id)",
  );
  await assert.rejects(() => migrateMockInterview(client));
  assert.equal(
    (await client`select to_regclass('public.mock_rounds') as name`)[0].name,
    null,
  );
  assert.equal(
    (await client`select count(*)::int as n from app_schema_migrations`)[0].n,
    1,
  );
  assert.equal(await original(), before);
});
test("migration checksum drift and missing W0 lineage prevent applying or reusing inconsistent upgrades", async () => {
  await client`update app_schema_migrations set checksum='invalid'`;
  await assert.rejects(() => migrateMockInterview(client), /W0/);
  await client.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  await assert.rejects(() => migrateMockInterview(client), /W0/);
  await client.unsafe(
    await readFile("tests/fixtures/pre-w0-schema.sql", "utf8"),
  );
  await migrateLearningFoundation(client);
  await migrateMockInterview(client);
  await client`update app_schema_migrations set checksum='invalid' where version='0002_mock_interview'`;
  await assert.rejects(() => migrateMockInterview(client), /不能改写/);
});
