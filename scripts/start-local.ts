import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import {
  open,
  access,
  mkdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { createConnection } from "node:net";
import { dirname, join, resolve } from "node:path";
import postgres from "postgres";
import { databaseUrl } from "../src/db/config";
import { localDatabaseStatus } from "../src/db/local-status";

export async function portInUse(port: number) {
  return new Promise<boolean>((done) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    const finish = (value: boolean) => {
      socket.destroy();
      done(value);
    };
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.setTimeout(1000, () => finish(true));
  });
}
export async function probeApplication(
  port: number,
  database: Awaited<ReturnType<typeof localDatabaseStatus>>,
) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/local-status`, {
      signal: AbortSignal.timeout(2000),
      redirect: "error",
    });
    if (!response.ok) return false;
    const body = await response.json();
    return (
      body.service === "agent-interview-lab" &&
      body.version === 1 &&
      body.ready === true &&
      JSON.stringify(body.database) === JSON.stringify(database)
    );
  } catch {
    return false;
  }
}
export async function postgresControlBinary() {
  const require = createRequire(
    await realpath(resolve("node_modules/embedded-postgres/package.json")),
  );
  const binary = join(
    dirname(require.resolve("@embedded-postgres/windows-x64")),
    "../native/bin/pg_ctl.exe",
  );
  try {
    await access(binary);
  } catch {
    throw new Error("缺少 PostgreSQL 控制程序；请检查项目依赖与 .local/ 日志");
  }
  return binary;
}
async function runLogged(command: string, args: string[], prefix: string) {
  const stdout = await open(`${prefix}.stdout.log`, "w"),
    stderr = await open(`${prefix}.stderr.log`, "w");
  try {
    await new Promise<void>((done, reject) => {
      const child = spawn(command, args, {
        cwd: process.cwd(),
        windowsHide: true,
        stdio: ["ignore", stdout.fd, stderr.fd],
      });
      child.once("error", () =>
        reject(new Error(`命令无法执行，检查 ${prefix}.stderr.log`)),
      );
      child.once("exit", (code) =>
        code === 0
          ? done()
          : reject(
              new Error(
                `命令失败，检查 ${prefix}.stdout.log 与 ${prefix}.stderr.log`,
              ),
            ),
      );
    });
  } finally {
    await stdout.close();
    await stderr.close();
  }
}
export async function startLocal(port: number, build = false) {
  const root = process.cwd();
  const app = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  if (app.name !== "interview-practice")
    throw new Error("请在项目目录运行 scripts/start-local.ps1");
  await mkdir(join(root, ".local"), { recursive: true });
  const lockPath = join(root, ".local/start.lock");
  let lock;
  try {
    lock = await open(lockPath, "wx");
  } catch {
    throw new Error(
      "另一次启动正在进行；若上次异常退出，核对 .local/start.lock 内 PID 后清理锁文件再启动",
    );
  }
  try {
    await lock.writeFile(
      JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
    );
    const client = postgres(databaseUrl, {
      max: 1,
      connect_timeout: 3,
      onnotice: () => {},
    });
    let database: Awaited<ReturnType<typeof localDatabaseStatus>>;
    try {
      try {
        database = await localDatabaseStatus(client);
      } catch (error) {
        if (error instanceof Error && !("code" in error)) throw error;
        const target = new URL(databaseUrl);
        if (await portInUse(Number(target.port || "5432")))
          throw new Error(
            "数据库端口已有服务但连接失败；核对 DATABASE_URL，日志 .local/postgres.log，不会启动第二份数据库",
          );
        if (
          process.platform !== "win32" ||
          !["localhost", "127.0.0.1"].includes(target.hostname)
        )
          throw new Error(
            "数据库连接失败；请先启动配置的 PostgreSQL，再运行本入口",
          );
        const dataDirectory = join(root, ".local/postgres");
        try {
          await access(join(dataDirectory, "PG_VERSION"));
        } catch {
          throw new Error(
            "没有既有 .local/postgres；请按 README 配置数据库。启动不会初始化或导入个人数据",
          );
        }
        const options = await readFile(
          join(dataDirectory, "postmaster.opts"),
          "utf8",
        );
        const previousPort = options.match(/"?-p"?\s+"?(\d+)/)?.[1];
        if (previousPort !== (target.port || "5432"))
          throw new Error(
            "持久 PostgreSQL 原端口与 DATABASE_URL 不一致，请核对配置",
          );
        const binary = await postgresControlBinary();
        console.log("启动既有持久 PostgreSQL，日志 .local/postgres.log");
        await runLogged(
          binary,
          [
            "start",
            "-D",
            dataDirectory,
            "-l",
            join(root, ".local/postgres.log"),
            "-o",
            `-h 127.0.0.1 -p ${target.port || "5432"}`,
            "-w",
            "-t",
            "20",
          ],
          join(root, ".local/pg-start"),
        );
        database = await localDatabaseStatus(client);
      }
    } finally {
      await client.end();
    }
    if (await probeApplication(port, database)) {
      if (build)
        throw new Error(
          "应用已运行；请先正常停止本项目应用，再用 -Build 重建。已有服务继续运行",
        );
      console.log(`复用已有应用：http://localhost:${port}`);
      return { reused: true, port };
    }
    if (await portInUse(port))
      throw new Error(
        `应用端口 ${port} 已占用，或已有应用版本/数据库不匹配。检查 Get-NetTCPConnection -LocalPort ${port} 和 .local/ui-app.stderr.log；不会停止其他进程`,
      );
    const next = resolve("node_modules/next/dist/bin/next");
    let needsBuild = build;
    try {
      await access(".next/BUILD_ID");
    } catch {
      needsBuild = true;
    }
    if (needsBuild) {
      console.log(
        "构建生产应用，日志 .local/build.stdout.log 与 .local/build.stderr.log",
      );
      await runLogged(
        process.execPath,
        [next, "build"],
        join(root, ".local/build"),
      );
    }
    const stdout = await open(join(root, ".local/ui-app.stdout.log"), "w"),
      stderr = await open(join(root, ".local/ui-app.stderr.log"), "w");
    const child = spawn(
      process.execPath,
      [next, "start", "-H", "127.0.0.1", "-p", String(port)],
      {
        cwd: root,
        detached: true,
        windowsHide: true,
        stdio: ["ignore", stdout.fd, stderr.fd],
      },
    );
    let failed = false;
    child.once("error", () => {
      failed = true;
    });
    child.once("exit", () => {
      failed = true;
    });
    await stdout.close();
    await stderr.close();
    if (child.pid)
      await writeFile(
        join(root, ".local/ui-app.pid"),
        String(child.pid) + "\n",
      );
    child.unref();
    for (let attempt = 0; attempt < 40; attempt++) {
      if (await probeApplication(port, database)) {
        console.log(`应用已就绪：http://localhost:${port}，PID ${child.pid}`);
        return { reused: false, port, pid: child.pid };
      }
      if (failed) break;
      await new Promise((done) => setTimeout(done, 250));
    }
    throw new Error(
      "应用启动未通过健康检查；检查 .local/ui-app.stdout.log、.local/ui-app.stderr.log 和 .local/ui-app.pid，修复后重试",
    );
  } finally {
    await lock.close();
    await rm(lockPath);
  }
}
async function main() {
  const args = process.argv.slice(2);
  if (
    args.some(
      (arg, index) =>
        !["--build", "--port"].includes(arg) && args[index - 1] !== "--port",
    ) ||
    args.filter((arg) => arg === "--port").length > 1 ||
    args.filter((arg) => arg === "--build").length > 1
  )
    throw new Error("启动参数只支持 --port <端口> 与 --build");
  const portIndex = args.indexOf("--port");
  const value = portIndex < 0 ? "3000" : args[portIndex + 1];
  if (
    !value ||
    !/^\d+$/.test(value) ||
    Number(value) < 1 ||
    Number(value) > 65535
  )
    throw new Error("端口必须是 1–65535 的整数");
  await startLocal(Number(value), args.includes("--build"));
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/scripts/start-local.ts"))
  main().catch((error: unknown) => {
    console.error(
      error instanceof Error && !("code" in error)
        ? error.message
        : "本地启动失败，请核对数据库和 .local/ 日志",
    );
    process.exitCode = 1;
  });
