import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import EmbeddedPostgres from "embedded-postgres";
import postgres from "postgres";

export async function startTestDatabase(
  options: { pushSchema?: boolean } = {},
) {
  const folder = await mkdtemp(join(tmpdir(), "interview-postgres-"));
  const server = createServer();
  const port = await new Promise<number>((resolvePort, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string")
        return reject(new Error("No test port"));
      server.close(() => resolvePort(address.port));
    });
  });
  const pg = new EmbeddedPostgres({
    databaseDir: join(folder, "data"),
    port,
    user: "interview",
    password: "test-only",
    persistent: false,
    initdbFlags: ["--encoding=UTF8"],
    postgresFlags: ["-h", "127.0.0.1"],
    onLog: () => {},
    onError: () => {},
  });
  let started = false;
  try {
    await pg.initialise();
    await pg.start();
    started = true;
    const admin = postgres(
      `postgres://interview:test-only@127.0.0.1:${port}/postgres`,
    );
    try {
      await admin.unsafe("CREATE DATABASE interview_test");
    } finally {
      await admin.end();
    }
    const url = `postgres://interview:test-only@127.0.0.1:${port}/interview_test`;
    if (options.pushSchema !== false)
      await new Promise<void>((resolvePush, reject) => {
        const child = spawn(
          process.execPath,
          [resolve("node_modules/drizzle-kit/bin.cjs"), "push", "--force"],
          {
            cwd: process.cwd(),
            env: { ...process.env, DATABASE_URL: url },
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
        let output = "";
        child.stdout.on("data", (chunk) => {
          output += chunk;
        });
        child.stderr.on("data", (chunk) => {
          output += chunk;
        });
        child.on("error", reject);
        child.on("exit", (code) =>
          code === 0 ? resolvePush() : reject(new Error(output)),
        );
      });
    return {
      url,
      stop: async () => {
        await pg.stop();
        await rm(folder, { recursive: true, force: true });
      },
    };
  } catch (error) {
    if (started) await pg.stop();
    await rm(folder, { recursive: true, force: true });
    throw error;
  }
}
