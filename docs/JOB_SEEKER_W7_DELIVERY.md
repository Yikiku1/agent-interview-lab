# W7：Windows 启动、完整备份恢复与可读导出

交付日期：2026-10-12（北京时间）。对应 [开发计划](JOB_SEEKER_DEVELOPMENT_PLAN.md) W7 / R09。W6 基线 `a5fa217` 已提交推送；本批次完成验证后按约定提交推送，实际 SHA 以 Git 为准。

## 使用入口

从项目目录运行：

```powershell
pwsh -NoProfile -File scripts/start-local.ps1
```

默认打开 `http://localhost:3000`。`-NoBrowser` 只启动 / 核对服务；`-Port 3001` 指定应用端口。需要新生产构建时先正常停止本项目应用，再执行 `-Build`；已有健康应用运行时不会覆盖它的构建文件。也可使用 `pnpm local:start`。

启动入口先加载与应用一致的 `.env*` / 显式 `DATABASE_URL` 并连接数据库，核对当前十六表和固定用户。配置的数据库已运行则复用；本机数据库未运行时，只允许启动已有 `.local/postgres`，要求原端口一致，通过安装的 PostgreSQL `pg_ctl` 等待就绪。不初始化目录、不删 PID 文件、不自动建表、迁移或导入题库；新安装仍先按 [README](../README.md) 完成数据库配置。

`GET /api/local-status` 返回服务标识、ready 与无凭证数据库身份；读取不会创建个人记录。启动入口核对服务及数据库身份再复用应用。应用端口被其他服务占用、版本不匹配、数据库连接失败、Schema 不完整、构建或启动失败分别显示原因与日志位置，不停止未知进程。应用只绑定 `127.0.0.1`，后台启动隐藏窗口，PID 保存到 `.local/ui-app.pid`。

启动锁 `.local/start.lock` 防止重复启动。若启动进程异常退出导致锁残留，先核对锁内 PID 确认该次启动已停止，再移除该锁文件；正常退出自动释放。日志在 `.local/postgres.log`、`pg-start.stdout.log` / `stderr.log`、`build.stdout.log` / `stderr.log`、`ui-app.stdout.log` / `stderr.log`。端口定位使用 `Get-NetTCPConnection -LocalPort 3000,5432`，再核对进程命令；PID 文件不是停止任意进程的依据。

## 完整备份

```powershell
pnpm local:backup
# pnpm wrapper 不可用时直接调用：
node --import tsx scripts/local-data.ts backup
node --import tsx scripts/local-data.ts backup --out D:/my-interview-backups
```

默认在 `.local/backups/` 创建带时间与随机后缀的新目录，不覆盖以前的备份。包格式 `agent-interview-lab-backup` v1：

| 文件            | 内容                                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `manifest.json` | UTC / 北京创建时间、应用版本、Git revision、PostgreSQL 版本、Schema / 全记录指纹、迁移清单、逐表数量、序列清单、文件 SHA-256 |
| `snapshot.json` | 实际 public Schema 的枚举、字段 / 类型 / 默认值 / 空值、约束、索引、序列定义 / 归属，以及十六表全记录和序列状态              |
| `restore.sql`   | 从上述 Schema 和数据生成的事务恢复 SQL，只用于空库                                                                           |

范围包含用户、公共题与停用题、进度 / 复习安排、正式 / legacy 事件及幂等身份、目标版本、个人卡、观察 / 要点 / 卡点、迁移 journal、模拟轮次 / 节点 / 请求、复盘 / 原话 / 关联基线 / 请求。保存全部字段与时间精度，不把当前版本 seed 或 Schema 替代原库实际内容。

备份短事务先取得与迁移相同的 advisory lock，再按稳定顺序对十六表取 SHARE 锁，已有写事务完成后读取所有记录和序列；普通写入短暂等待，避免备份记录和序列错位。锁等待上限 5 秒、单条语句上限 30 秒。只创建会话内空临时表，让 PostgreSQL 解析器统一 CHECK 表达形式，不修改公共 Schema 或业务记录。文件写入在数据库事务结束后执行，最后生成 manifest 才表示包完整。

此格式面向本项目 PostgreSQL 16 的单一 public Schema；不备份数据库账户 / 密码、角色权限、整个集群、`.env`、运行进程、应用源码或浏览器存储。发现缺表、额外表、视图 / 自定义函数 / 触发器 / RLS、生成字段、非支持对象或未归属序列时拒绝生成不完整包，应改用原生 PostgreSQL 备份。`.local/` 已写入 Git ignore，不提交个人资料。

## 恢复与核对

无参数只显示说明；指定包默认离线校验文件与清单，不连接数据库：

```powershell
pnpm local:restore
node --import tsx scripts/local-data.ts restore --from D:/my-interview-backups/backup-目录
```

实际恢复先建立独立空数据库，把连接明确放入 `RESTORE_DATABASE_URL`，再执行：

```powershell
$env:RESTORE_DATABASE_URL = 'postgres://用户:密码@127.0.0.1:5432/独立空库'
node --import tsx scripts/local-data.ts restore --from D:/my-interview-backups/backup-目录 --apply
Remove-Item Env:RESTORE_DATABASE_URL
```

目标不能与当前应用数据库同主机 / 端口 / 名称（localhost 与回环地址视为相同）；目标 public Schema 必须无表、类型或函数。恢复先校验包版本、SHA-256、数据数量、迁移清单、Schema / 数据指纹及 SQL 一致性，再在一个事务中建对象、写全部记录、补外键与恢复序列。事务内重新读取并严格比较规范化 Schema、十六表全字段和序列；不一致或约束失败整体回滚。成功在原备份目录添加唯一的 `restore-verification-*.json`，不自动改变应用连接。核对后如需使用恢复库，由本人修改 `.env` 并重启；既有库没有清表或覆盖入口。

包中的 `restore.sql` 可直接在空库执行，已验证其完整恢复行为；推荐公开 CLI，因为它先校验包并比较恢复结果。JSON / SQL 中包含本人记录，应自行保存在合适位置。

## 可读导出

```powershell
pnpm local:export
node --import tsx scripts/local-data.ts export --out D:/my-interview-exports
```

默认在 `.local/exports/` 创建新目录，生成 `practice.json` 与 `practice.md`。二者按十六表保存全部字段，可检索原回答、卡点、项目模拟和面试原话；Markdown 用 JSON 代码块保留中文、换行、空值及内嵌代码围栏。导出明确 `recoverableBackup=false`，缺少 Schema、约束与序列，不能替代完整恢复包。

浏览器未保存的普通回答、续练位置、个人卡 / 自查 / 模拟 / 复盘编辑仍留在当前浏览器，不包含在服务端备份或导出中；已保存资料包含。导出与备份不生成 practice 事件、不修改掌握状态、次数、复习安排或个人字段。

## 验证结果

2026-10-12：58/58 单元、84/84 独立 PostgreSQL 集成、TypeScript、ESLint、PowerShell 语法和 Next.js 16.3.6 生产构建通过。新增 2 项单元、11 项集成覆盖：

- 已升级库与 `db:push` 新库的实际 Schema，枚举 / 默认值 / 约束 / 索引、所有个人表、停用题、中文 / null / 换行 / 微秒、四序列原状态和续号。
- 独立空库恢复、单独 SQL 恢复、现有库拒绝、无效记录事务回滚、损坏包 / 不符清单 / 新版本拒绝、额外表与未归属序列拒绝。
- 创建唯一备份目录、离线恢复检查、显式目标 / 同库保护、公开备份 / 恢复 / 导出 CLI、可读围栏保留、源库前后相同、并发正式写入后的记录 / 序列一致。
- 健康服务复用、错误数据库身份与陌生端口拒绝、启动锁、构建 / 应用启动失败和日志、pnpm 实际路径解析。

一次全量测试遇到 Windows EBUSY：embedded-postgres 在 stop 内先无重试删目录，绕过了 helper 原重试。已改由 helper 统一负责目录清理，数据库仍正常停止；最终 84 项通过，失败遗留目录已核对停止状态后清理。此变更只影响独立测试库。

最终启动代码还通过新增构建 / 启动失败路径的 11 项专项集成回归。成功日志在 `D:/CodexHome/visualizations/2026/10/12/agent-interview-w7/`：`unit-test.log`、`db-test.log`、`backup-runtime-test.log`、`build.log`、`lint.log`。

已实际执行个人库公开备份、JSON / Markdown 导出，并用公开恢复 CLI 在独立空库恢复：规范化 Schema、十六表全字段、四个序列严格相同，个人原库不变。证据与完整包：`.local/backups/job-seeker-w7-20261012/backup-2026-10-12T07-41-10-042Z-SaeS3W/`，含 `personal-rehearsal.json`、恢复 CLI 验证和 `runtime-verification.json`；可读文件在 `.local/exports/job-seeker-w7-20261012/export-GKX0f2/`。此包覆盖备份时全部已保存资料，之后新增记录应重新运行备份。

本项目应用与持久 PostgreSQL正常停止后，`scripts/start-local.ps1 -NoBrowser` 成功冷启动原库和最终应用；重复执行直接复用，错误数据库凭证明确拒绝且不多启服务。应用 3000（PID 23356）、PostgreSQL 5432（PID 19532）运行，stderr 为空。14 项个人 HTTP / 健康检查通过：原入口、模拟、复盘及新健康 API；原数据和全部四序列与完整备份前后一致，仍 1 用户、670 启用题、13 进度、14 事件、三条迁移，新增业务表为空、无目标。没有个人 seed、迁移、`db:push` 或验收写入。

本批次无新交互页面，未重跑 W6 浏览器验收；W6 的 16 项交互结果保留原日期和范围。W7 以真实命令、独立库恢复和生产 HTTP 验证启动 / 数据工具，不将只读健康检查代替页面交互验收。

2026-10-12 收尾：本批源码 / 文档格式、7 份文档 126 个本地链接与 Git 差异检查通过。两个临时核对脚本已清理；成功日志、核对 JSON、个人完整恢复包和可读导出保留。最终健康 API 返回 ready 与十六表，按约定提交推送。

## 下一步

W0–W7 已完成。W8 只按本人连续使用暴露的需求评估 JD、AI 反馈或语音，不自动引入模型、评分或录音；本轮不进入 W8。备份格式变化应使用新版本，不改写冻结迁移；新增 Schema 对象后扩展备份范围并重新做恢复验证。
