import type { Sql } from "postgres";
import { backupTables } from "./local-backup";

export async function localDatabaseStatus(client: Sql) {
  const [identity] =
    await client`select current_database() as name, inet_server_port() as port, inet_server_addr()::text as address`;
  const [tables] =
    await client`select count(*)::int as n from pg_tables where schemaname='public' and tablename in ${client([...backupTables])}`;
  if (tables.n !== backupTables.length)
    throw new Error(
      "数据库 Schema 不完整，请核对 W0/W5/W6 升级记录；启动不会自动迁移",
    );
  const [user] =
    await client`select exists(select 1 from users where id='default') as present`;
  if (!user.present)
    throw new Error(
      "缺少 default 用户，请核对当前数据库；启动不会自动导入题库",
    );
  return {
    name: String(identity.name),
    port: Number(identity.port),
    address: String(identity.address),
    tables: tables.n,
  };
}
