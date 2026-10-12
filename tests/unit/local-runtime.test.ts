import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createServer } from "node:http";
import { access } from "node:fs/promises";
import {
  portInUse,
  probeApplication,
  postgresControlBinary,
} from "../../scripts/start-local";

const database = { name: "test", port: 5432, address: "127.0.0.1", tables: 16 };
const server = createServer((_request, response) => {
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(body));
});
let body: unknown = {};
let port: number;
after(async () => {
  await new Promise<void>((done) => server.close(() => done()));
});
test("startup recognizes only a ready matching application database and never treats an occupied foreign port as reusable", async () => {
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  port = address.port;
  assert.equal(await portInUse(port), true);
  assert.equal(await probeApplication(port, database), false);
  body = { service: "agent-interview-lab", version: 1, ready: true, database };
  assert.equal(await probeApplication(port, database), true);
  body = {
    service: "agent-interview-lab",
    version: 1,
    ready: true,
    database: { ...database, name: "other" },
  };
  assert.equal(await probeApplication(port, database), false);
  body = { service: "agent-interview-lab", version: 1, ready: false, database };
  assert.equal(await probeApplication(port, database), false);
  server.closeAllConnections();
  await new Promise<void>((done) => server.close(() => done()));
  assert.equal(await portInUse(port), false);
});
test(
  "Windows PostgreSQL control binary resolves through the installed pnpm package real path",
  { skip: process.platform !== "win32" },
  async () => {
    const binary = await postgresControlBinary();
    assert.ok(binary.endsWith("pg_ctl.exe"));
    await access(binary);
  },
);
