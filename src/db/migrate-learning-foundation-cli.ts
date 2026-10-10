import postgres from "postgres";
import { databaseUrl } from "./config";
import {
  learningMigrationVersion,
  migrateLearningFoundation,
} from "./migrate-learning-foundation";

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log(
      `${learningMigrationVersion}：新增学习基础表与索引，保留原四表记录。`,
    );
    console.log(
      "此命令默认不连接数据库。备份并核对连接后，加 --apply 执行事务迁移。新库继续使用 db:push。 ",
    );
    return;
  }
  if (args.length !== 1 || args[0] !== "--apply")
    throw new Error("只支持 --apply；省略参数查看迁移说明");
  const target = new URL(databaseUrl);
  console.log(
    `迁移目标：${target.hostname}:${target.port || "5432"}${target.pathname}`,
  );
  const client = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    const result = await migrateLearningFoundation(client);
    console.log(result.applied ? "W0 迁移完成" : "W0 迁移已应用，无需重复执行");
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  // Database errors can contain connection details; report a code, not credentials or SQL values.
  console.error(
    error instanceof Error && !("code" in error)
      ? error.message
      : "W0 迁移失败，事务已回滚；请核对基线与数据库状态",
  );
  process.exitCode = 1;
});
