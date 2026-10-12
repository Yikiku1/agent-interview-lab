import postgres from "postgres";
import { databaseUrl } from "./config";
import { migrateInterviewReview } from "./migrate-interview-review";

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.log(
      "W6 增量迁移：先备份并在独立库恢复、核对 W0/W5 升级状态，加 --apply 执行事务迁移。",
    );
    return;
  }
  if (args.length !== 1 || args[0] !== "--apply")
    throw new Error("只支持 --apply；省略参数查看说明");
  const target = new URL(databaseUrl);
  console.log(
    `迁移目标：${target.hostname}:${target.port || "5432"}${target.pathname}`,
  );
  const client = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    console.log(
      (await migrateInterviewReview(client)).applied
        ? "W6 迁移完成"
        : "W6 迁移已应用，无需重复执行",
    );
  } finally {
    await client.end();
  }
}
main().catch((error: unknown) => {
  console.error(
    error instanceof Error && !("code" in error)
      ? error.message
      : "W6 迁移失败，事务已回滚；请核对数据库状态",
  );
  process.exitCode = 1;
});
