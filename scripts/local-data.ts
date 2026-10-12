import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir, mkdtemp } from "node:fs/promises";
import { join, resolve } from "node:path";
import postgres from "postgres";
import { databaseUrl } from "../src/db/config";
import {
  captureBackup,
  readBackupPackage,
  readableExport,
  restoreBackup,
  writeBackupPackage,
} from "../src/db/local-backup";

function argument(name: string, args: string[]) {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  if (!args[index + 1] || args[index + 1].startsWith("--"))
    throw new Error(`缺少 ${name} 参数`);
  return args[index + 1];
}
async function main() {
  const [command, ...args] = process.argv.slice(2);
  const allowed = command === "restore" ? ["--from", "--apply"] : ["--out"];
  for (let index = 0; index < args.length; index++) {
    if (!allowed.includes(args[index]) || args.indexOf(args[index]) !== index)
      throw new Error("参数无效或重复");
    if (args[index] !== "--apply") {
      if (!args[index + 1] || args[index + 1].startsWith("--"))
        throw new Error("缺少路径参数");
      index++;
    }
  }
  if (command === "restore") {
    const from = argument("--from", args);
    if (!from) {
      console.log(
        "恢复说明：--from <备份目录> 查看清单；设置 RESTORE_DATABASE_URL 指向另一空库后加 --apply。不会覆盖现有库。",
      );
      return;
    }
    const { manifest, snapshot } = await readBackupPackage(resolve(from));
    console.log(
      `校验通过：${manifest.createdAtBeijing}，${Object.keys(manifest.counts).length} 张表，${manifest.sequences.length} 个序列`,
    );
    if (!args.includes("--apply")) return;
    const target = process.env.RESTORE_DATABASE_URL;
    if (!target)
      throw new Error(
        "请设置 RESTORE_DATABASE_URL，恢复只能写入明确指定的另一空库",
      );
    const sourceUrl = new URL(databaseUrl),
      targetUrl = new URL(target);
    const localHost = (host: string) =>
      ["localhost", "127.0.0.1", "[::1]"].includes(host) ? "local" : host;
    if (
      localHost(sourceUrl.hostname) === localHost(targetUrl.hostname) &&
      (sourceUrl.port || "5432") === (targetUrl.port || "5432") &&
      sourceUrl.pathname === targetUrl.pathname
    )
      throw new Error("恢复目标与当前应用数据库相同，拒绝执行");
    const client = postgres(target, {
      max: 1,
      connect_timeout: 5,
      onnotice: () => {},
    });
    try {
      const result = await restoreBackup(client, snapshot);
      const report = {
        restoredAt: new Date().toISOString(),
        ...result,
        allSchemaRecordsAndSequencesMatch: true,
      };
      await writeFile(
        join(resolve(from), `restore-verification-${Date.now()}.json`),
        JSON.stringify(report, null, 2) + "\n",
        { flag: "wx" },
      );
      console.log(
        "恢复成功：Schema、十六表全字段和全部序列一致。当前应用连接未改变。",
      );
    } finally {
      await client.end();
    }
    return;
  }
  if (command !== "backup" && command !== "export")
    throw new Error("支持 backup、restore、export");
  const client = postgres(databaseUrl, {
    max: 1,
    connect_timeout: 5,
    onnotice: () => {},
  });
  try {
    const outputRoot = resolve(
      argument("--out", args) ??
        `.local/${command === "backup" ? "backups" : "exports"}`,
    );
    if (command === "backup") {
      const app = JSON.parse(await readFile("package.json", "utf8"));
      let revision: string | null = null;
      try {
        revision = execFileSync("git", ["rev-parse", "HEAD"], {
          encoding: "utf8",
          windowsHide: true,
          stdio: ["ignore", "pipe", "ignore"],
        }).trim();
      } catch {
        /* A downloaded source archive need not contain Git. */
      }
      const result = await writeBackupPackage(client, outputRoot, {
        version: String(app.version),
        revision,
      });
      console.log(
        `备份包已生成：${result.directory}\n覆盖十六表和全部序列；浏览器未保存草稿不在其中。可用 local:restore --from <目录> 校验，向独立空库恢复验证。`,
      );
    } else {
      const content = readableExport(await captureBackup(client));
      await mkdir(outputRoot, { recursive: true });
      const directory = await mkdtemp(join(outputRoot, "export-"));
      await writeFile(join(directory, "practice.json"), content.json, {
        flag: "wx",
      });
      await writeFile(join(directory, "practice.md"), content.markdown, {
        flag: "wx",
      });
      console.log(
        `可读 JSON / Markdown 已导出：${directory}\n不含数据库约束与序列，不能用于完整恢复。`,
      );
    }
  } finally {
    await client.end();
  }
}
main().catch((error: unknown) => {
  console.error(
    error instanceof Error && !("code" in error)
      ? error.message
      : "数据操作失败，请核对数据库连接、权限和 Schema；现有记录未覆盖",
  );
  process.exitCode = 1;
});
