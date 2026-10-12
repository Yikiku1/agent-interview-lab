# 面试训练台：项目状态与开发交接

最后更新：2026-10-12（北京时间）。工作目录：`D:\projects\agent-interview-lab`。

本文是持续维护的项目状态入口。接手开发、排查问题或整理题库时先读本文，再读涉及模块。源码、实际探针和检查结果决定当前事实；历史交付记录用于追溯，计划不等于已实现。

长期维护入口是 [AGENTS.md](AGENTS.md) 的“项目长期上下文”：每次本项目任务开始读取本文，收尾核对并同步本次变化。全局长期记忆仅保存本项目路径和维护约定，具体状态集中在本文。

## 当前结论

项目已具备个人面试学习闭环、固定项目模拟、真实面试复盘与本地启动/备份恢复。W0 与 [670 题答案修订](docs/ANSWER_QUALITY_REVISION.md)已在 `3756f01` 提交推送；[W1](docs/JOB_SEEKER_W1_DELIVERY.md) 入口/目标/短轮、[W2](docs/JOB_SEEKER_W2_DELIVERY.md) 简历分层、[W3](docs/JOB_SEEKER_W3_DELIVERY.md) 个人卡/自查/卡点已在 `0e67163` 提交推送；[W4](docs/JOB_SEEKER_W4_DELIVERY.md) 范围正式覆盖已在 `464218d`；[W5](docs/JOB_SEEKER_W5_DELIVERY.md) 两项目五节点模拟已在 `1bbeb7b`；[W6](docs/JOB_SEEKER_W6_DELIVERY.md) 真实复盘与关联补练已在 `a5fa217` 提交推送。2026-10-12 [W7](docs/JOB_SEEKER_W7_DELIVERY.md)完成 Windows 启动、版本化十六表完整备份、显式独立空库恢复与可读导出；已实际恢复个人包并核对 Schema/全部记录/四序列，真实冷启动与重复复用通过。最终应用运行于 3000，原记录保留。每批完成并验证后提交推送，最新 SHA 以 Git 为准；W8 按需评估，本轮未进入。短答起草范围检查通过，未做真人计时。

本项目用于训练 Agent / LLM 应用开发面试；当前应用本身没有接入模型、自动评卷或 Agent 执行服务。使用固定 `default` 用户，个人本地使用，尚未实现登录和跨设备草稿同步。

| 项目     | 本次核实状态                                                                                                                                                      |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Git 基线 | `main`，W6 已以 `a5fa217` 提交推送；W7 本批次验证后按约定提交推送，最新 SHA 以 Git 为准                                                                           |
| 题库     | 源码和个人 PostgreSQL 均为 670 道启用题，7 个分类；原 570 题加 100 道简历专项题，保留 70 道基础题和 30 道精修核心题                                               |
| 实际数据 | 2026-10-12 W7 备份/独立恢复/启动核对：1 用户、670 启用题、13 进度、14 事件；十六表全字段与四序列保留，五张首期业务表、三张模拟表和三张复盘表为空，迁移3条、无目标 |
| 数据库   | 个人库 `interview_practice`，`127.0.0.1:5432`，持久目录 `.local/postgres`；只核实地址与数据库名，不记录凭证                                                       |
| 应用     | 2026-10-12 W7 最终构建运行于 3000（PID 23356），PostgreSQL 5432（PID 19532）；冷启动/复用/错误凭证拒绝、14项个人HTTP通过；W6浏览器16项保留原验证范围              |
| 本次工作 | W7 已交付；Windows 入口、实际 Schema 全记录/序列备份、独立空库恢复与 JSON/Markdown 导出；W8 仅按需评估                                                            |

## 功能与产品约定

| 功能       | 当前行为与边界                                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 题库       | 按题干、分类、难度、状态、预设、项目、简历优先级与回答性质筛选；列表、范围题数和队列共用条件；冲突范围可修正                                                  |
| 手动练习   | 顺序、随机、薄弱、到期四种模式；每轮 3 / 5 / 10 / 20 题，不足时使用实际数量                                                                                   |
| 今日推荐   | 未配置默认 10 题，目标时间档建议 3/5/10/20；范围内到期 → 正式练过的薄弱 → 核心或路径新题，去重并排除北京当天正式完成                                          |
| 求职入口   | 首页简历重点 / 项目讲述 / 基础补齐一点击进入 5 题，动态题数；范围外明确到期题单独提示与复习                                                                   |
| 训练目标   | 预设、项目、P0/P1/P2、时间档、可空日期；只写版本化目标，不自动创建、不改进度事件，旧队列优先恢复                                                              |
| 核心学习   | 固定 30 题，顺序为 LLM → Python → 后端 → 数据库 → RAG → LLM 应用工程 → Agent；展示短答、要点，深入内容按需展开                                                |
| 简历分层   | 100 题在详情和练习共用短答、三个要点、性质边界与六层折叠；练习默认隐藏，切题重置，正文版本不一致保留 Markdown                                                 |
| 个人回答卡 | 详情、历史和总结可编辑四字段，主动复制某次正式回答；数据库持久化、revision 冲突合并，独立作答时入口隐藏                                                       |
| 要点与卡点 | 本人自查与五类卡点可独立保存或关联正式回答；草稿跨切题/收起/刷新恢复，正式待确认时先保留；历史要点保存原文本快照                                              |
| 定向补练   | 卡点按共享范围、类型和解决状态筛选，支持明确解决/重开；最早记录顺序按题去重形成 3/5 题固定队列，停用资料仍可读                                                |
| 范围进度   | 统计页默认当前目标，无目标时全部启用题；只读自选范围，正式覆盖按独立 practice 题计，未练每页 12 题并提供本页 3/5 固定队列；自评、卡片、证据填写和卡点分别计数 |
| 项目模拟   | VendorGuard / 发票实习固定职责、主问题和三个追问；独立回答/跳过/卡点/可选计时，暂停续答，结束后统一快照参考与补练，不写普通完成；已结束轮次不能重开           |
| 面试复盘   | 只填一个实际问题即可保存；列表分页/详情/编辑、独立摘要/卡点/改进、可空关联与题干快照；同题多次面试独立跟进，不写普通事件或长期卡点                            |
| 复盘补练   | 关联时间与已有事件 ID 定义起点，只计之后新增正式完成；详情去重形成 3/5 固定队列，统计按范围内复盘问题记录计，与正式覆盖分开                                   |
| 自评与完成 | 仅修改不会 / 模糊 / 掌握不算练习；“完成本题”保存回答和自评，增加次数并安排复习。口头或空白文字也可完成                                                        |
| 分轮与续练 | URL 保存本轮 ID、固定队列、当前题目与总结状态；刷新和继续保留顺序。停用题跳过，新一轮重新选题                                                                 |
| 回答草稿   | 按本轮与题目保存在当前浏览器；切题、返回、刷新可恢复，完成后的新一轮不复用旧回答                                                                              |
| 提交恢复   | 暂时失败保留 `attemptId` 和回答重试；确定失败可恢复编辑并生成新 ID；成功响应丢失后从服务器完成记录恢复                                                        |
| 轮次总结   | 一轮同题重复完成时只展示最新已保存自评；累计次数按真实完成事件计。支持提前结束、继续未完成和重练薄弱题                                                        |
| 复习       | 不会 1 天、模糊 3 天并重置掌握阶段；连续掌握按 1 / 3 / 7 / 14 天，之后保持 14 天                                                                              |
| 界面       | 中文优先、中性色与低饱和青绿色、浅深主题、移动端单列，适合长时间阅读                                                                                          |

通用今日推荐的“核心新题”仅来自 30 道核心路径。简历目标的“路径新题”来自共享范围内未正式练过的题，按 P0/P1/P2、项目、稳定 ID 排序。普通新增题仍不会自动成为通用核心新题。

W7 的 Windows 启动入口复用健康服务，按需启动既有持久库/生产应用；缺构建先 build，连接/端口/Schema/构建/启动失败分别报错，不自动 seed、迁移或初始化。版本化完整备份保存实际十六表 Schema/全部字段/四序列，向显式另一空库事务恢复并严格比较；JSON/Markdown 独立可读导出缺少约束/序列，不用于完整恢复，浏览器未保存草稿均不在服务端备份中。

## 架构与定位入口

技术栈是 Next.js 16.3.6 App Router、React 19、TypeScript strict、Tailwind 4、Drizzle ORM、PostgreSQL。版本与命令以 `package.json` 和锁文件为准。Server Components 读取数据；API Route 处理状态修改与正式提交。

| 入口                                                                                                                                                               | 职责                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `src/app/page.tsx`                                                                                                                                                 | 首页统计、推荐入口和继续练习                                                              |
| `src/app/questions/`                                                                                                                                               | 题库与详情；`src/app/practice/`、`review/`、`stats/` 分别提供练习、复习和统计             |
| `src/lib/questions.ts`                                                                                                                                             | 题目筛选、选题、统计与历史查询；只返回启用题                                              |
| `src/lib/question-filters.ts`、`learning-options.ts`                                                                                                               | 共享条件解析、轻量范围标签与 URL 序列化                                                   |
| `src/lib/learning-target.ts`、`src/app/api/learning-target/route.ts`、`src/app/learning-target/`                                                                   | 目标只读查询、事务保存与配置页                                                            |
| `src/lib/daily-practice.ts`、`daily-practice-query.ts`                                                                                                             | 推荐纯逻辑与数据库取候选；统一请求时间与北京时间日界线                                    |
| `src/lib/practice-session.ts`                                                                                                                                      | 模式、固定队列、位置、续练 URL 与总结                                                     |
| `src/lib/practice-draft.ts`                                                                                                                                        | 草稿、提交 ID、异常和恢复契约                                                             |
| `src/lib/review-schedule.ts`                                                                                                                                       | 复习间隔、连续掌握阶段与日期展示                                                          |
| `src/components/practice/`                                                                                                                                         | 作答、自评、保存、轮次总结与交互恢复                                                      |
| `src/components/question/`                                                                                                                                         | 列表、筛选、掌握状态、普通 Markdown 与核心分层答案                                        |
| `src/app/api/progress/route.ts`                                                                                                                                    | `PUT /api/progress`，只更新掌握状态                                                       |
| `src/app/api/attempts/route.ts`                                                                                                                                    | `POST /api/attempts`，事务内写正式事件、次数与复习安排                                    |
| `src/db/schema.ts`                                                                                                                                                 | 数据结构；`config.ts` 统一环境加载；`index.ts` 为网页数据库连接                           |
| `src/lib/learning-contract.ts`                                                                                                                                     | 预设、范围元数据与严格请求校验；W1 目标、W3 个人卡和观察共用                              |
| `src/lib/practice-notes.ts`、`practice-notes-contract.ts`、`note-draft.ts`                                                                                         | W3 个人卡版本、观察事务/幂等、卡点范围与状态、未保存编辑恢复                              |
| `src/lib/scope-progress.ts`、`scope-progress-contract.ts`、`src/components/practice/scope-progress-panel.tsx`                                                      | W4 只读一致快照统计、严格范围/分页条件与标签、未练固定队列与卡点入口                      |
| `src/lib/mock-interview.ts`、`mock-interview-contract.ts`、`src/components/mock/`、`src/app/mock-interviews/`、`src/app/api/mock-interviews/`                      | W5 固定五节点快照、只发送当前/过去节点、创建幂等与修改版本/行锁、独立草稿、续答和结束总结 |
| `src/db/migrate-mock-interview.ts`、`migrate-mock-interview-cli.ts`、`migrations/0002_mock_interview.sql`                                                          | W5 三表增量迁移，要求 W0 checksum 一致；2026-10-12 恢复演练后迁移个人库，SQL 已冻结       |
| `src/lib/interview-reviews.ts`、`interview-review-contract.ts`、`src/components/interview-review/`、`src/app/interview-reviews/`、`src/app/api/interview-reviews/` | W6 独立原问题、关联快照/基线、创建/修改幂等、版本/行锁、草稿/冲突核对与列表分页           |
| `src/app/api/interview-review-question-options/route.ts`                                                                                                           | 手动搜索启用题，仅发送 ID/题干/分类，最多 20 条                                           |
| `src/db/migrate-interview-review.ts`、`migrate-interview-review-cli.ts`、`migrations/0003_interview_review.sql`                                                    | W6 三表增量迁移，要求 W0/W5 checksum 一致；2026-10-12 独立恢复后迁移个人库，SQL 已冻结    |
| `src/app/practice-gaps/`、`questions/[id]/answer-card/`、`questions/[id]/history/[eventId]/`                                                                       | 卡点筛选补练、个人卡编辑、逐次正式回答与自查                                              |
| `scripts/audit-answer-quality.ts`                                                                                                                                  | 全量答案字符、口头时长粗筛、重复段落及可选数据库只读比对；不自动评分、不修改答案          |
| `src/db/answer-quality.ts`                                                                                                                                         | 短答计数与起草范围、有效讲解和示例校验；由 seed 与审查脚本共用                            |
| `src/db/migrate-learning-foundation.ts`、`migrate-learning-foundation-cli.ts`、`migrations/0001_job_seeker_foundation.sql`                                         | W0 事务增量迁移、版本 checksum 与默认只显示说明的 CLI；2026-10-10 已迁移个人库            |
| `src/db/seed-data.ts`、`seed-bank.ts`、`seed.ts`                                                                                                                   | 汇总题目、导入校验与事务、CLI 入口                                                        |
| `src/db/basic-questions.ts`                                                                                                                                        | 70 道基础题                                                                               |
| `src/db/core-path.ts`、`core-answers.ts`、`learning-content.ts`                                                                                                    | 核心题轻量身份顺序、内容、Markdown 生成；保持单一内容来源                                 |
| `src/db/resume-content.ts`、`resume-questions.ts`、`src/components/question/resume-learning-answer.tsx`                                                            | 简历结构化答案、种子生成、服务端身份/版本核对与共用分层展示                               |
| `src/db/expansion-*.ts`、`seed-notes.ts`、`seed-context.ts`、`original-examples.ts`                                                                                | 岗位场景、逐题机制与示例、明确标为补充的共享背景；旧 `answer-examples.ts` 已移除          |
| `tests/unit/`、`tests/integration/`、`tests/helpers/postgres.ts`                                                                                                   | 纯逻辑回归、真实数据库契约与独立临时数据库                                                |

简历题入口：`src/db/resume-questions.ts` 汇总，`resume-content.ts` 管理来源与结构，`resume-agent.ts`、`resume-rag.ts`、`resume-engineering.ts`、`resume-foundations.ts` 保存具体内容；[整理与导入说明](docs/RESUME_QUESTION_BANK.md)。

W7 定位入口：`scripts/start-local.ps1` / `start-local.ts` 提供 Windows 启动与锁/日志/健康检查，`src/db/local-status.ts` / `src/app/api/local-status/route.ts` 只读核对数据库身份/十六表/default。`src/db/local-backup.ts` 管理真实 catalog、记录/序列、版本包校验、空库恢复与可读内容；`scripts/local-data.ts` 是公开 backup/restore/export CLI。`tests/unit/local-runtime.test.ts` 与 `tests/integration/local-backup.test.ts` 覆盖启动辨识、两种初始化 Schema、完整恢复和失败边界。

## 数据与不能破坏的契约

当前个人数据库有十六张表：原 `users`、`questions`、`user_question_progress`、`review_events`，五张首期业务表 `learning_targets`、`personal_answer_cards`、`practice_observations`、`answer_point_checks`、`practice_gaps`，`app_schema_migrations`，W5 的 `mock_rounds`、`mock_nodes`、`mock_round_actions`，W6 的 `interview_reviews`、`interview_review_questions`、`interview_review_actions`。2026-10-10 W0、2026-10-12 W5/W6 均在独立恢复与迁移演练后受控升级个人库，原记录与四个序列保留；五张首期业务表、三张模拟表和三张复盘表均空，没有默认目标。字段和请求契约见 [W0](docs/JOB_SEEKER_W0_CONTRACT.md)、[W5](docs/JOB_SEEKER_W5_DELIVERY.md) 与 [W6](docs/JOB_SEEKER_W6_DELIVERY.md)。

- 题干是种子更新的唯一键；按题干 upsert 保留题目 ID。改已有题干会产生另一道题，涉及身份变更时单独设计迁移。
- 答案导入前检查普通短答 120–180、简历短答 240–270 个有效字符，并要求有效讲解与具体示例；这是按既有时长目标的起草范围，不是实际朗读认证。标题、标点、URL 与代码块不计入有效短答字数。
- 停用用 `active=false`，历史事件和进度保留。外键使用 restrict，避免删除带练习记录的题。
- `review_events.kind=practice` 才表示正式完成；`legacy` 是旧版标记记录，保留历史计数语义。
- `attemptId` 按用户唯一；同 ID、同内容重试不重复写，同 ID、不同内容或本轮 ID 返回 409。
- 不同提交并发完成同题时按进度行锁串行更新；事件、进度、次数和安排在一个事务里完成。
- 回答上限 10,000 字符；空白按口头作答保存。网页读取、推荐计算和打开练习不写完成事件。
- `next_review_at=null` 表示未建立安排。手动到期模式兼容待首次练习；今日推荐的到期来源要求明确到期时间。
- 原有固定队列、草稿隔离和恢复不能因新增题库内容改变。
- 简历答案分层直接取 ResumeEntry，不解析生成 Markdown；仅身份、元数据和正文版本一致时展示结构。数据库编辑或未收录题保留原 Markdown，避免覆盖用户补充。折叠操作不保存状态、答案或正式事件。
- 新目标按用户只允许一个 active，旧配置保留；卡片与观察不写正式事件。W3 服务端验证关联事件属于本人/该题且为 practice，复合外键保留归属约束。
- W3 卡片更新锁用户并匹配 revision；落后一版且规范化字段相同才作为重试。观察 requestId 与规范化 payload 幂等，父子事务写入；卡点解决只改 resolved_at，原观察重试不重开。
- 已保存个人卡和自查从数据库读取；localStorage 只保存未保存编辑。正式完成待确认时，练习和总结均保留自查草稿，恢复真实事件后再关联。配额失败仅承诺当前页面保留最新编辑。
- 停用题不出现在题库/补练/统计中，但 W3 详情、卡片、卡点与逐次历史允许访问保留资料。
- W4 目标、范围、计数和未练列表共用只读 repeatable read 快照；正式事件 EXISTS，卡片/卡点独立聚合。证据按 trim 非空计算，不能据此断定已验证；通用核心统计全部启用题，30 题路径只作为核心推荐。`scope=custom` 只覆盖查看范围，单独 `page` 保持当前目标。
- W5 开始时冻结主问题、三个追问、参考和基础建议；进行中 DTO 只发送当前及过去节点，未来追问题干和参考/建议直到结束才发送。源题停用或改文不改旧轮次，失配来源不能新建。
- W5 创建 requestId 按用户幂等；修改锁轮次、匹配 revision/当前位置、持久记录请求，同内容迟到重试不重复推进，409 返回当前轮次供本人核对。节点与请求事务写入；模拟不写普通事件、W3 长期卡点或复习安排。
- W5 已保存节点由服务端恢复，未保存草稿按轮次/位置隔离；另一页面 storage 事件不覆盖当前编辑。可空文字明确记为口头已答；提前结束保留未答草稿且结束后不能重开；可选计时只累计页面可见秒数，刷新暂停。
- W6 面试原话与公共题独立保存，关联保存题干快照；同题多次面试独立基线，公共题改文/停用/seed 不覆盖原话。已保存问题保留 ID/顺序，不隐式删除；新问题追加，最多 20 个。
- W6 只计本人同关联题、createdAt 不早于 linkedAt 且 ID 大于关联时已有最大事件 ID 的 practice 事件；同毫秒旧回答排除。普通编辑保持基线，取消/换题重新跟进；详情待练按记录顺序去重，R07 按范围内复盘问题记录计，与正式覆盖分开。
- W6 创建保存原规范化请求，后续编辑不改变创建幂等；修改锁复盘、匹配 revision 并持久记录 requestId，迟到重试不重复修改。409 返回服务器记录，按问题 ID 明确合并；另一页 storage 事件保留当前文字，草稿与普通/W3/W5 隔离。复盘卡点不自动写 W3 长期卡点。
- 目标 PUT 在事务内锁用户，requestId 同配置返回原记录，不同配置 409；旧 inactive 请求重试不重激活，写失败回滚。目标改变只影响新选题，不改已开始的 queue。
- 原四表库升级 W0 使用版本化增量迁移，不能用 `db:push` 绕过记录；新空库继续用 `db:push` 建完整 Schema。导入模块和默认迁移命令都不执行迁移，W1 启用前按契约完成备份恢复演练。
- 已受控升级 W0 的旧库通过 `db:migrate:w5 --apply` 追加模拟三表，先备份并实际独立恢复比对；无参数不连接数据库。W0/W5 迁移文件均已应用，不能改写或用 `db:push` 接管个人库。
- 已受控升级 W0/W5 的旧库通过 `db:migrate:w6 --apply` 追加复盘三表，同样先备份并实际恢复比对；W6 文件也已应用并冻结。新空库使用完整 Schema，不能重跑旧恢复脚本覆盖个人新资料。
- W7 备份只覆盖本项目 public Schema 十六表及全部归属序列，额外或不支持对象拒绝；迁移锁与稳定表 SHARE 锁保证普通写入后的记录/序列一致，文件在事务后写，manifest最后生成。CHECK经会话临时表解析器规范化，公共Schema/业务记录不变；迁移SQL不参与重建实际Schema。
- W7 完整包包含版本/UTC与北京时间/迁移/文件SHA/Schema和全记录指纹；恢复必须显式 RESTORE_DATABASE_URL 指向另一空库，文件校验、建Schema/记录/外键/序列和全字段比对，失败事务回滚。默认离线检查，不连接或自动切换个人库；浏览器草稿不备份，可读JSON/Markdown不能替代完整包。

## 开发习惯与完成方式

面向用户使用简体中文，先给影响与结论，命令和技术标识保持英文。终端优先 `pwsh`；搜索优先 `rg`，独立读取和查询批量执行。具体规则遵循当前用户指令及生效的 `AGENTS.md`，`CLAUDE.md` 仅为兼容引用。

1. 开始时检查 Git 与真实运行状态，读本文及相关模块。已有个人进度和未提交改动要保留。
2. 涉及 Next.js 时先读安装版本 `node_modules/next/dist/docs/` 的对应文档，再改实现，特别留意异步参数与缓存约定。
3. 用户已授权的工作持续推进到可检查结果。沿用用户“每次推进完记得提交推送”的约定：每批实现、验证和更新上下文后提交推送，再核对远端；W0–W6均已推送，本批次W7，本轮不自动进入W8。W8只有连续使用暴露实际需求后才评估。
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
pwsh -NoProfile -File scripts/start-local.ps1
node --import tsx scripts/local-data.ts backup
node --import tsx scripts/local-data.ts restore --from <备份目录>
node --import tsx scripts/local-data.ts export
node --import tsx src/db/seed.ts
node --import tsx src/db/migrate-learning-foundation-cli.ts
node --import tsx src/db/migrate-mock-interview-cli.ts
node --import tsx src/db/migrate-interview-review-cli.ts
node --import tsx --test tests/unit/*.test.ts
node --conditions=react-server --import tsx --test tests/integration/*.test.ts
node node_modules/eslint/bin/eslint.js
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next build
node node_modules/next/dist/bin/next start
git diff --check
```

本机复用 `.local/postgres` 中的持久数据。相关日志是 `.local/postgres.log`、`.local/ui-app.stdout.log` 和 `.local/ui-app.stderr.log`；PID 文件用于定位，不应直接假定旧 PID 仍对应原进程。重启前核对端口与进程命令。更改生产代码后需重新 build / start；单纯导入题目由数据库驱动的动态页面读取。

日常使用 W7 PowerShell 入口默认打开浏览器；`-NoBrowser`只核对服务，`-Port`明确端口，应用正常停止后`-Build`重建。备份默认`.local/backups/`、导出`.local/exports/`，每次唯一目录，已由`.gitignore`统一忽略；恢复默认只校验，实际`--apply`要求显式另一空库。异常启动锁残留先核对`.local/start.lock`的PID停止状态，再清理锁；详细操作见[W7](docs/JOB_SEEKER_W7_DELIVERY.md)。

## 验证记录与开发进度

2026-10-09：按用户要求，将每次任务读取与收尾同步本文的约定写入项目 `AGENTS.md`，并保存长期记忆更新备注。`CLAUDE.md` 继续只引用 `AGENTS.md`。本次仅修改文档，验证格式和文档入口；没有重跑应用测试或更新运行快照。

2026-10-09（北京时间）：按用户要求从求职者角度完成 [需求分析](docs/JOB_SEEKER_REQUIREMENTS.md)，记录 10 项需求的场景、优先级、首版范围与验收条件。建议首期实施简历入口、短轮与路径推荐、简历答案分层、个人回答卡和卡点补练；模拟追问、面试复盘及进度变化随后推进。这里只完成分析，未修改功能或个人数据，未决定工期。

2026-10-09（北京时间，W0 开发前）：根据需求分析整理 [求职者训练闭环开发计划](docs/JOB_SEEKER_DEVELOPMENT_PLAN.md)，将 R01–R10 拆为 W0–W8 批次，明确首期范围、建议数据结构、固定队列与 attemptId 契约、验收场景、验证方式和实施前决策门。当时只完成计划文档，未修改页面、接口、Schema 或个人数据；各批次当时待实施，不代表工期承诺。

| 阶段                           | 状态         | 证据                                                                                                                                                          |
| ------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 初始面试训练平台               | 已提交       | `d723848`（2026-10-04）                                                                                                                                       |
| 练习可靠性、学习界面与计划     | 已提交       | `8924e3a`（2026-10-08）；具体行为以当前源码为准                                                                                                               |
| 今日推荐、分层核心题与自评说明 | 已交付       | `9037f0c`（2026-10-08），[交付记录](docs/LEARNING_EFFICIENCY_DELIVERY.md)                                                                                     |
| 项目状态入口                   | 已完成       | 本文、README 与 AGENTS 入口                                                                                                                                   |
| 简历专项题                     | 已导入       | 100 题、300 个追问，P0 63 / P1 32 / P2 5；题库总数 670，[整理与导入说明](docs/RESUME_QUESTION_BANK.md)                                                        |
| 求职者视角产品需求             | 首期已交付   | [需求文档](docs/JOB_SEEKER_REQUIREMENTS.md)；W1 入口/目标、W2 分层、W3 个人卡/自查/卡点、W4 范围正式覆盖已接入，后续按批次实施                                |
| 求职者训练闭环开发计划         | 主流程已交付 | [开发计划](docs/JOB_SEEKER_DEVELOPMENT_PLAN.md)；W0–W7完成，W8按使用需求评估                                                                                  |
| W0 数据与兼容契约              | 已提交并迁移 | [W0 交付](docs/JOB_SEEKER_W0_CONTRACT.md)；`3756f01` 已推送，2026-10-10 独立恢复演练后个人库迁移通过                                                          |
| W1 简历入口、目标与短轮        | 已提交推送   | [W1 交付](docs/JOB_SEEKER_W1_DELIVERY.md)；共享范围、路径推荐、3/5 题、个人库保留与浏览器验收；W1–W3 合并提交 `0e67163`                                       |
| W2 简历答案分层                | 已提交推送   | [W2 交付](docs/JOB_SEEKER_W2_DELIVERY.md)；100 题同源结构、共用展示与失配回退，43/28 回归、14 项交互；`0e67163`                                               |
| W3 个人卡、自查、卡点补练      | 已提交推送   | [W3 交付](docs/JOB_SEEKER_W3_DELIVERY.md)；版本合并、观察幂等归属、历史快照、解决重开与固定队列，46/40 回归、15 项交互；`0e67163`                             |
| W4 范围正式覆盖与首期验收      | 已提交推送   | [W4 交付](docs/JOB_SEEKER_W4_DELIVERY.md)；目标/自选范围、正式覆盖、未练分页、卡片/证据/卡点计数，48/49 回归、13 项交互、16 项个人只读检查；`464218d`         |
| W5 项目模拟与连续追问          | 已提交推送   | [W5 交付](docs/JOB_SEEKER_W5_DELIVERY.md)；五节点快照、独立记录/恢复、隐藏未来内容、并发/重试、总结/补练，52/60 回归、13 项交互、16 项个人只读检查；`1bbeb7b` |
| W6 真实复盘与关联补练          | 已提交推送   | [W6交付](docs/JOB_SEEKER_W6_DELIVERY.md)；独立原话/关联基线、幂等/冲突、固定补练/R07，56/73回归、16项交互、27项个人只读；`a5fa217`                            |
| W7 本地启动与备份恢复          | 已交付       | [W7交付](docs/JOB_SEEKER_W7_DELIVERY.md)；58/84回归、个人完整包公开CLI独立恢复、实际冷启动/复用、14项个人HTTP；本批次按约定提交推送                           |
| 答案长度与清晰度               | 已修订并导入 | 2026-10-10 [交付报告](docs/ANSWER_QUALITY_REVISION.md)、[670 题修订明细](docs/ANSWER_QUALITY_REVISION_DETAILS.json)；篇幅粗筛通过，保留个人数据               |

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

2026-10-10（北京时间）W1 新验证：41/41 单元测试、28/28 独立 PostgreSQL 集成测试、ESLint、TypeScript 与 Next.js 16.3.6 生产构建通过。新增 3 项单元和 7 项集成，覆盖元数据条件与内存契约一致、旧条件组合、路径排序与当天排除、范围外到期、目标幂等/冲突/并发/回滚，以及 3/5 题提交恢复、空范围与停用。没有改动原 attempts、草稿和总结保存契约。

备份目录 `.local/backups/job-seeker-w1-20261010/` 保存本次四表 Schema/记录/序列、实际恢复与迁移演练、个人迁移和只读 HTTP 结果。迁移版本 `0001_job_seeker_foundation` 与冻结 SQL checksum 一致，原四表所有字段和序列保留。五张业务表为空，1 用户、670 题、13 进度、14 事件，GET 目标为 null；个人库没有验收练习事件。备份是升级前四表恢复包，后续统一十表备份待 W7。

Chrome + Playwright 在独立库的生产服务 `http://localhost:3001` 完成 21 项浏览器检查：首页入口、动态题数、筛选与队列一致、目标失败重试与刷新、3/5 题草稿/提前结束/总结/临时失败/确定失败/成功响应丢失恢复、目标切换保持队列、范围外到期、通用清空冲突、原 10/20 题及移动端。意外 page error 与 console warning/error 为 0，注入网络失败单独标注 expected。桌面 1440×1000、移动 375×812 截图和 `qa.json` 位于 `D:/CodexHome/visualizations/2026/10/10/agent-interview-w1/`；临时服务、数据库和浏览器已清理。Browser 插件未列出，使用已有 Playwright/Chrome，未安装依赖。

个人应用新构建运行于 3000，本次启动 PID 17360；5432 PostgreSQL 本次核实 PID 24892，后续仍根据端口与命令核对。19 项只读 HTTP/服务端内容检查通过，包含新预设、目标 GET、3/5 队列、原 10/20 与旧固定队列；检查前后记录与序列一致，stderr 为空。本次文件 Prettier、差异检查、六份文档 70 个本地链接核对通过；临时脚本与旧失败证据已清理，备份和成功截图保留。详细范围及六项浏览器检查表见 [W1 交付](docs/JOB_SEEKER_W1_DELIVERY.md)。

2026-10-11（北京时间）W2 新验证：43/43 单元测试、28/28 独立 PostgreSQL 集成测试、ESLint、`tsc --noEmit` 和 Next.js 16.3.6 生产构建通过。新增两项单元契约检查全量 100 题内容一致与可序列化、变更正文/身份/坏元数据/普通题回退。没有改题干、公共答案、Schema 或 API 持久化逻辑，没有在个人库执行 seed/迁移。

独立库 Chrome + Playwright 的新生产服务 3001 完成 14 项交互检查：三种性质详情、初始隐藏、短答要点、六层键盘展开、收起/切题/刷新重置与草稿自评保留、503 同 attemptId 重试一次、成功响应丢失恢复、总结续练、普通与核心兼容、数据库改文后双入口回退、移动长代码容器滚动、375 像素浅深主题与减少动画设置。意外 page error 与 console warning/error 为 0，注入网络错误单独标为 expected。截图、`qa.json`、build/db 日志在 `D:/CodexHome/visualizations/2026/10/11/agent-interview-w2/`；已视觉核对桌面分层、移动浅色与深色证据。Browser 插件未列出，复用已有 Playwright/Chrome，未安装依赖；临时库、服务和浏览器已清理。

本机持久 PostgreSQL 5432 启动成功（本次 PID 17284），新生产应用 3000（PID 14348）运行，stderr 为空；接手仍核对端口与命令。本次 9 项个人应用只读 HTTP/服务端内容检查通过：首页、简历范围、三类简历详情、目标、练习设置、复习、统计。670 道启用题答案与源码一致，100 道结构映射全部成功；十表全记录与所有序列检查前后一致，仍为 1 用户、13 进度、14 事件，新五表为空且无默认目标。快照与结果在 `.local/backups/job-seeker-w2-20261011/records-before.json`、`verification.json`；该快照仅用于比对，不是完整 Schema 恢复包。工作区 Prettier、差异检查、本次五份文档 66 个本地链接检查通过，临时脚本和重复日志已清理，成功证据保留。细节见 [W2 交付](docs/JOB_SEEKER_W2_DELIVERY.md)。

2026-10-11（北京时间）W3 新验证：46/46 单元、40/40 独立 PostgreSQL 集成测试、ESLint、TypeScript 与 Next.js 16.3.6 生产构建通过。新增 3 项单元、12 项集成测试验证卡片版本/并发/失败回滚、观察规范化幂等/归属/事务回滚、数据隔离、状态重复操作、停用保留与 seed 不覆盖。个人库未执行 seed、迁移或验收写入。

独立库新生产服务 3001 使用现有 Chrome + Playwright 通过 15 项交互，覆盖历史主动复制、卡片刷新/新轮/应用重启持久化、冲突两种合并方式、失败编辑保留、自查草稿切题/收起/刷新、正式待确认与恢复关联、观察响应丢失幂等、历史快照、筛选/固定队列/目标改变、解决重开、停用资料、移动浅深主题、键盘、存储配额失败、公共答案更新后旧草稿及可空字段。意外 page error/console error 为 0；桌面 1440×1000 与移动 375×812 无横向溢出。成功 JSON、截图与日志在 `D:/CodexHome/visualizations/2026/10/11/agent-interview-w3/`，已视觉核对桌面卡点和移动深色卡片；临时浏览器、服务、数据库及脚本清理。

W3 新构建运行于 3000（本次 PID 25364），持久 PostgreSQL 5432（PID 17284），stderr 为空。11 项个人应用只读 HTTP 检查通过；重启前后十表全记录与所有序列一致，1 用户、670 题、13 进度、14 历史事件、五张业务表为空，未配置目标。快照和结果在 `.local/backups/job-seeker-w3-20261011/records-before.json`、`verification.json`，仅为比对证据，不是完整 Schema 恢复包。本次文档/源码格式、69 个本地文档链接与差异核对通过；W1–W3 未提交、未推送。细节见 [W3 交付](docs/JOB_SEEKER_W3_DELIVERY.md)。

2026-10-11（北京时间）W4 新验证：48/48 单元、49/49 独立 PostgreSQL 集成测试、ESLint、TypeScript 与 Next.js 16.3.6 生产构建通过。新增 2 项单元、9 项集成，验证严格条件、distinct 正式覆盖、legacy/自评/观察排除、重复完成与重试、用户隔离、Unicode 空白证据、范围切换、停用保留、稳定分页及首期五题完成三题流程。本批次未修改 Schema、公共答案、原正式提交和草稿恢复契约。

独立库新生产服务 3001 的 Chrome + Playwright 1.62.1 通过 13 项交互验收：首次访问只读、首页简历五题完成三题、个人卡与两卡点关联、3/100 正式覆盖与自评分离、卡点筛选去重/解决、刷新续练原轮及第四题草稿、目标切换、当天/次日推荐、自选范围分页、未练三题固定队列、空/全练/非法范围、停用资料、桌面/移动浅深主题与键盘。意外 page error、console error/warning 均为 0，1440×1000 和 375×812 无横向溢出；已视觉核对桌面浅色与移动深色统计。成功 JSON、截图、日志位于 `D:/CodexHome/visualizations/2026/10/11/agent-interview-w4/`。Browser 插件未列出，复用已有 Chrome/Playwright，未安装依赖；临时服务、数据库和浏览器已关闭。

W4 新构建运行于 3000（本次 PID 41588），持久 PostgreSQL 5432（本次核实 PID 17284），stderr 为空。16 项个人应用只读 HTTP/服务端内容检查通过，包含原入口与默认/自选/分页/空/无效范围；页面与服务端一致，全部启用题覆盖 13/670，简历覆盖 0/100。重启前后十表全记录与全部四个序列一致，仍为 1 用户、670 题、13 进度、14 历史事件、五张业务表为空、迁移版本 1 条、无默认目标。快照与结果在 `.local/backups/job-seeker-w4-20261011/records-before.json`、`verification.json`，仅为比对证据，不是完整恢复包；未执行个人库 seed、迁移或验收写入。W1–W3 已先提交推送 `0e67163` 并核对远端，W4 本批次按约定在验收后提交推送。细节见 [W4 交付](docs/JOB_SEEKER_W4_DELIVERY.md)。

2026-10-12（北京时间）W5 新验证：52/52 单元、60/60 独立 PostgreSQL 集成、ESLint、TypeScript（生产构建内）与 Next.js 16.3.6 生产构建通过。新增 4 单元、8 模拟与 3 迁移集成，覆盖两项目五节点/快照、隐藏未来内容、创建/修改幂等及迟到重试、revision 冲突、事务回滚、用户归属、seed 不覆盖模拟与冻结迁移升级。未改公共题目、普通正式提交、自评、草稿或 W4 统计逻辑。

最终构建在独立库 3001 通过 Chrome / Playwright 1.62.1 的 13 项交互，覆盖完整主问题与三个追问、草稿暂停/刷新/列表恢复、计时、本人卡点、跳过/口头状态、发票提前结束、应用重启/新浏览器、503 同请求重试、保存/创建响应丢失、双页面冲突合并、改文/停用快照、普通流程与正式覆盖、桌面/手机明暗主题、键盘与减少动画。意外 page error、console error/warning 均为 0；1440×1000 和 375×812 无横向溢出。已视觉核对桌面作答/总结及手机深色选择完整题干；截图/JSON/日志位于 `D:/CodexHome/visualizations/2026/10/12/agent-interview-w5/`。Browser 插件未列出，复用已有 Chrome/Playwright，未安装依赖；临时库、服务与浏览器已关闭。

W5 个人库升级前备份十表完整 Schema/记录/四序列，在独立库实际恢复并比较字段/默认值/约束/索引与记录，再演练升级。通过后执行 `0002_mock_interview` 增量迁移；原九张业务表全字段、W0 迁移记录与四个序列不变，新增一个迁移版本和三张空模拟表。恢复包/快照/演练/升级/HTTP 证据位于 `.local/backups/job-seeker-w5-20261012/`；`restore-pre-w5.sql` 只向空库恢复，覆盖升级前状态。之后新增的模拟资料统一备份待 W7，禁止重跑旧升级脚本覆盖基线。

W5 最终生产应用 3000（本次 PID 13128）、持久 PostgreSQL 5432（核实 PID 22016）运行，stderr 为空。16 项个人只读 HTTP/服务端内容检查通过，十三表全字段与全部四个序列前后一致：1 用户、670 启用题、13 进度、14 事件，五张首期业务表和三张模拟表均空，无默认目标，迁移版本 2 条，正式覆盖仍全部 13/670、简历 0/100。无效/不存在模拟页核对 notFound 文案，流式响应允许 200；API 分别 400/404。未执行个人 seed、db:push 或验收写入。

2026-10-12（北京时间）W6 新验证：56/56 单元、73/73 独立 PostgreSQL 集成、TypeScript、ESLint 与 Next.js 16.3.6 生产构建通过。新增 4 项单元、10 项复盘与 3 项迁移集成，验证单个未收录问题、字段/日期/请求限制、独立草稿、按 ID 合并、队列/状态、创建/修改/迟到重试、并发/回滚、补练基线/同毫秒旧事件、重新关联、归属隔离、快照/seed 保留、分页及十三表升级。Windows 测试库清理增加文件释放重试，最终集成测试全部通过。

最终构建在独立库 3001、现有 Chrome / Playwright 1.62.1 通过 16 项交互，涵盖只读入口、单问题保存、草稿刷新、关联保留原话、正式固定补练/统计变化、多次面试独立基线、503/响应丢失恢复、双页面409核对合并并保留服务器新问题、创建重试、重启/新浏览器、公共改文/停用/seed、分页、键盘/配额失败、桌面/手机明暗主题与减少动画、原普通和 W5 流程。除两次明确的正式作答外，其他验收操作不改普通记录；意外 page error、console error/warning 均 0，1440×1000 与 375×812 无溢出。已视觉核对桌面与手机深色详情，成功 JSON/截图/日志在 `D:/CodexHome/visualizations/2026/10/12/agent-interview-w6/`。临时验收服务、浏览器和数据库已关闭；复用已有依赖。

W6 先备份十三表完整 Schema/记录/四序列，在独立库实际恢复并严格比较字段/默认值/约束/索引、全记录和序列，再演练升级；通过后迁移个人库。原十二张业务表全字段、两个旧迁移记录与四个序列不变，仅新增 W6 迁移版本和三张空复盘表。证据在 `.local/backups/job-seeker-w6-20261012/`，包括 `restore-pre-w6.sql`、前后记录、Schema catalog、恢复演练/迁移/HTTP JSON；恢复包只向空库恢复，覆盖 W6 升级前状态，新资料统一备份待 W7，不能重跑旧脚本覆盖基线。

W6 最终应用 3000（本次 PID 13520）、持久 PostgreSQL 5432（核实 PID 22016）运行，stderr 为空。27 项个人只读 HTTP/服务端检查通过，涵盖原入口、模拟、复盘列表/新建/分页/非法页码、无效/不存在详情与 API、轻量搜索和范围复盘统计。流式 notFound 页同时核对文案，API 400/404。重启/读取前后十六表全字段与四序列相同：1 用户、670 启用题、13 进度、14 事件，五张首期业务表、三张模拟表和三张复盘表为空，迁移版本3条、无默认目标；正式覆盖仍13/670、简历0/100，复盘关联/已练/待练均0。未执行个人seed、db:push或验收写入。

2026-10-12（北京时间）W7 新验证：58/58单元、84/84独立PostgreSQL集成、TypeScript、ESLint、PowerShell语法及Next.js16.3.6生产构建通过。新增2单元/11集成，覆盖pnpm原生程序定位、应用健康/数据库匹配、升级与新建Schema、全部个人表数据/中文/null/微秒/四序列、SQL与公开CLI空库恢复/严格比对、现有库拒绝/损坏包/失败回滚、唯一目录/导出围栏/离线检查/显式目标、并发写入、服务复用/端口/锁/构建与启动失败。全量通过后最终启动代码又通过11项专项回归，不重复无关检查。日志在`D:/CodexHome/visualizations/2026/10/12/agent-interview-w7/`。

W7一次全量测试暴露embedded-postgres在stop内部先无重试删目录，绕过helper的重试造成EBUSY；改为由helper统一负责停止后目录清理，最终84项通过，遗留目录也已核对停止后删除。只影响独立测试库，不改个人数据。实际冷启动发现pnpm符号链接路径定位原生程序失败，已按真实依赖路径解析并加回归，最终持久库正常启动。

W7个人库已生成完整版本包`.local/backups/job-seeker-w7-20261012/backup-2026-10-12T07-41-10-042Z-SaeS3W/`，公开restore CLI在独立空库实际恢复，规范化Schema/十六表全部字段/四序列严格相同，原库不变；包包含manifest/snapshot/restore.sql、公开恢复核对、`personal-rehearsal.json`与`runtime-verification.json`。可读JSON/Markdown在`.local/exports/job-seeker-w7-20261012/export-GKX0f2/`，不能作恢复包。完整包覆盖备份时已保存资料，后续新资料重新运行公开backup，不覆盖旧目录。

W7实际正常停止应用与持久库后，PowerShell入口冷启动原`.local/postgres`与新构建，重复执行直接复用；错误凭证明确拒绝、不多启服务。应用3000（本次PID23356），PostgreSQL5432（PID19532），stderr为空。14项个人HTTP/健康检查通过；启动/读取前后规范化Schema、十六表全字段、四序列与完整包相同，1用户/670启用题/13进度/14事件、三条迁移、新业务表空、无目标。未执行个人seed、迁移、db:push或验收写入。本批无新增交互页面，未重跑浏览器；W6交互保留原日期和范围。

## 后续事项与已知限制

W4 收尾（2026-10-11）：源码和文档格式、8份文档87个本地链接、Git差异检查通过，已推送`464218d`。W5 收尾（2026-10-12）：格式、8份文档106个本地链接通过，无用脚本/失败截图/重复日志清理，已推送`1bbeb7b`。W6 收尾（2026-10-12）：源码/文档格式、8份文档116个本地链接、证据与差异检查通过，临时脚本清理，已推送`a5fa217`。W7 收尾（2026-10-12）：本批源码/文档格式、7份文档126个本地链接、证据与Git差异检查通过，两个临时核对脚本已清理，最终健康API返回ready与十六表。成功日志、核对JSON、个人完整恢复包与可读导出保留；W7本批次按约定提交推送，最新SHA以Git为准。

W6 一次失败测试遗留的独立 PostgreSQL 临时目录已在核对绝对路径与停止状态后清理。后续 helper 增加文件释放重试，新测试目录正常清理；验收与备份脚本也已删除，个人库与成功证据保留。

答案修订已完成；后续按实际练习朗读调整语速和表达，并用本人代码、日志或脱敏材料补具体字段和个人故事。字数、完整段落与自动重复检查不能代替语义审阅和真实口头表达验收。

可从 [简历题库](http://localhost:3000/questions?preset=resume_focus)、[简历 P0 短轮](http://localhost:3000/practice/session?preset=resume_focus&resumePriority=P0&mode=daily&size=5) 或 [训练目标](http://localhost:3000/learning-target) 开始，按实际答题情况补充本人例子和证据。题目依据指定简历；W1 没有重新验证 VendorGuard 或实习代码，参考设计不扩大为本人履历。

后续按[求职者需求](docs/JOB_SEEKER_REQUIREMENTS.md)和批次计划继续：W0–W7已交付，日常学习/模拟/复盘与本地启动备份均可用；JD/AI/语音只有连续使用暴露真实需求后才进入W8评估。

W8尚未进入，先按本人实际使用记录区分JD选题、反馈与语音成本，再选一个最小方向；不自动引入模型或评分。固定队列/正式提交/个人资料/模拟复盘/统计与备份契约以源码、[W0](docs/JOB_SEEKER_W0_CONTRACT.md)、[W5](docs/JOB_SEEKER_W5_DELIVERY.md)、[W6](docs/JOB_SEEKER_W6_DELIVERY.md)和[W7](docs/JOB_SEEKER_W7_DELIVERY.md)为准。

现有局限：所有访问者共享 `default` 用户；普通草稿/续练入口、模拟和复盘未保存编辑依赖当前浏览器存储，已保存模拟/复盘可从服务端列表恢复；模拟列表显示最近 20 轮，旧记录可用轮次 URL 读取，复盘每页 10 条。复盘最多 20 问，已保存问题暂不支持删除/重排。核心路径固定；普通新增题不会自动成为核心新题；应用需本地 PostgreSQL。历史浏览器验收覆盖 Chrome 桌面与模拟手机，未验证 Safari、Firefox 或实体手机。

## 文档导航

- [README](README.md)：使用、安装、数据模型和常用命令。
- [AGENTS](AGENTS.md)：项目开发入口与 Next.js 安装版本规则。
- [学习效率交接计划](docs/LEARNING_EFFICIENCY_PLAN.md)：原计划及产品约定，已标注交付。
- [学习效率交付记录](docs/LEARNING_EFFICIENCY_DELIVERY.md)：2026-10-08 的验证、截图和备份证据。

- [简历题库整理与导入](docs/RESUME_QUESTION_BANK.md)：2026-10-09 的内容范围、练习入口、能力边界及个人数据保留验证。
- [求职者视角产品需求](docs/JOB_SEEKER_REQUIREMENTS.md)：2026-10-09 的现状分析、10 项需求与验收条件；当前交付状态见本文和开发计划。
- [求职者训练闭环开发计划](docs/JOB_SEEKER_DEVELOPMENT_PLAN.md)：W0–W7完成，W8按实际使用需求评估。
- [W0 数据与兼容契约](docs/JOB_SEEKER_W0_CONTRACT.md)：实际字段、请求 / 并发、范围 / 统计、兼容与升级步骤。
- [W1 简历入口、目标与短轮](docs/JOB_SEEKER_W1_DELIVERY.md)：2026-10-10 的实现、个人库迁移、41/28 回归、21 项交互、19 项只读检查与截图。
- [W2 简历答案分层](docs/JOB_SEEKER_W2_DELIVERY.md)：2026-10-11 的共用结构与折叠、Markdown 回退、43/28 回归、14 项交互、9 项只读检查和个人记录保留。
- [W3 个人卡、自查与卡点补练](docs/JOB_SEEKER_W3_DELIVERY.md)：2026-10-11 的接口、版本冲突、幂等归属、草稿/快照、46/40 回归、15 项交互与 11 项个人只读检查。
- [W4 范围正式覆盖与首期验收](docs/JOB_SEEKER_W4_DELIVERY.md)：2026-10-11 的一致快照统计、未练分页与固定队列、48/49 回归、13 项交互与 16 项个人只读检查。
- [W5 项目模拟与连续追问](docs/JOB_SEEKER_W5_DELIVERY.md)：2026-10-12 的五节点快照、独立保存恢复、隐藏未来内容、结束总结、十表恢复/十三表升级、52/60 回归、13 项交互与 16 项个人只读检查。
- [W6 真实复盘与关联补练](docs/JOB_SEEKER_W6_DELIVERY.md)：2026-10-12 的独立原话/个人字段、关联快照/正式补练、幂等/冲突恢复、R07、十三表恢复/十六表升级、56/73 回归、16 项交互与 27 项个人只读检查。
- [W7 Windows启动与备份恢复](docs/JOB_SEEKER_W7_DELIVERY.md)：2026-10-12的PowerShell入口、版本包/显式空库恢复、独立可读导出、58/84回归、真实冷启动/复用与14项个人HTTP。
- [领域词汇](CONTEXT.md)：目标、正式完成、个人卡、作答观察、卡点、正式覆盖、项目模拟和真实复盘补练的定义。
- [答案质量检查](docs/ANSWER_QUALITY_AUDIT.md)：2026-10-09 的长度口径、表述问题、重复范围和修订示例；[逐题明细](docs/ANSWER_QUALITY_AUDIT_DETAILS.json)。
- [答案质量修订交付](docs/ANSWER_QUALITY_REVISION.md)：2026-10-10 的全量修订、导入保留、备份恢复与 15 项 HTTP 检查；[修订后明细](docs/ANSWER_QUALITY_REVISION_DETAILS.json)。

接手时先核实本文的日期与事实；更新实际数量、入口、导入状态和本次检查结果，保留历史与新验证的区分。
