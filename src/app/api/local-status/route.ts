import { databaseClient } from "@/db";
import { localDatabaseStatus } from "@/db/local-status";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return Response.json(
      {
        service: "agent-interview-lab",
        version: 1,
        ready: true,
        database: await localDatabaseStatus(databaseClient),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        service: "agent-interview-lab",
        version: 1,
        ready: false,
        error: "数据库连接或 Schema 检查失败，请查看本地日志",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
