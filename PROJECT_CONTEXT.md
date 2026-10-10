# 面试训练台：项目状态与开发交接

最后更新：2026-10-10（北京时间）。工作目录：`D:\projects\agent-interview-lab`。

本文是持续维护的项目状态入口。接手开发、排查问题或整理题库时先读本文，再读涉及模块。源码、实际探针和检查结果决定当前事实；历史交付记录用于追溯，计划不等于已实现。

长期维护入口是 [AGENTS.md](AGENTS.md) 的“项目长期上下文”：每次本项目任务开始读取本文，收尾核对并同步本次变化。全局长期记忆仅保存本项目路径和维护约定，具体状态集中在本文。

## 当前结论

项目已具备个人面试学习闭环：找题、分轮作答、自评、保存历史、恢复续练、到期复习和今日推荐。2026-10-09 的 100 道简历专项题、需求与开发计划已在 `bb1996d` 提交并推送。W0 已完成 [数据与兼容契约](docs/JOB_SEEKER_W0_CONTRACT.md)、请求校验、首期 Schema、增量迁移和独立库验证；下一开发批次是 W1。2026-10-09 [答案质量检查](docs/ANSWER_QUALITY_AUDIT.md)发现篇幅不足、模板重复和部分例子偏题；2026-10-10 已完成 [670 题答案修订与导入](docs/ANSWER_QUALITY_REVISION.md)，补充完整短答、逐题机制和示例。短答起草范围检查通过，未做真人计时。W1–W8 尚未实施，个人库未迁移 W0，W0 与答案修订改动保留未提交。

本项目用于训练 Agent / LLM 应用开发面试；当前应用本身没有接入模型、自动评卷或 Agent 执行服务。使用固定 `default` 用户，个人本地使用，尚未实现登录和跨设备草稿同步。

| 项目     | 本次核实状态                                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------------------- |
| Git 基线 | `main`，HEAD 为 `bb1996d`；2026-10-09 已推送并核对远端 SHA。W0、答案审查与修订改动未提交、未推送                    |
| 题库     | 源码和个人 PostgreSQL 均为 670 道启用题，7 个分类；原 570 题加 100 道简历专项题，保留 70 道基础题和 30 道精修核心题 |
| 实际数据 | 2026-10-10 答案导入及 HTTP 检查前后：1 个用户、13 条进度、14 条历史事件全字段保留；后续练习会改变                   |
| 数据库   | 个人库 `interview_practice`，`127.0.0.1:5432`，持久目录 `.local/postgres`；只核实地址与数据库名，不记录凭证         |
| 应用     | 2026-10-10 新生产构建启动成功，15 项 HTTP / 服务端内容检查通过，运行于 3000；没有新增浏览器交互验收                 |
| 本次工作 | 670 道答案已修订并事务导入；备份恢复和独立库试导入通过，题目身份与个人记录保留；个人库仍是原四表                    |

## 功能与产品约定

| 功能       | 当前行为与边界                                                                                                 |
| ---------- | -------------------------------------------------------------------------------------------------------------- |
| 题库       | 按题干关键词、分类、难度、状态筛选与分页；详情展示 Markdown 答案、标签和历史。搜索目前只匹配题干               |
| 手动练习   | 顺序、随机、薄弱、到期四种模式；每轮 10 / 20 题，不足时使用实际数量                                            |
| 今日推荐   | 最多 10 题，依次取到期复习、正式练过的薄弱题、核心新题，去重；排除北京时间当天已正式完成的题                   |
| 核心学习   | 固定 30 题，顺序为 LLM → Python → 后端 → 数据库 → RAG → LLM 应用工程 → Agent；展示短答、要点，深入内容按需展开 |
| 自评与完成 | 仅修改不会 / 模糊 / 掌握不算练习；“完成本题”保存回答和自评，增加次数并安排复习。口头或空白文字也可完成         |
| 分轮与续练 | URL 保存本轮 ID、固定队列、当前题目与总结状态；刷新和继续保留顺序。停用题跳过，新一轮重新选题                  |
| 回答草稿   | 按本轮与题目保存在当前浏览器；切题、返回、刷新可恢复，完成后的新一轮不复用旧回答                               |
| 提交恢复   | 暂时失败保留 `attemptId` 和回答重试；确定失败可恢复编辑并生成新 ID；成功响应丢失后从服务器完成记录恢复         |
| 轮次总结   | 一轮同题重复完成时只展示最新已保存自评；累计次数按真实完成事件计。支持提前结束、继续未完成和重练薄弱题         |
| 复习       | 不会 1 天、模糊 3 天并重置掌握阶段；连续掌握按 1 / 3 / 7 / 14 天，之后保持 14 天                               |
| 界面       | 中文优先、中性色与低饱和青绿色、浅深主题、移动端单列，适合长时间阅读                                           |

今日推荐的“核心新题”仅来自 30 道核心路径。普通新增题进入题库和手动练习；正式练过后可进入薄弱巩固或到期推荐，不自动成为核心新题。

## 架构与定位入口

技术栈是 Next.js 16.3.6 App Router、React 19、TypeScript strict、Tailwind 4、Drizzle ORM、PostgreSQL。版本与命令以 `package.json` 和锁文件为准。Server Components 读取数据；API Route 处理状态修改与正式提交。

| 入口                                                                                                                       | 职责                                                                             |
| -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/app/page.tsx`                                                                                                         | 首页统计、推荐入口和继续练习                                                     |
| `src/app/questions/`                                                                                                       | 题库与详情；`src/app/practice/`、`review/`、`stats/` 分别提供练习、复习和统计    |
| `src/lib/questions.ts`                                                                                                     | 题目筛选、选题、统计与历史查询；只返回启用题                                     |
| `src/lib/daily-practice.ts`、`daily-practice-query.ts`                                                                     | 推荐纯逻辑与数据库取候选；统一请求时间与北京时间日界线                           |
| `src/lib/practice-session.ts`                                                                                              | 模式、固定队列、位置、续练 URL 与总结                                            |
| `src/lib/practice-draft.ts`                                                                                                | 草稿、提交 ID、异常和恢复契约                                                    |
| `src/lib/review-schedule.ts`                                                                                               | 复习间隔、连续掌握阶段与日期展示                                                 |
| `src/components/practice/`                                                                                                 | 作答、自评、保存、轮次总结与交互恢复                                             |
| `src/components/question/`                                                                                                 | 列表、筛选、掌握状态、普通 Markdown 与核心分层答案                               |
| `src/app/api/progress/route.ts`                                                                                            | `PUT /api/progress`，只更新掌握状态                                              |
| `src/app/api/attempts/route.ts`                                                                                            | `POST /api/attempts`，事务内写正式事件、次数与复习安排                           |
| `src/db/schema.ts`                                                                                                         | 数据结构；`config.ts` 统一环境加载；`index.ts` 为网页数据库连接                  |
| `src/lib/learning-contract.ts`                                                                                             | W0 预设、范围元数据、目标 / 个人卡 / 作答观察的严格请求校验；W1–W3 待接入        |
| `scripts/audit-answer-quality.ts`                                                                                          | 全量答案字符、口头时长粗筛、重复段落及可选数据库只读比对；不自动评分、不修改答案 |
| `src/db/answer-quality.ts`                                                                                                 | 短答计数与起草范围、有效讲解和示例校验；由 seed 与审查脚本共用                   |
| `src/db/migrate-learning-foundation.ts`、`migrate-learning-foundation-cli.ts`、`migrations/0001_job_seeker_foundation.sql` | W0 事务增量迁移、版本 checksum 与默认只显示说明的 CLI；未在个人库执行            |
| `src/db/seed-data.ts`、`seed-bank.ts`、`seed.ts`                                                                           | 汇总题目、导入校验与事务、CLI 入口                                               |
| `src/db/basic-questions.ts`                                                                                                | 70 道基础题                                                                      |
| `src/db/core-path.ts`、`core-answers.ts`、`learning-content.ts`                                                            | 核心题轻量身份顺序、内容、Markdown 生成；保持单一内容来源                        |
| `src/db/expansion-*.ts`、`seed-notes.ts`、`seed-context.ts`、`original-examples.ts`                                        | 岗位场景、逐题机制与示例、明确标为补充的共享背景；旧 `answer-examples.ts` 已移除 |
| `tests/unit/`、`tests/integration/`、`tests/helpers/postgres.ts`                                                           | 纯逻辑回归、真实数据库契约与独立临时数据库                                       |

简历题入口：`src/db/resume-questions.ts` 汇总，`resume-content.ts` 管理来源与结构，`resume-agent.ts`、`resume-rag.ts`、`resume-engineering.ts`、`resume-foundations.ts` 保存具体内容；[整理与导入说明](docs/RESUME_QUESTION_BANK.md)。

## 数据与不能破坏的契约

当前个人数据库有 `users`、`questions`、`user_question_progress`、`review_events` 四张表。W0 的源码 Schema 另定义五张首期业务表 `learning_targets`、`personal_answer_cards`、`practice_observations`、`answer_point_checks`、`practice_gaps` 与 `app_schema_migrations` 版本表；在独立库验证，尚未迁移个人库。新表具体字段和请求契约见 [W0 契约](docs/JOB_SEEKER_W0_CONTRACT.md)。

- 题干是种子更新的唯一键；按题干 upsert 保留题目 ID。改已有题干会产生另一道题，涉及身份变更时单独设计迁移。
- 答案导入前检查普通短答 120–180、简历短答 240–270 个有效字符，并要求有效讲解与具体示例；这是按既有时长目标的起草范围，不是实际朗读认证。标题、标点、URL 与代码块不计入有效短答字数。
- 停用用 `active=false`，历史事件和进度保留。外键使用 restrict，避免删除带练习记录的题。
- `review_events.kind=practice` 才表示正式完成；`legacy` 是旧版标记记录，保留历史计数语义。
- `attemptId` 按用户唯一；同 ID、同内容重试不重复写，同 ID、不同内容或本轮 ID 返回 409。
- 不同提交并发完成同题时按进度行锁串行更新；事件、进度、次数和安排在一个事务里完成。
- 回答上限 10,000 字符；空白按口头作答保存。网页读取、推荐计算和打开练习不写完成事件。
- `next_review_at=null` 表示未建立安排。手动到期模式兼容待首次练习；今日推荐的到期来源要求明确到期时间。
- 原有固定队列、草稿隔离和恢复不能因新增题库内容改变。
- 新目标按用户只允许一个 active，旧配置保留；卡片与观察不写正式事件。观察事件归属使用复合外键，关联 practice 类型仍需后续服务端验证。
- 原四表库升级 W0 使用版本化增量迁移，不能用 `db:push` 绕过记录；新空库继续用 `db:push` 建完整 Schema。导入模块和默认迁移命令都不执行迁移，W1 启用前按契约完成备份恢复演练。

## 开发习惯与完成方式

面向用户使用简体中文，先给影响与结论，命令和技术标识保持英文。终端优先 `pwsh`；搜索优先 `rg`，独立读取和查询批量执行。具体规则遵循当前用户指令及生效的 `AGENTS.md`，`CLAUDE.md` 仅为兼容引用。

1. 开始时检查 Git 与真实运行状态，读本文及相关模块。已有个人进度和未提交改动要保留。
2. 涉及 Next.js 时先读安装版本 `node_modules/next/dist/docs/` 的对应文档，再改实现，特别留意异步参数与缓存约定。
3. 用户已授权的工作持续推进到可检查结果。2026-10-09 本次用户要求先推送现有基线，再开发 W0；先提交并推送简历题库及计划文档，W0 完成后保留工作区供审查，不自动继续推送。
4. 使用现有样式变量和组件，保留中文阅读、移动端、主题、键盘操作与错误恢复。内容变更优先复用现有题库机制。
5. 验证与风险相称：内容和可逆小改动无需为了覆盖实现而新增测试；涉及数据持久化、提交、恢复、推荐或选题时运行对应契约回归。
6. 数据库集成测试使用独立临时 PostgreSQL，结束时清理，不在个人库造测试记录。个人库导入前保存可恢复备份，之后核实原题 ID、用户、进度和历史。
7. 检查通过后，只有新变更、失败或疑点才重复或扩大检查。收尾清理本次无用临时文件，保留交付文档、必要证据和恢复备份。
8. 每次任务按 `AGENTS.md` 的长期上下文约定维护本文；重大交付另留 `docs/` 记录并在本文链接，不重复维护完整长答案。

## 启动与验证

通常按 README 使用 pnpm；Windows 上 wrapper 有问题时，直接调用项目依赖的 Node 入口。环境加载集中在 `src/db/config.ts`，显式 `DATABASE_URL` 优先于 `.env*`。不要把真实密码写入文档。

```powershell
pnpm dev
pnpm db:seed
pnpm test
pnpm test:db
pnpm lint
pnpm build
```

直接入口：

```powershell
node --import tsx src/db/seed.ts
node --import tsx src/db/migrate-learning-foundation-cli.ts
node --import tsx --test tests/unit/*.test.ts
node --conditions=react-server --import tsx --test tests/integration/*.test.ts
node node_modules/eslint/bin/eslint.js
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next build
node node_modules/next/dist/bin/next start
git diff --check
```

本机复用 `.local/postgres` 中的持久数据。相关日志是 `.local/postgres.log`、`.local/ui-app.stdout.log` 和 `.local/ui-app.stderr.log`；PID 文件用于定位，不应直接假定旧 PID 仍对应原进程。重启前核对端口与进程命令。更改生产代码后需重新 build / start；单纯导入题目由数据库驱动的动态页面读取。

## 验证记录与开发进度

2026-10-09：按用户要求，将每次任务读取与收尾同步本文的约定写入项目 `AGENTS.md`，并保存长期记忆更新备注。`CLAUDE.md` 继续只引用 `AGENTS.md`。本次仅修改文档，验证格式和文档入口；没有重跑应用测试或更新运行快照。

2026-10-09（北京时间）：按用户要求从求职者角度完成 [需求分析](docs/JOB_SEEKER_REQUIREMENTS.md)，记录 10 项需求的场景、优先级、首版范围与验收条件。建议首期实施简历入口、短轮与路径推荐、简历答案分层、个人回答卡和卡点补练；模拟追问、面试复盘及进度变化随后推进。这里只完成分析，未修改功能或个人数据，未决定工期。

2026-10-09（北京时间，W0 开发前）：根据需求分析整理 [求职者训练闭环开发计划](docs/JOB_SEEKER_DEVELOPMENT_PLAN.md)，将 R01–R10 拆为 W0–W8 批次，明确首期范围、建议数据结构、固定队列与 attemptId 契约、验收场景、验证方式和实施前决策门。当时只完成计划文档，未修改页面、接口、Schema 或个人数据；各批次当时待实施，不代表工期承诺。

| 阶段                           | 状态         | 证据                                                                                                                                            |
| ------------------------------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 初始面试训练平台               | 已提交       | `d723848`（2026-10-04）                                                                                                                         |
| 练习可靠性、学习界面与计划     | 已提交       | `8924e3a`（2026-10-08）；具体行为以当前源码为准                                                                                                 |
| 今日推荐、分层核心题与自评说明 | 已交付       | `9037f0c`（2026-10-08），[交付记录](docs/LEARNING_EFFICIENCY_DELIVERY.md)                                                                       |
| 项目状态入口                   | 已完成       | 本文、README 与 AGENTS 入口                                                                                                                     |
| 简历专项题                     | 已导入       | 100 题、300 个追问，P0 63 / P1 32 / P2 5；题库总数 670，[整理与导入说明](docs/RESUME_QUESTION_BANK.md)                                          |
| 求职者视角产品需求             | 已分析       | [需求文档](docs/JOB_SEEKER_REQUIREMENTS.md)；R01–R10 均为新增需求建议，尚未实施                                                                 |
| 求职者训练闭环开发计划         | 部分交付     | [开发计划](docs/JOB_SEEKER_DEVELOPMENT_PLAN.md)；W0 已完成，W1–W8 待实施，未承诺工期                                                            |
| W0 数据与兼容契约              | 已验证       | [W0 交付](docs/JOB_SEEKER_W0_CONTRACT.md)；校验器、Schema、增量迁移、独立库回归；个人库未迁移，改动未提交                                       |
| 答案长度与清晰度               | 已修订并导入 | 2026-10-10 [交付报告](docs/ANSWER_QUALITY_REVISION.md)、[670 题修订明细](docs/ANSWER_QUALITY_REVISION_DETAILS.json)；篇幅粗筛通过，保留个人数据 |

2026-10-08 的交付记录报告：28 项单元测试、16 项数据库集成测试通过，ESLint、TypeScript、生产构建通过；Chrome + Playwright 39 项检查通过，意外浏览器错误为 0。这些是上次交付的历史结果，本次开始时未重新运行，不能替代后续改动验证。

2026-10-09 本次新验证：28 / 28 单元测试、16 / 16 独立 PostgreSQL 集成测试、ESLint 与 TypeScript 通过。题目总数和各分类数量、题干唯一性、内容来源与完整性已核对。个人库导入前备份在独立库实际恢复，四表比对通过；原 570 道题 ID 和内容、导入前 1 个用户、9 条进度、10 条事件保留。种子 upsert 按原机制更新题目的 `updated_at`。

网页 HTTP 与服务端输出检查共 12 项通过：全部题库 670、简历搜索 100、P0 搜索 63、七分类样例详情的八个答案部分，以及专项 10 / 20 题固定队列。检查未创建个人练习事件。浏览器自动控制返回 `unsupported Codex auth method: apikey`，本次未重跑点击交互、截图或视觉验收；也未重跑生产构建。当前前端、API 与 Schema 没有改变，动态页面直接读取导入后的数据库内容。

本次备份与验证位于 `.local/backups/resume-question-bank-20261009/`：`records-before.json`、`restore-records.sql`、`verification.json`、`http-verification.json`。恢复 SQL 用于原 Schema 的数据恢复，含清表操作；本次只在独立库执行。`.local/` 通过当前 checkout 的 `.git/info/exclude` 忽略，不进入 Git；新 checkout 需要核对自己的忽略设置。历史个人备份位于 `.local/backups/learning-efficiency-20261008/`，其中恢复验证见历史交付记录。

开始本次工作时个人数据为 3 条进度、4 条事件，导入前已变为 9 / 10；按导入前快照判断保留情况，避免混用不同时间点。

2026-10-09 需求分析核对范围：相关页面、筛选、今日推荐、简历内容结构、总结、统计及 Schema；首页、简历搜索、练习设置、统计页 HTTP 均为 200，并核对服务端内容。确认当前缺少简历专题筛选、目标配置、长期个人回答卡、具体卡点和模拟追问流程。该检查不是浏览器点击验收；个人练习计数是动态快照，不因需求分析重写导入记录。文档格式、链接目标与 `git diff --check` 检查通过；没有为本次文档变更重跑应用测试或构建。

2026-10-09（北京时间）W0 新验证：35 / 35 单元测试、21 / 21 独立 PostgreSQL 集成测试、ESLint、TypeScript（生产构建内）和 Next.js 生产构建通过。新增 7 项单元与 5 项集成测试；集成覆盖四表基线的全记录保留、并发 / 重复迁移、DDL 失败回滚、checksum 冲突、目标版本与唯一性、观察归属、历史要点快照、seed 保留五张个人表；原 16 项数据库契约也通过。新库建表的复合外键顺序问题已修复为表级 UNIQUE，原 attemptId 索引和提交逻辑未改变。

W0 生产服务已用新构建重启（PID 17764；后续须核实实时进程），日志继续为 `.local/ui-app.stdout.log` / `.local/ui-app.stderr.log`。七个原有入口 HTTP 均为 200，服务端 stderr 为空；重启前后只读核对个人库为原四表、670 道启用题、1 个用户、13 条进度、14 条事件。W0 未执行个人库迁移、seed 或测试写入；本次没有页面 / 交互改动，没有重跑浏览器点击或视觉验收，HTTP 验证不代表浏览器交互测试。

2026-10-09（北京时间）答案审查历史验证：全量统计 670 道答案并只读比对个人数据库，启用题数量、题干与答案一致。旧普通短答 26–70、简历短答 88–137 个有效文字字符；按用户选定的 30–60 / 60–90 秒目标，以每秒 3–4 字符作筛查，670 段均低于 90 / 180 下限，未做真人计时。完整讲解定向抽查 18 题、另检查 25 题简历要点，确认 Few-shot 示例偏题、部分要点只有作答要求等问题。327 道扩展题共享工程说明和示例，143 道原题共用六段分类级岗位验证。脚本执行、TypeScript、针对脚本的 ESLint、文档与差异检查通过；该次只审查，没有修改答案、Schema、页面或个人数据，没有重跑构建或写入测试。问题已在 2026-10-10 修订。

2026-10-10（北京时间）答案修订新验证：全部 670 道答案已改写并导入，原普通题 143、扩展题 327、基础题 70、核心题 30、简历题 100。普通短答 125–180、简历短答 240–270 个有效字符，全部处于 120–180 / 240–270 起草范围，未做真人计时。补充逐题机制与具体例子，原分类级验证删除，共享背景标为补充；按脚本同标题和相同正文规则检查，列出的主讲解与示例标题重复组为 0，共享主题背景仍有 124 组、437 题。详见 [交付与逐题明细](docs/ANSWER_QUALITY_REVISION.md)。

本次 38 / 38 单元测试、21 / 21 独立 PostgreSQL 集成测试、ESLint、`tsc --noEmit`、Next.js 16.3.6 生产构建及差异检查通过。答案校验在数据库写入前拦截不完整内容，新增 3 项单元测试验证字符口径、短答范围和讲解 / 示例缺失。全量源码与个人库逐题答案一致，未修改题干与题目身份。

备份位于 `.local/backups/answer-revision-20261010/`：`source-before.json`、`records-before.json`、`restore-records.sql`、`verification.json`、`http-verification.json`。在独立库实际恢复原四表全记录并试导入，通过后个人库事务更新 670 个答案。题目 ID、题干、分类、子分类、难度、标签、active、创建时间保留，updated_at 与 sequence 按既有 upsert 更新；1 用户、13 进度、14 历史事件全字段保留。个人库未执行 W0 迁移，无测试练习事件。

新生产应用已启动于 3000（本次核实 PID 18156），PostgreSQL 5432（PID 24892）；后续接手仍按端口和进程核实。15 项只读 HTTP / 服务端内容检查通过：首页、全部题库、简历与 P0 搜索、练习设置、固定十题队列、复习、统计，以及 6 个重点答案详情和核心练习页服务端内容。HTTP 均为 200，stderr 为空；检查前后四表记录逐字段一致。本次没有修改页面交互，未新增浏览器点击或视觉验收。

## 后续事项与已知限制

答案修订已完成；后续按实际练习朗读调整语速和表达，并用本人代码、日志或脱敏材料补具体字段和个人故事。字数、完整段落与自动重复检查不能代替语义审阅和真实口头表达验收。

本次项目状态入口与简历专项题已完成。后续先使用 [简历题库](http://localhost:3000/questions?search=%E7%AE%80%E5%8E%86) 或 [P0 练习](http://localhost:3000/practice/session?search=%E7%AE%80%E5%8E%86%20P0&mode=sequential&size=10)，按实际答题情况补充个人例子和遗漏知识。题目依据本次指定简历；本次没有重新验证 VendorGuard 或实习代码，参考设计不扩大为本人履历。

下一阶段建议见 [求职者需求分析](docs/JOB_SEEKER_REQUIREMENTS.md)：首期为 R01 简历与项目入口、R03 简历分层答案、R04 个人回答卡、R05 具体卡点与补练，配套 R02 的预设路径与 3 / 5 题短轮、R07 的范围覆盖。第二期再做模拟面试、真实面试复盘与回答变化统计；一键启动与备份可独立交付。JD、AI 反馈、语音按实际使用需求选择；登录与云同步暂不列为个人近期重点。这些是推荐顺序，不是已批准的实施计划，当前全部尚未实现。

具体批次见 [求职者训练闭环开发计划](docs/JOB_SEEKER_DEVELOPMENT_PLAN.md)，W0 已交付；实际字段、接口语义、统计口径、默认预设与迁移步骤以 [W0 契约](docs/JOB_SEEKER_W0_CONTRACT.md) 为准。下一批次实施 W1，先完成个人库备份恢复演练并执行受控迁移，再接入共享条件、目标事务接口与 3 / 5 题流程。W0 校验器和 Schema 不代表新接口或页面已上线。

现有局限：所有访问者共享 `default` 用户；草稿和续练入口依赖当前浏览器存储；核心路径固定；普通新增题不会自动成为核心新题；应用需本地 PostgreSQL。历史浏览器验收覆盖 Chrome 桌面与模拟手机，未验证 Safari、Firefox 或实体手机。

## 文档导航

- [README](README.md)：使用、安装、数据模型和常用命令。
- [AGENTS](AGENTS.md)：项目开发入口与 Next.js 安装版本规则。
- [学习效率交接计划](docs/LEARNING_EFFICIENCY_PLAN.md)：原计划及产品约定，已标注交付。
- [学习效率交付记录](docs/LEARNING_EFFICIENCY_DELIVERY.md)：2026-10-08 的验证、截图和备份证据。

- [简历题库整理与导入](docs/RESUME_QUESTION_BANK.md)：2026-10-09 的内容范围、练习入口、能力边界及个人数据保留验证。
- [求职者视角产品需求](docs/JOB_SEEKER_REQUIREMENTS.md)：2026-10-09 的现状分析、10 项需求、验收条件与推荐交付顺序；新增需求尚未实施。
- [求职者训练闭环开发计划](docs/JOB_SEEKER_DEVELOPMENT_PLAN.md)：2026-10-09 的 W0–W8 实施拆分；W0 完成，W1–W8 待实施。
- [W0 数据与兼容契约](docs/JOB_SEEKER_W0_CONTRACT.md)：实际字段、请求 / 并发、范围 / 统计、兼容与升级步骤；W1 的直接开发入口。
- [领域词汇](CONTEXT.md)：目标、正式完成、个人卡、作答观察、卡点和正式覆盖的定义。
- [答案质量检查](docs/ANSWER_QUALITY_AUDIT.md)：2026-10-09 的长度口径、表述问题、重复范围和修订示例；[逐题明细](docs/ANSWER_QUALITY_AUDIT_DETAILS.json)。
- [答案质量修订交付](docs/ANSWER_QUALITY_REVISION.md)：2026-10-10 的全量修订、导入保留、备份恢复与 15 项 HTTP 检查；[修订后明细](docs/ANSWER_QUALITY_REVISION_DETAILS.json)。

接手时先核实本文的日期与事实；更新实际数量、入口、导入状态和本次检查结果，保留历史与新验证的区分。
