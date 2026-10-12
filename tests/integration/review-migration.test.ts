import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { before, beforeEach, after, test } from "node:test";
import postgres from "postgres";
import { startTestDatabase } from "../helpers/postgres";
import { migrateLearningFoundation } from "../../src/db/migrate-learning-foundation";
import { migrateMockInterview } from "../../src/db/migrate-mock-interview";
import { migrateInterviewReview } from "../../src/db/migrate-interview-review";
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
  await migrateMockInterview(client);
});
async function original() {
  const records = [];
  for (const {
    tablename,
  } of await client`select tablename from pg_tables where schemaname='public' and tablename not like 'interview_review%' and tablename <> 'app_schema_migrations' order by tablename`)
    records.push(
      await client.unsafe(
        `select to_jsonb(t) as row from "${tablename}" t order by to_jsonb(t)::text`,
      ),
    );
  // Only the new version row is allowed to change.
  records.push(
    await client`select * from app_schema_migrations where version <> '0003_interview_review' order by version`,
  );
  for (const {
    sequencename,
  } of await client`select sequencename from pg_sequences where schemaname='public' order by sequencename`)
    records.push(
      await client.unsafe(`select last_value,is_called from "${sequencename}"`),
    );
  return JSON.stringify(records);
}
test("W6 concurrent/versioned migration preserves old thirteen-table records and four sequences, including saved W5 mock material", async () => {
  await client`insert into questions(question,answer,category,subcategory,difficulty,tags) values('原题','原文','Agent','测试','easy','{}')`;
  await client`insert into mock_rounds(id,user_id,request_id,project,question_id,reference,foundations) values('00000000-0000-4000-8000-000000000001','default','00000000-0000-4000-8000-000000000002','VendorGuard',1,'{}','[]')`;
  await client`insert into mock_nodes(round_id,user_id,position,source_question_id,prompt,answer) values('00000000-0000-4000-8000-000000000001','default',0,1,'原模拟职责','原草稿')`;
  const before = await original();
  const result = await Promise.all([
    migrateInterviewReview(client),
    migrateInterviewReview(client),
  ]);
  assert.deepEqual(result.map((row) => row.applied).sort(), [false, true]);
  assert.equal(await original(), before);
  assert.equal((await migrateInterviewReview(client)).applied, false);
  assert.equal(
    (await client`select count(*)::int as n from app_schema_migrations`)[0].n,
    3,
  );
});
test("unmanaged W6 schema and injected DDL failures roll back without partial new tables or journal records", async () => {
  const before = await original();
  await client.unsafe("create table interview_review_questions(sentinel text)");
  await assert.rejects(() => migrateInterviewReview(client), /不能自动接管/);
  await client.unsafe(
    "drop table interview_review_questions; create index interview_reviews_user_request_idx on users(id)",
  );
  await assert.rejects(() => migrateInterviewReview(client));
  assert.equal(
    (await client`select to_regclass('public.interview_reviews') as name`)[0]
      .name,
    null,
  );
  assert.equal(await original(), before);
});
test("W6 rejects missing/tampered W0 or W5 lineage and changed W6 checksums", async () => {
  await client`update app_schema_migrations set checksum='invalid' where version='0002_mock_interview'`;
  await assert.rejects(() => migrateInterviewReview(client), /W0\/W5/);
  await client.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  await assert.rejects(() => migrateInterviewReview(client), /W0\/W5/);
  await client.unsafe(
    await readFile("tests/fixtures/pre-w0-schema.sql", "utf8"),
  );
  await migrateLearningFoundation(client);
  await migrateMockInterview(client);
  await migrateInterviewReview(client);
  await client`update app_schema_migrations set checksum='invalid' where version='0003_interview_review'`;
  await assert.rejects(() => migrateInterviewReview(client), /不能改写/);
});
