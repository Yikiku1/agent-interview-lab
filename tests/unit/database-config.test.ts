import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { test } from "node:test";

test("CLI config loads .env and keeps explicitly provided environment variables", () => {
  const folder = mkdtempSync(join(tmpdir(), "interview-config-"));
  try {
    const fileUrl = "postgres://file:file@localhost:15432/from_file";
    writeFileSync(join(folder, ".env"), `DATABASE_URL=${fileUrl}\n`);
    const env = { ...process.env };
    delete env.DATABASE_URL;
    delete env.__NEXT_PROCESSED_ENV;
    env.NODE_ENV = "test";
    const code = `console.log(require(${JSON.stringify(resolve("src/db/config.ts"))}).databaseUrl)`;
    const args = [
      "--import",
      pathToFileURL(resolve("node_modules/tsx/dist/loader.mjs")).href,
      "-e",
      code,
    ];
    const fromFile = spawnSync(process.execPath, args, {
      cwd: folder,
      env,
      encoding: "utf8",
    });
    assert.equal(fromFile.status, 0, fromFile.stderr);
    assert.equal(fromFile.stdout.trim(), fileUrl);
    const explicitUrl = "postgres://env:env@localhost:15433/from_env";
    const fromEnv = spawnSync(process.execPath, args, {
      cwd: folder,
      env: { ...env, DATABASE_URL: explicitUrl },
      encoding: "utf8",
    });
    assert.equal(fromEnv.status, 0, fromEnv.stderr);
    assert.equal(fromEnv.stdout.trim(), explicitUrl);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
