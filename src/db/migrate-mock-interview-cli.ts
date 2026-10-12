import postgres from "postgres";
import { databaseUrl } from "./config";
import { migrateMockInterview } from "./migrate-mock-interview";

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.log(
      "0002_mock_interview：新增模拟轮次、节点和幂等请求记录，保留原十表数据。",
    );
    console.log(
      "默认不连接数据库。备份并完成独立恢复/升级验证后，加 --apply 执行事务迁移。",
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
      (await migrateMockInterview(client)).applied
        ? "W5 迁移完成"
        : "W5 迁移已应用，无需重复执行",
    );
  } finally {
    await client.end();
  }
}
main().catch((error: unknown) => {
  console.error(
    error instanceof Error && !("code" in error)
      ? error.message
      : "W5 迁移失败，事务已回滚；请核对数据库状态",
  );
  process.exitCode = 1;
});
