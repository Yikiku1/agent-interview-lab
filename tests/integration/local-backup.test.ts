import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { randomUUID } from "node:crypto";
import {
  mkdtemp,
  readFile,
  readdir,
  mkdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import postgres from "postgres";
import { startTestDatabase } from "../helpers/postgres";
import { migrateLearningFoundation } from "../../src/db/migrate-learning-foundation";
import { migrateMockInterview } from "../../src/db/migrate-mock-interview";
import { migrateInterviewReview } from "../../src/db/migrate-interview-review";
import {
  backupTables,
  captureBackup,
  readBackupPackage,
  readableExport,
  restoreBackup,
  writeBackupPackage,
} from "../../src/db/local-backup";
import { localDatabaseStatus } from "../../src/db/local-status";

let sourceDatabase: Awaited<ReturnType<typeof startTestDatabase>>;
let targetDatabase: Awaited<ReturnType<typeof startTestDatabase>>;
let source: ReturnType<typeof postgres>, target: ReturnType<typeof postgres>;
let output: string;
const text = "真实中文原话\nSQL '引号'、反斜线 \\、``` 和 😀 都保留";
before(async () => {
  sourceDatabase = await startTestDatabase({ pushSchema: false });
  targetDatabase = await startTestDatabase({ pushSchema: false });
  source = postgres(sourceDatabase.url, { max: 1, onnotice: () => {} });
  target = postgres(targetDatabase.url, { max: 1, onnotice: () => {} });
  output = await mkdtemp(join(tmpdir(), "interview-backup-"));
  await source.unsafe(
    await readFile("tests/fixtures/pre-w0-schema.sql", "utf8"),
  );
  await migrateLearningFoundation(source);
  await migrateMockInterview(source);
  await migrateInterviewReview(source);
  await source`insert into users(id) values('default'),('another')`;
  await source`insert into questions(question,answer,category,subcategory,difficulty,tags,active) values(${text},${text},'Agent','测试','easy',array['标签'],true),('停用原题','旧参考','LLM','测试','hard','{}',false)`;
  await source`insert into user_question_progress(user_id,question_id,status,review_count,review_stage,next_review_at) values('default',1,'fuzzy',3,2,'2026-10-13T03:04:05.123456Z')`;
  await source`insert into review_events(user_id,question_id,status,kind,answer,attempt_id,round_id) values('default',1,'fuzzy','practice',${text},${randomUUID()},${randomUUID()}),('default',2,'unknown','legacy',null,null,null)`;
  await source`insert into learning_targets(user_id,request_id,preset,daily_minutes,interview_date) values('default',${randomUUID()},'resume_focus',10,'2026-10-20')`;
  await source`insert into personal_answer_cards(user_id,question_id,short_answer,example,contribution_boundary,evidence,revision) values('default',1,${text},null,'我的职责','脱敏日志',4)`;
  const observationId = randomUUID(),
    mockId = randomUUID(),
    reviewId = randomUUID();
  await source`insert into practice_observations(id,user_id,question_id,review_event_id,request_id,payload) values(${observationId},'default',1,1,${randomUUID()},${source.json({ text, nullable: null })})`;
  await source`insert into answer_point_checks(observation_id,user_id,question_id,position,point_text_snapshot,covered,note) values(${observationId},'default',1,0,${text},true,null)`;
  await source`insert into practice_gaps(observation_id,user_id,question_id,kind,note,resolved_at) values(${observationId},'default',1,'evidence',${text},'2026-10-12T12:01:02.123456Z')`;
  await source`insert into mock_rounds(id,user_id,request_id,project,question_id,reference,foundations,revision) values(${mockId},'default',${randomUUID()},'VendorGuard',1,${source.json({ text })},'[]',3)`;
  await source`insert into mock_nodes(round_id,user_id,position,source_question_id,prompt,state,answer,completed_at,gaps,elapsed_seconds) values(${mockId},'default',0,1,${text},'answered',${text},now(),array['evidence'],12)`;
  await source`insert into mock_round_actions(round_id,user_id,request_id,payload) values(${mockId},'default',${randomUUID()},${source.json({ answer: text })})`;
  await source`insert into interview_reviews(id,user_id,request_id,creation,interview_date,name,note,revision) values(${reviewId},'default',${randomUUID()},${source.json({ text })},'2026-10-12','岗位名称',${text},2)`;
  await source`insert into interview_review_questions(review_id,id,user_id,position,prompt,answer_summary,gaps,gap_note,improvement,question_id,question_snapshot,linked_at,practice_after_event_id) values(${reviewId},${randomUUID()},'default',0,${text},${text},array['expression'],'表达卡壳','补证据',1,'关联时原题',now(),2),(${reviewId},${randomUUID()},'default',1,'未收录问题','','{}','','',null,null,null,null)`;
  await source`insert into interview_review_actions(review_id,user_id,request_id,payload) values(${reviewId},'default',${randomUUID()},${source.json({ text })})`;
  await source`select setval('questions_id_seq',42,true)`;
  await source`select setval('practice_gaps_id_seq',17,false)`;
});
beforeEach(async () => {
  await target.unsafe("drop schema public cascade; create schema public");
});
after(async () => {
  if (source) await source.end();
  if (target) await target.end();
  if (sourceDatabase) await sourceDatabase.stop();
  if (targetDatabase) await targetDatabase.stop();
  if (output) await rm(output, { recursive: true, force: true });
});
test("versioned package restores actual upgraded schema, every personal table, Unicode/nulls/microseconds and exact sequence states", async () => {
  const before = await captureBackup(source);
  for (const table of backupTables)
    assert.ok(before.records[table].length, table);
  const first = await writeBackupPackage(source, output, {
    version: "0.1.0",
    revision: "test-revision",
  });
  const second = await writeBackupPackage(source, output, {
    version: "0.1.0",
    revision: null,
  });
  assert.notEqual(first.directory, second.directory);
  const loaded = await readBackupPackage(first.directory);
  assert.equal(loaded.manifest.browserDraftsIncluded, false);
  assert.equal(loaded.manifest.migrations.length, 3);
  assert.equal(loaded.manifest.counts.interview_review_questions, 2);
  const restored = await restoreBackup(target, loaded.snapshot);
  assert.equal(restored.tables, 16);
  assert.equal(restored.sequences, 4);
  assert.deepEqual(await captureBackup(target), before);
  assert.deepEqual(await captureBackup(source), before);
  assert.equal(
    (
      await target`insert into questions(question,answer,category,subcategory,difficulty,tags) values('新题','答案','Agent','测试','easy','{}') returning id`
    )[0].id,
    43,
  );
  assert.equal(
    (await target`select nextval('practice_gaps_id_seq') as n`)[0].n,
    "17",
  );
});
test("standalone restore SQL is executable in an empty database and retains the complete catalog", async () => {
  const saved = await writeBackupPackage(source, output, {
    version: "0.1.0",
    revision: null,
  });
  await target.unsafe(
    await readFile(join(saved.directory, "restore.sql"), "utf8"),
  );
  assert.deepEqual(await captureBackup(target), saved.snapshot);
});
test("existing databases are refused intact and invalid backup records roll back every new schema object", async () => {
  const snapshot = await captureBackup(source);
  await restoreBackup(target, snapshot);
  const before = await captureBackup(target);
  await assert.rejects(() => restoreBackup(target, snapshot), /空库/);
  assert.deepEqual(await captureBackup(target), before);
  await target.unsafe("drop schema public cascade; create schema public");
  const invalid = structuredClone(snapshot);
  invalid.records.users.push(invalid.records.users[0]);
  await assert.rejects(() => restoreBackup(target, invalid));
  assert.equal(
    (
      await target`select count(*)::int as n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'`
    )[0].n,
    0,
  );
});
test("damaged, mismatched and unsupported packages fail validation before restore", async () => {
  const saved = await writeBackupPackage(source, output, {
    version: "0.1.0",
    revision: null,
  });
  const file = join(saved.directory, "snapshot.json"),
    original = await readFile(file, "utf8");
  await writeFile(file, original + " ");
  await assert.rejects(() => readBackupPackage(saved.directory), /校验/);
  await writeFile(file, original);
  const manifestFile = join(saved.directory, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
  manifest.counts.questions++;
  await writeFile(manifestFile, JSON.stringify(manifest));
  await assert.rejects(() => readBackupPackage(saved.directory), /不一致/);
  manifest.formatVersion = 2;
  await writeFile(manifestFile, JSON.stringify(manifest));
  await assert.rejects(() => readBackupPackage(saved.directory));
});
test("readable exports retain all fields separately from restoration metadata and handle embedded Markdown fences", async () => {
  const before = await captureBackup(source);
  const content = readableExport(before, "2026-10-12T00:00:00.000Z");
  const decoded = JSON.parse(content.json);
  assert.equal(decoded.recoverableBackup, false);
  assert.equal(decoded.browserDraftsIncluded, false);
  assert.deepEqual(decoded.records, before.records);
  assert.ok(content.markdown.includes("不能用于完整恢复"));
  assert.ok(content.markdown.includes("````json"));
  assert.ok(content.markdown.includes("interview_review_actions（1 条）"));
  assert.deepEqual(await captureBackup(source), before);
});
test("extra tables or unowned sequences are rejected rather than omitted and health checks are readonly", async () => {
  const before = await captureBackup(source);
  const status = await localDatabaseStatus(source);
  assert.equal(status.tables, 16);
  assert.equal(status.name, "interview_test");
  await source.unsafe("create table extra_personal_record(id int)");
  await assert.rejects(() => captureBackup(source), /额外表/);
  await source.unsafe(
    "drop table extra_personal_record; create sequence extra_sequence",
  );
  await assert.rejects(() => captureBackup(source), /序列/);
  await source.unsafe("drop sequence extra_sequence");
  assert.deepEqual(await captureBackup(source), before);
});
async function cli(args: string[], env: Partial<NodeJS.ProcessEnv>) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>(
    (done, reject) => {
      const child = spawn(
        process.execPath,
        ["--import", "tsx", resolve("scripts/local-data.ts"), ...args],
        { env: { ...process.env, ...env }, windowsHide: true },
      );
      let stdout = "",
        stderr = "";
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      child.on("error", reject);
      child.on("exit", (code) => done({ code, stdout, stderr }));
    },
  );
}
test("restore CLI defaults to offline inspection, requires an explicit different empty target and prints no credentials", async () => {
  const saved = await writeBackupPackage(source, output, {
    version: "0.1.0",
    revision: null,
  });
  const env = {
    DATABASE_URL: "postgres://private:do-not-print@127.0.0.1:1/unavailable",
    RESTORE_DATABASE_URL: "",
  };
  const info = await cli(["restore", "--from", saved.directory], env);
  assert.equal(info.code, 0, info.stderr);
  const missing = await cli(
    ["restore", "--from", saved.directory, "--apply"],
    env,
  );
  assert.equal(missing.code, 1);
  assert.ok(missing.stderr.includes("RESTORE_DATABASE_URL"));
  const same = await cli(["restore", "--from", saved.directory, "--apply"], {
    DATABASE_URL: sourceDatabase.url,
    RESTORE_DATABASE_URL: sourceDatabase.url,
  });
  assert.equal(same.code, 1);
  assert.ok(same.stderr.includes("相同"));
  const restored = await cli(
    ["restore", "--from", saved.directory, "--apply"],
    { ...env, RESTORE_DATABASE_URL: targetDatabase.url },
  );
  assert.equal(restored.code, 0, restored.stderr);
  assert.deepEqual(await captureBackup(target), saved.snapshot);
  for (const result of [info, missing, same, restored])
    assert.ok(!(result.stdout + result.stderr).includes("do-not-print"));
});

test("fresh db:push schema without migration journal rows is backed up and restored with its actual constraint names", async () => {
  const freshDatabase = await startTestDatabase();
  const fresh = postgres(freshDatabase.url, { max: 1, onnotice: () => {} });
  try {
    await fresh`insert into users(id) values('default')`;
    const snapshot = await captureBackup(fresh);
    assert.deepEqual(snapshot.records.app_schema_migrations, []);
    await restoreBackup(target, snapshot);
    assert.deepEqual(await captureBackup(target), snapshot);
  } finally {
    await fresh.end();
    await freshDatabase.stop();
  }
});

test("backup and export CLIs create unique complete packages and readable files without modifying source records", async () => {
  const before = await captureBackup(source);
  const backupRoot = join(output, "cli-backups"),
    exportRoot = join(output, "cli-exports");
  const backedUp = await cli(["backup", "--out", backupRoot], {
    DATABASE_URL: sourceDatabase.url,
  });
  assert.equal(backedUp.code, 0, backedUp.stderr);
  const directories = await readdir(backupRoot);
  assert.equal(directories.length, 1);
  assert.deepEqual(
    (await readBackupPackage(join(backupRoot, directories[0]))).snapshot,
    before,
  );
  const exported = await cli(["export", "--out", exportRoot], {
    DATABASE_URL: sourceDatabase.url,
  });
  assert.equal(exported.code, 0, exported.stderr);
  const [directory] = await readdir(exportRoot);
  const data = JSON.parse(
    await readFile(join(exportRoot, directory, "practice.json"), "utf8"),
  );
  assert.deepEqual(data.records, before.records);
  assert.equal(data.recoverableBackup, false);
  assert.ok(
    (
      await readFile(join(exportRoot, directory, "practice.md"), "utf8")
    ).includes("真实中文原话"),
  );
  assert.deepEqual(await captureBackup(source), before);
});

test("capture waits for an in-flight formal insert and reads coherent committed rows and serial state", async () => {
  const writer = postgres(sourceDatabase.url, { max: 1, onnotice: () => {} });
  let release!: () => void, inserted!: () => void;
  const waitForRelease = new Promise<void>((done) => {
    release = done;
  });
  const waitForInsert = new Promise<void>((done) => {
    inserted = done;
  });
  try {
    const pending = writer.begin(async (tx) => {
      await tx`insert into review_events(user_id,question_id,status,kind,answer) values('default',1,'unknown','practice','并发备份时完成')`;
      inserted();
      await waitForRelease;
    });
    await waitForInsert;
    const capturing = captureBackup(source);
    release();
    await pending;
    const snapshot = await capturing;
    const newest = snapshot.records.review_events.find(
      (row) => row.answer === "并发备份时完成",
    );
    assert.ok(newest);
    assert.equal(
      snapshot.sequences.review_events_id_seq.lastValue,
      String(newest.id),
    );
    assert.equal(snapshot.sequences.review_events_id_seq.isCalled, true);
  } finally {
    release();
    await writer.end();
  }
});

test("startup reuses a ready service, refuses occupied/locked paths, reports build/start failures and keeps the database unchanged", async () => {
  process.env.DATABASE_URL = sourceDatabase.url;
  const { startLocal } = await import("../../scripts/start-local");
  const before = await captureBackup(source),
    database = await localDatabaseStatus(source);
  let ready = true;
  const server = createServer((_request, response) => {
    response.setHeader("Content-Type", "application/json");
    response.end(
      JSON.stringify(
        ready
          ? {
              service: "agent-interview-lab",
              version: 1,
              ready: true,
              database,
            }
          : { service: "other" },
      ),
    );
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const root = await mkdtemp(join(output, "startup-")),
    originalDirectory = process.cwd();
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ name: "interview-practice" }),
  );
  process.chdir(root);
  try {
    assert.equal((await startLocal(address.port)).reused, true);
    await assert.rejects(() => startLocal(address.port, true), /应用已运行/);
    ready = false;
    await assert.rejects(() => startLocal(address.port), /已占用/);
    await mkdir(join(root, ".local"), { recursive: true });
    await writeFile(join(root, ".local/start.lock"), "test-owned-lock", {
      flag: "wx",
    });
    await assert.rejects(() => startLocal(address.port), /另一次启动/);
    assert.equal(
      await readFile(join(root, ".local/start.lock"), "utf8"),
      "test-owned-lock",
    );
    await rm(join(root, ".local/start.lock"));
    assert.deepEqual(await readdir(join(root, ".local")), []);
    server.closeAllConnections();
    await new Promise<void>((done) => server.close(() => done()));
    await mkdir(join(root, "node_modules/next/dist/bin"), { recursive: true });
    await writeFile(
      join(root, "node_modules/next/dist/bin/next"),
      'process.stderr.write("expected fixture command failure"); process.exit(1);',
    );
    await assert.rejects(() => startLocal(address.port), /build.stdout.log/);
    assert.ok(
      (await readFile(join(root, ".local/build.stderr.log"), "utf8")).includes(
        "expected fixture",
      ),
    );
    await mkdir(join(root, ".next"), { recursive: true });
    await writeFile(join(root, ".next/BUILD_ID"), "fixture");
    await assert.rejects(() => startLocal(address.port), /应用启动未通过/);
    assert.ok(
      (await readFile(join(root, ".local/ui-app.stderr.log"), "utf8")).includes(
        "expected fixture",
      ),
    );
    await assert.rejects(() => readFile(join(root, ".local/start.lock")), {
      code: "ENOENT",
    });
    assert.deepEqual(await captureBackup(source), before);
  } finally {
    process.chdir(originalDirectory);
    server.closeAllConnections();
    await new Promise<void>((done) => server.close(() => done()));
  }
});
