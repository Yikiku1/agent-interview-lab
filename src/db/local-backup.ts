import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Sql } from "postgres";
import { z } from "zod";

export const backupTables = [
  "users",
  "questions",
  "user_question_progress",
  "review_events",
  "learning_targets",
  "personal_answer_cards",
  "practice_observations",
  "answer_point_checks",
  "practice_gaps",
  "app_schema_migrations",
  "mock_rounds",
  "mock_nodes",
  "mock_round_actions",
  "interview_reviews",
  "interview_review_questions",
  "interview_review_actions",
] as const;
const ident = (name: string) => `"${name.replaceAll('"', '""')}"`;
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
const qualified = (name: string) => `public.${ident(name)}`;
export const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const jsonRows = z.array(z.record(z.string(), z.json()));
const schemaDefinition = z.strictObject({
  enums: z.array(
    z.strictObject({ name: z.string(), labels: z.array(z.string()) }),
  ),
  columns: z.array(
    z.strictObject({
      table: z.string(),
      name: z.string(),
      position: z.number(),
      type: z.string(),
      nullable: z.boolean(),
      default: z.string().nullable(),
    }),
  ),
  constraints: z.array(
    z.strictObject({
      table: z.string(),
      name: z.string(),
      kind: z.string(),
      definition: z.string(),
    }),
  ),
  indexes: z.array(
    z.strictObject({
      table: z.string(),
      name: z.string(),
      definition: z.string(),
    }),
  ),
  sequences: z.array(
    z.strictObject({
      name: z.string(),
      type: z.string(),
      start: z.string(),
      increment: z.string(),
      min: z.string(),
      max: z.string(),
      cache: z.string(),
      cycle: z.boolean(),
      table: z.string(),
      column: z.string(),
    }),
  ),
});
export const backupSnapshotSchema = z.strictObject({
  schema: schemaDefinition,
  records: z.record(z.enum(backupTables), jsonRows),
  sequences: z.record(
    z.string(),
    z.strictObject({ lastValue: z.string(), isCalled: z.boolean() }),
  ),
});
export type BackupSnapshot = z.infer<typeof backupSnapshotSchema>;
type Query = Pick<Sql, "unsafe">;

async function readSnapshot(tx: Query): Promise<BackupSnapshot> {
  const enums = await tx.unsafe(
    `select t.typname as name, array_agg(e.enumlabel order by e.enumsortorder) as labels from pg_type t join pg_namespace n on n.oid=t.typnamespace join pg_enum e on e.enumtypid=t.oid where n.nspname='public' group by t.typname order by t.typname`,
  );
  const columns = await tx.unsafe(
    `select c.relname as table, a.attname as name, a.attnum::int as position, format_type(a.atttypid,a.atttypmod) as type, not a.attnotnull as nullable, pg_get_expr(d.adbin,d.adrelid) as default from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum where n.nspname='public' and c.relkind='r' and a.attnum>0 and not a.attisdropped order by c.relname,a.attnum`,
  );
  const constraints = await tx.unsafe(
    `select c.relname as table, t.conname as name, t.contype::text as kind, pg_get_constraintdef(t.oid) as definition from pg_constraint t join pg_class c on c.oid=t.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' order by c.relname,t.conname`,
  );
  const indexes = await tx.unsafe(
    `select c.relname as table, i.relname as name, pg_get_indexdef(i.oid) as definition from pg_index x join pg_class i on i.oid=x.indexrelid join pg_class c on c.oid=x.indrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not exists(select 1 from pg_constraint t where t.conindid=x.indexrelid and t.contype in ('p','u','x')) order by c.relname,i.relname`,
  );
  const sequences = await tx.unsafe(
    `select s.relname as name, format_type(q.seqtypid,null) as type, q.seqstart::text as start, q.seqincrement::text as increment, q.seqmin::text as min, q.seqmax::text as max, q.seqcache::text as cache, q.seqcycle as cycle, c.relname as table, a.attname as column from pg_sequence q join pg_class s on s.oid=q.seqrelid join pg_namespace n on n.oid=s.relnamespace join pg_depend d on d.objid=s.oid and d.deptype='a' join pg_class c on c.oid=d.refobjid join pg_attribute a on a.attrelid=c.oid and a.attnum=d.refobjsubid where n.nspname='public' order by s.relname`,
  );
  const schema = schemaDefinition.parse({
    enums,
    columns: [...columns],
    constraints: [...constraints],
    indexes: [...indexes],
    sequences: [...sequences],
  });
  // PostgreSQL rewrites BETWEEN/array casts when a deparsed CHECK is parsed again.
  // Canonicalize through its parser in session-local empty tables, not regexes.
  for (const table of backupTables) {
    const checks = schema.constraints.filter(
      (row) => row.table === table && row.kind === "c",
    );
    if (!checks.length) continue;
    const columns = schema.columns.filter((row) => row.table === table);
    await tx.unsafe(
      `create temporary table local_backup_check (${columns.map((row) => `${ident(row.name)} ${row.type}`).join(",")}) on commit drop`,
    );
    for (const check of checks)
      await tx.unsafe(
        `alter table pg_temp.local_backup_check add constraint ${ident(check.name)} ${check.definition}`,
      );
    const canonical = await tx.unsafe(
      `select conname as name,pg_get_constraintdef(oid) as definition from pg_constraint where conrelid='pg_temp.local_backup_check'::regclass`,
    );
    for (const check of checks)
      check.definition = String(
        canonical.find((row) => row.name === check.name)!.definition,
      );
    await tx.unsafe("drop table pg_temp.local_backup_check");
  }
  const records: Record<string, unknown> = {};
  for (const table of backupTables)
    records[table] = (
      await tx.unsafe(
        `select to_jsonb(t) as row from ${qualified(table)} t order by to_jsonb(t)::text`,
      )
    ).map(({ row }) => row);
  const states: Record<string, unknown> = {};
  for (const sequence of schema.sequences) {
    const [state] = await tx.unsafe(
      `select last_value::text as "lastValue",is_called as "isCalled" from ${qualified(sequence.name)}`,
    );
    states[sequence.name] = state;
  }
  return backupSnapshotSchema.parse({ schema, records, sequences: states });
}

async function checkSupportedSchema(tx: Query) {
  const tables = await tx.unsafe(
    `select tablename from pg_tables where schemaname='public' order by tablename`,
  );
  if (
    JSON.stringify(tables.map(({ tablename }) => tablename)) !==
    JSON.stringify([...backupTables].sort())
  )
    throw new Error("备份要求完整 W6 十六表；发现缺表或额外表，请核对 Schema");
  const [unsupported] = await tx.unsafe(`select
    (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and (c.relkind not in ('r','i','S') or c.relrowsecurity or c.relforcerowsecurity or c.relpersistence<>'p')) +
    (select count(*) from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and (a.attgenerated<>'' or a.attidentity<>'' or a.attisdropped)) +
    (select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal) +
    (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public') +
    (select count(*) from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype not in ('c','e','b')) +
    (select count(*) from pg_constraint t join pg_namespace n on n.oid=t.connamespace where n.nspname='public' and t.contype not in ('p','u','c','f')) as n`);
  if (Number(unsupported.n))
    throw new Error(
      "当前 Schema 含未支持的自定义对象，不能生成不完整备份；请使用 PostgreSQL 原生备份",
    );
  const [unowned] = await tx.unsafe(
    `select count(*) as n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='S' and not exists(select 1 from pg_depend d where d.objid=c.oid and d.deptype='a')`,
  );
  if (Number(unowned.n))
    throw new Error("发现未归属表字段的序列，不能生成不完整备份");
}

export async function captureBackup(client: Sql) {
  return client.begin(async (tx) => {
    await tx.unsafe(
      "set local lock_timeout='5s'; set local statement_timeout='30s'; set local search_path=public,pg_catalog; set local timezone='UTC'",
    );
    await tx.unsafe("select pg_advisory_xact_lock(72401821)");
    // Lock before reading. Ordinary writes wait briefly so serial values and records agree.
    await tx.unsafe(
      `lock table ${[...backupTables].sort().map(qualified).join(",")} in share mode`,
    );
    await checkSupportedSchema(tx);
    return readSnapshot(tx as unknown as Query);
  });
}

export function restoreStatements(snapshot: BackupSnapshot) {
  const statements = [
    "set local search_path=public,pg_catalog",
    "set local timezone='UTC'",
    "set local standard_conforming_strings=on",
  ];
  for (const row of snapshot.schema.enums)
    statements.push(
      `create type ${qualified(row.name)} as enum (${row.labels.map(literal).join(",")})`,
    );
  for (const row of snapshot.schema.sequences)
    statements.push(
      `create sequence ${qualified(row.name)} as ${row.type} increment ${row.increment} minvalue ${row.min} maxvalue ${row.max} start ${row.start} cache ${row.cache} ${row.cycle ? "cycle" : "no cycle"}`,
    );
  for (const table of backupTables) {
    const columns = snapshot.schema.columns.filter(
      (column) => column.table === table,
    );
    statements.push(
      `create table ${qualified(table)} (${columns.map((column) => `${ident(column.name)} ${column.type}${column.default === null ? "" : ` default ${column.default}`}${column.nullable ? "" : " not null"}`).join(",")})`,
    );
  }
  for (const row of snapshot.schema.sequences)
    statements.push(
      `alter sequence ${qualified(row.name)} owned by ${qualified(row.table)}.${ident(row.column)}`,
    );
  for (const row of snapshot.schema.constraints.filter(
    (row) => row.kind !== "f",
  ))
    statements.push(
      `alter table ${qualified(row.table)} add constraint ${ident(row.name)} ${row.definition}`,
    );
  for (const row of snapshot.schema.indexes) statements.push(row.definition);
  for (const table of backupTables)
    if (snapshot.records[table].length)
      statements.push(
        `insert into ${qualified(table)} select * from jsonb_populate_recordset(null::${qualified(table)},${literal(JSON.stringify(snapshot.records[table]))}::jsonb)`,
      );
  // Add foreign keys after all records; existing cyclic references need no insert ordering.
  for (const row of snapshot.schema.constraints.filter(
    (row) => row.kind === "f",
  ))
    statements.push(
      `alter table ${qualified(row.table)} add constraint ${ident(row.name)} ${row.definition}`,
    );
  for (const [name, state] of Object.entries(snapshot.sequences))
    statements.push(
      `select setval(${literal(`public.${ident(name)}`)},${state.lastValue},${state.isCalled})`,
    );
  return statements;
}
export const restoreSql = (snapshot: BackupSnapshot) =>
  `-- Agent Interview Lab backup v1. Restore into an empty database only.\nBEGIN;\n${restoreStatements(snapshot).join(";\n")};\nCOMMIT;\n`;
export const snapshotFingerprint = (snapshot: BackupSnapshot) =>
  sha256(JSON.stringify(snapshot));

export async function restoreBackup(client: Sql, snapshot: BackupSnapshot) {
  const parsed = backupSnapshotSchema.parse(snapshot);
  return client.begin(async (tx) => {
    await tx.unsafe(
      "select pg_advisory_xact_lock(72401821); set local lock_timeout='5s'; set local statement_timeout='30s'",
    );
    const [objects] = await tx.unsafe(
      `select (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public') + (select count(*) from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public') + (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public') as n`,
    );
    if (Number(objects.n))
      throw new Error("恢复目标必须是空库；已有 Schema 或记录，未作任何修改");
    for (const statement of restoreStatements(parsed))
      await tx.unsafe(statement);
    await checkSupportedSchema(tx);
    const actual = await readSnapshot(tx as unknown as Query);
    if (snapshotFingerprint(actual) !== snapshotFingerprint(parsed))
      throw new Error("恢复后的 Schema、全部记录或序列不一致，事务回滚");
    return {
      tables: backupTables.length,
      sequences: Object.keys(actual.sequences).length,
      fingerprint: snapshotFingerprint(actual),
    };
  });
}

const manifestSchema = z.strictObject({
  format: z.literal("agent-interview-lab-backup"),
  formatVersion: z.literal(1),
  createdAt: z.iso.datetime(),
  createdAtBeijing: z.string(),
  appVersion: z.string(),
  gitRevision: z.string().nullable(),
  postgresVersion: z.string(),
  schemaFingerprint: z.string(),
  snapshotFingerprint: z.string(),
  migrations: jsonRows,
  counts: z.record(z.enum(backupTables), z.number().int().nonnegative()),
  sequences: z.array(z.string()),
  browserDraftsIncluded: z.literal(false),
  files: z.strictObject({
    "snapshot.json": z.string(),
    "restore.sql": z.string(),
  }),
});
export async function writeBackupPackage(
  client: Sql,
  outputRoot: string,
  app: { version: string; revision: string | null },
) {
  const snapshot = await captureBackup(client);
  const [version] = await client`show server_version`;
  const now = new Date();
  await mkdir(outputRoot, { recursive: true });
  const directory = await mkdtemp(
    join(outputRoot, `backup-${now.toISOString().replace(/[:.]/g, "-")}-`),
  );
  const contents = {
    "snapshot.json": `${JSON.stringify(snapshot, null, 2)}\n`,
    "restore.sql": restoreSql(snapshot),
  };
  const manifest = manifestSchema.parse({
    format: "agent-interview-lab-backup",
    formatVersion: 1,
    createdAt: now.toISOString(),
    createdAtBeijing:
      now.toLocaleString("sv-SE", { timeZone: "Asia/Shanghai" }) + " +08:00",
    appVersion: app.version,
    gitRevision: app.revision,
    postgresVersion: version.server_version,
    schemaFingerprint: sha256(JSON.stringify(snapshot.schema)),
    snapshotFingerprint: snapshotFingerprint(snapshot),
    migrations: snapshot.records.app_schema_migrations,
    counts: Object.fromEntries(
      backupTables.map((table) => [table, snapshot.records[table].length]),
    ),
    sequences: Object.keys(snapshot.sequences),
    browserDraftsIncluded: false,
    files: Object.fromEntries(
      Object.entries(contents).map(([name, content]) => [
        name,
        sha256(content),
      ]),
    ),
  });
  for (const [name, content] of Object.entries(contents))
    await writeFile(join(directory, name), content, { flag: "wx" });
  // A package is complete only after the manifest is present.
  await writeFile(
    join(directory, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    { flag: "wx" },
  );
  return { directory, manifest, snapshot };
}
export async function readBackupPackage(directory: string) {
  const manifest = manifestSchema.parse(
    JSON.parse(await readFile(join(directory, "manifest.json"), "utf8")),
  );
  const snapshotText = await readFile(join(directory, "snapshot.json"), "utf8");
  const sqlText = await readFile(join(directory, "restore.sql"), "utf8");
  if (
    sha256(snapshotText) !== manifest.files["snapshot.json"] ||
    sha256(sqlText) !== manifest.files["restore.sql"]
  )
    throw new Error("备份文件校验失败，拒绝恢复");
  const snapshot = backupSnapshotSchema.parse(JSON.parse(snapshotText));
  if (
    snapshotFingerprint(snapshot) !== manifest.snapshotFingerprint ||
    sha256(JSON.stringify(snapshot.schema)) !== manifest.schemaFingerprint ||
    restoreSql(snapshot) !== sqlText ||
    JSON.stringify(manifest.counts) !==
      JSON.stringify(
        Object.fromEntries(
          backupTables.map((table) => [table, snapshot.records[table].length]),
        ),
      ) ||
    JSON.stringify(manifest.migrations) !==
      JSON.stringify(snapshot.records.app_schema_migrations) ||
    JSON.stringify(manifest.sequences) !==
      JSON.stringify(Object.keys(snapshot.sequences))
  )
    throw new Error("备份清单与实际内容不一致，拒绝恢复");
  return { manifest, snapshot };
}

export function readableExport(
  snapshot: BackupSnapshot,
  createdAt = new Date().toISOString(),
) {
  const document = {
    format: "agent-interview-lab-readable-export",
    formatVersion: 1,
    createdAt,
    recoverableBackup: false,
    browserDraftsIncluded: false,
    records: snapshot.records,
  };
  let markdown = `# 面试训练资料导出\n\n导出时间：${createdAt}。这是可读导出，不含数据库约束与序列，不能用于完整恢复；浏览器未保存草稿不在其中。\n\n`;
  for (const table of backupTables) {
    markdown += `## ${table}（${snapshot.records[table].length} 条）\n\n`;
    for (const row of snapshot.records[table]) {
      // Fenced JSON retains multiline Chinese, URLs, snapshot references and nulls without Markdown injection.
      const json = JSON.stringify(row, null, 2);
      const fence = "`".repeat(
        Math.max(
          3,
          ...[...json.matchAll(/`+/g)].map((match) => match[0].length + 1),
        ),
      );
      markdown += `${fence}json\n${json}\n${fence}\n\n`;
    }
  }
  return { json: JSON.stringify(document, null, 2) + "\n", markdown };
}
