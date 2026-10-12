# 面试训练台

面向 Agent 开发与 LLM 应用开发岗位的个人刷题工具。支持简历与项目范围、训练目标、短轮练习、个人回答卡、要点自查、卡点补练、范围正式覆盖、项目模拟与连续追问、真实面试复盘与关联补练、自评与历史回看、到期复习。

开发与接手先阅读 [项目状态与开发交接](PROJECT_CONTEXT.md)，其中记录当前进度、运行状态、模块入口、开发习惯和验证证据。

## 本地启动

本机已有数据库与项目依赖时，Windows 日常启动直接运行：

```powershell
pwsh -NoProfile -File scripts/start-local.ps1
```

自动复用健康服务，或启动已有 `.local/postgres` 和生产应用；缺少生产构建时先构建。`-NoBrowser` 不打开页面，`-Port 3001` 选择应用端口，停止本项目应用后用 `-Build` 更新构建。启动不会导入、迁移或重置个人数据；端口冲突明确报错。[W7 使用、恢复与故障说明](docs/JOB_SEEKER_W7_DELIVERY.md)。

需要 Node.js 20.9+、pnpm 和 PostgreSQL。下面使用 Docker 启动数据库；已有本地 PostgreSQL 时可直接配置连接。项目默认连接本机 5432 端口。

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:push
pnpm db:seed
pnpm dev
```

打开 `http://localhost:3000`。上述 `pnpm dev` 在端口占用时使用下一个可用端口；W7 启动入口使用明确指定端口，冲突时显示原因。

`DATABASE_URL` 是唯一必需的环境变量，格式为 `postgres://用户:密码@主机:端口/数据库`。默认示例适用于 `compose.yaml`。修改数据库连接信息时同步更新 `.env` 与 Compose 配置。

## 已实现

- 首页提供“简历重点”“项目讲述”“基础补齐”三个入口，一点击开始 5 题，范围题数动态计算。[W1 交付与验证](docs/JOB_SEEKER_W1_DELIVERY.md)。
- [训练目标](http://localhost:3000/learning-target) 支持预设、项目、P0/P1/P2、5/10/20/40 分钟偏好档和可空面试日期，分别建议 3/5/10/20 题。首次访问不创建目标，保存不修改练习历史；目标改变只影响后续新轮次。
- 首页今日推荐按范围内到期复习、正式练过的薄弱题、核心或简历路径新题补齐；排除北京时间当天已正式完成并去重。简历新题按优先级、项目和稳定 ID 排序；范围外明确到期题单独提示。未配置目标继续通用 10 题和原 30 题核心路径，展示实际数量与来源组成。
- 首页同时展示今日和累计练习次数、掌握状态、到期复习数量及分类进度。
- [学习统计](http://localhost:3000/stats) 默认使用当前目标，显示正式覆盖、未练题、本人的自评、个人卡、证据填写和未解决卡点。可只读查看其他范围，分页未练题并开始本页 3/5 题固定队列；重复完成同题只算一道覆盖，自评、卡片和观察不计正式完成。[W4 交付与首期验收](docs/JOB_SEEKER_W4_DELIVERY.md)。
- 题库按题目文本、分类、难度、状态、预设、项目、简历优先级和回答性质筛选并分页；列表、数量和队列共用条件。项目识别使用 tags/subcategory，冲突或非法新范围参数显示修正入口；详情页可阅读 Markdown 答案和修改状态。
- 顺序、随机、薄弱题、到期复习四种模式，每轮选择 3、5、10 或 20 题，不足时使用实际题数。答案先隐藏；无需先查看答案即可标记掌握状态，支持键盘快捷键与继续刷题。
- 练习页可填写自己的回答，也可口头作答。文字草稿按本轮和题目自动保存到当前浏览器，切题、返回或刷新后恢复；新开一轮不会继承已完成的回答。未完成草稿不与其他设备同步。
- 点击“完成本题”保存回答与当次自评，计一次练习，并自动进入下一题；最后一题完成后显示总结。只点击“不会 / 模糊 / 掌握”调整状态不增加次数或改变复习时间。同一提交重试不会重复计数或推进复习安排。
- 可以提前结束本轮；总结展示已完成、跳过 / 未完成和三种自评数量，支持继续未完成题目或新开一轮练习本轮薄弱题。同一轮反复完成一题时，总结只统计该题的最新已保存自评，累计练习次数仍按实际完成次数计算。
- 网络或服务暂时失败时保留提交 ID 与回答，使用“重试保存”重试；400 / 401 / 403 / 404 / 409 / 422 等确定失败提供“保留回答并恢复编辑”，解除锁定并生成新的提交 ID。服务端保存成功但响应丢失时，刷新可恢复完成记录。
- 题目详情提供历史回答，按时间从新到旧分页显示；旧版标记事件继续保留并标注来源，累计次数仍包含这些旧记录。
- 复习页默认展示到期题目，包含到期的“掌握”题；仅标记过状态、尚无复习时间的题目先完成一次练习。按待首次练习、到期时间排序；同一时间下“不会”优先。“全部薄弱题”仍可随时练习不会和模糊题，按不会优先、较久未复习优先排序。
- 完成练习后安排下次复习：不会 1 天、模糊 3 天，二者重置连续掌握阶段；连续掌握按 1 / 3 / 7 / 14 天递增，之后保持 14 天。按完成时间计算间隔，页面用北京时间显示。
- 续练将本轮 ID、固定队列、当前题目 ID 和总结状态保存在 URL；刷新和首页“继续刷题”保持相同位置，状态变化后不会跳题，随机顺序也保持一致。已停用题目会跳过，新开一轮时重新筛选。已完成记录可从数据库恢复，未完成草稿依赖浏览器存储。
- 670 道种子题目：Agent 154、LLM 应用工程 144、RAG 120、LLM 82、Python 68、后端 60、数据库 42。原有 570 题中包含 70 道基础题，每个分类 10 道；原题保持 84 道简单题。
- 新增 100 道简历专项题，覆盖 VendorGuard、发票识别实习、项目讲述与关联基础。每题包含简历依据、短答思路、三个深入要点、验证场景、三个追问、误区、自评与资料；区分简历实战、基础关联和扩展设计。通过 [简历范围](http://localhost:3000/questions?preset=resume_focus) 与优先级直接筛选，原题干搜索仍可用；[整理与导入说明](docs/RESUME_QUESTION_BANK.md)。
- 30 道核心题按 LLM → Python → 后端 → 数据库 → RAG → LLM 应用工程 → Agent 排列。每题提供 3–5 条回答要点、1–2 条具体误区及真实项目举例提示，并保留短答、解释、示例、追问和资料；练习中先展示短答与要点，其余内容按需展开，切题后重新隐藏。
- 100 道简历题在详情和练习共用分层：展开参考后先读 60–90 秒短答、三个要点与回答性质，证据、依据、追问、误区、自评和资料按需展开。切题重新隐藏；数据库答案版本不一致时保留 Markdown 正文。[W2 交付与验证](docs/JOB_SEEKER_W2_DELIVERY.md)。
- 个人回答卡支持我的短答、真实例子、贡献边界与证据；详情、历史和总结提供编辑入口，可主动复制某次正式回答后修改。版本冲突保留编辑并支持对照合并，保存不修改历史或次数；独立作答时默认隐藏入口。
- 展开参考或进入详情后，可记录要点覆盖情况和五类卡点，保存当时文本快照；可独立保存，也可在正式完成后关联该次回答。草稿切题、收起和刷新可恢复，请求重试不会重复记录；正式提交待确认时先保留草稿。
- [我的卡点](http://localhost:3000/practice-gaps) 支持类型、解决状态和共享范围筛选，记录可回到题目与当次回答；支持解决/重开，以及按题去重的 3/5 题固定补练。停用题资料保留，补练跳过。[W3 交付与验证](docs/JOB_SEEKER_W3_DELIVERY.md)。
- [项目模拟面试](http://localhost:3000/mock-interviews) 支持 VendorGuard / 发票实习，按职责、主问题和三个已有追问逐节点作答。保存文字或口头简记、跳过、本人卡点和可选计时，支持暂停 / 刷新续答；结束后统一回顾参考快照与补练建议。模拟不改普通练习次数、自评或正式覆盖，提前结束保留未答，已结束轮次可查看、另开新轮。[W5 交付与验证](docs/JOB_SEEKER_W5_DELIVERY.md)。
- [真实面试复盘](http://localhost:3000/interview-reviews) 支持日期、可空岗位名称、实际问题、独立回答摘要、卡点和改进。只记录一个未收录问题也可保存；手动关联启用题后提供参考、个人卡和 3/5 题固定补练，原话与关联快照不随题库更新覆盖。补练状态只计算关联后新增正式完成，记录 / 编辑 / 打开补练不改普通次数；统计页按范围单独显示复盘问题的关联 / 已练 / 待练记录数。[W6 交付与验证](docs/JOB_SEEKER_W6_DELIVERY.md)。
- 2026-10-10 全部 670 道答案已修订并导入：普通短答 120–180、简历短答 240–270 个有效字符范围检查通过；补充每题机制和示例，共享背景标为补充。篇幅按 30–60 / 60–90 秒估算，未做真人计时；[修订交付与验证](docs/ANSWER_QUALITY_REVISION.md)。
- 自评区提供不会、模糊、掌握的独立回答标准；仅选择自评不计次数，口头或空白文字作答仍可完成。
- Python、后端和数据库题目围绕 AI 应用所需的服务端能力；题库不含前端分类。LLM 分类聚焦 token、上下文、模型选型、输出控制与评估，不考注意力公式、MoE、LoRA 训练等算法细节。
- 系统主题默认、手动明暗主题切换；移动端单列布局。
- Windows 日常启动、十六表实际 Schema / 全字段 / 序列完整备份、向独立空库恢复核对及 JSON / Markdown 可读导出。支持服务复用、端口 / 连接 / 构建 / 启动错误提示，不覆盖现有数据库；未保存浏览器草稿不在服务端备份中。[W7 交付与验证](docs/JOB_SEEKER_W7_DELIVERY.md)。

## 数据模型

- `users`：V1 使用固定 `default` 用户。网站无登录，部署到公网时所有访客共享这份练习记录；适合个人本地或私有部署。
- `questions`：题目、Markdown 答案、分类、子分类、难度、标签、启用状态与时间戳。停用题目不出现在题库、复习与进度统计中，但历史练习次数保留。
- `user_question_progress`：每个用户每道题的最新状态、复习次数、最近复习时间、连续掌握阶段 `review_stage` 与下次复习时间 `next_review_at`。
- `review_events`：完成的练习，保存当次自评、文字回答、时间、提交 ID 和可选本轮 ID `round_id`；提交 ID 按用户唯一，保证重试不会多计。`kind=legacy` 表示旧版状态记录，`kind=practice` 表示新的完整练习。本轮总结从这些事件恢复，打开练习页本身不写入数据库。
- `personal_answer_cards`、`practice_observations`、`answer_point_checks`、`practice_gaps`：长期个人卡、幂等观察父记录、要点快照及卡点；与正式完成分离，不改历史回答和复习安排。`learning_targets` 保存版本化目标，`app_schema_migrations` 记录受控迁移。
- `mock_rounds`、`mock_nodes`、`mock_round_actions`：项目模拟、五节点快照和独立作答、持久请求记录；revision 与 requestId 保证冲突核对和重试不重复推进。进行中服务端隐藏未来追问题干与参考，结束后统一读取；模拟卡点独立于 W3 长期卡点。
- `interview_reviews`、`interview_review_questions`、`interview_review_actions`：真实面试、原问题与个人复盘字段、持久修改请求；创建幂等、revision 冲突核对与独立草稿保留编辑。关联保存题干快照、时间与已有事件 ID 基线，同题多次面试独立跟进，不写普通正式事件或 W3 长期卡点。

Schema 位于 `src/db/schema.ts`。原有题目的题干和结论位于 `src/db/seed-data.ts`，逐题说明位于 `src/db/seed-notes.ts`，主题背景位于 `src/db/seed-context.ts`，逐题示例与部分独立短答位于 `src/db/original-examples.ts`；岗位场景题及各题讲解、示例位于 `src/db/expansion-*.ts`。基础题位于 `src/db/basic-questions.ts`，核心题精修位于 `src/db/core-answers.ts`。简历题由 `src/db/resume-questions.ts` 汇总，`resume-content.ts` 统一来源和答案结构，具体内容位于 `resume-agent.ts`、`resume-rag.ts`、`resume-engineering.ts`、`resume-foundations.ts`。

`pnpm db:seed` 可重复执行，按题目文本更新已有条目并保留题目 ID 和进度；旧版前端与被替换的算法题目改为停用，保留其历史事件。外键拒绝删除仍有练习记录的题目。导入时会校验总数、分类数量、题干唯一性、全文长度，以及 `src/db/answer-quality.ts` 定义的口头短答、有效讲解和示例要求。

网页、建表和导入脚本统一使用 `src/db/config.ts` 加载 `.env*`；显式环境变量优先。新库通过 `pnpm db:push` 建表。旧四表数据库的 W0 升级使用版本化增量迁移，先备份并在独立库恢复、核对后执行 `pnpm db:migrate:w0 --apply`；省略参数只显示说明，不连接数据库，详见 [W0 契约与迁移步骤](docs/JOB_SEEKER_W0_CONTRACT.md)。题库内容需要更新时运行 `pnpm db:seed`。旧事件自动归为 `legacy`，保留原有次数，不回填从未保存过的回答。旧进度的 `next_review_at` 为空，进入待首次练习列表，完成后生成新安排。

W0 已定义五张首期业务表和迁移版本表，W1 接入目标，W3 接入个人卡 / 观察 / 卡点，W4 接入范围统计，W5 / W6 分别接入项目模拟与真实复盘。2026-10-12 W6 经升级前十三表完整恢复与演练，受控迁移个人库到十六表；原记录与四个序列保留，五张首期业务表、三张模拟表和三张复盘表尚为空，无默认目标。页面读取不自动创建个人记录。[领域词汇](CONTEXT.md) 区分正式完成、个人卡、作答观察、正式覆盖、项目模拟和复盘补练。

`GET /api/learning-target` 只读当前目标；`PUT /api/learning-target` 严格校验并事务保存，保留旧版本。requestId 同配置重试返回原记录，不同配置返回 409；旧 inactive 请求不会重激活，写入失败回滚。保存只写目标，不增加正式练习事件。

`POST /api/mock-interviews` 明确创建固定模拟；`GET /api/mock-interviews/[id]` 只读续答 / 总结，`PUT` 保存草稿、已答、跳过或结束。已保存记录由服务端恢复，未保存编辑按轮次 / 节点隔离保存在浏览器；暂时失败重试原 requestId，版本冲突保留文字供本人核对。

`POST /api/interview-reviews` 创建真实复盘；`GET /api/interview-reviews/[id]` 只读详情，`PUT` 按 revision 与 requestId 保存编辑。`GET /api/interview-review-question-options?q=...` 只搜索启用题的轻量信息。已保存问题保留 ID / 顺序，新问题追加；公共关联可取消或更换，原话独立保留。

`PUT /api/progress` 只更新掌握状态；`POST /api/attempts` 在一个事务内记录回答、更新练习次数和复习安排，回答上限 10,000 字符，支持空白回答及可选的 `roundId`。不同提交并发完成同一题时，以进度行锁串行更新次数和复习阶段。同一提交 ID 携带不同内容或本轮 ID 时返回 409，防止覆盖已经完成的练习。

## 常用命令

日常启动与资料保存：

```powershell
pnpm local:start
pnpm local:backup
pnpm local:restore --from <备份目录>
pnpm local:export
# wrapper 不可用时：
pwsh -NoProfile -File scripts/start-local.ps1
node --import tsx scripts/local-data.ts backup
node --import tsx scripts/local-data.ts restore --from <备份目录>
node --import tsx scripts/local-data.ts export
```

备份默认写 `.local/backups/`，可读文件写 `.local/exports/`，每次创建新目录，均已忽略进入 Git。恢复默认只离线校验；实际恢复需明确 `RESTORE_DATABASE_URL` 指向另一空库并加 `--apply`，不会自动切换应用连接。完整包包含 Schema 与序列；可读导出不含这些信息，不能作为完整恢复备份。实际步骤见 [W7](docs/JOB_SEEKER_W7_DELIVERY.md)。

W0 迁移说明：`pnpm db:migrate:w0`。旧四表库使用 `--apply` 前先完成契约文档中的恢复演练；本机个人库已在 W1 完成该步骤，新空库继续用 `db:push`。不能改写已应用迁移文件。

W5 迁移说明：`pnpm db:migrate:w5`。已受控升级 W0 的旧库先备份、在独立库恢复并比对，再运行 `pnpm db:migrate:w5 --apply`；无参数不连接数据库。2026-10-12 本机个人库已完成，详见 [W5 恢复与迁移记录](docs/JOB_SEEKER_W5_DELIVERY.md)。

W6 迁移说明：`pnpm db:migrate:w6`。已受控升级 W0 / W5 的旧库先备份、独立恢复并比对，再运行 `pnpm db:migrate:w6 --apply`；无参数不连接数据库。2026-10-12 本机个人库已完成，详见 [W6 恢复与迁移记录](docs/JOB_SEEKER_W6_DELIVERY.md)。已应用的 W0 / W5 / W6 SQL 均冻结。

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm test
pnpm test:db
pnpm db:push
pnpm db:seed
```

`pnpm test` 验证题库、环境配置、范围解析与推荐、续练、总结、草稿隔离和复习间隔。`pnpm test:db` 自动启动独立 PostgreSQL 16，验证状态与正式完成区分、并发/重试/回滚、历史与轮次恢复、共享筛选、3/5/10/20 题、目标版本与幂等、迁移和 seed 保留个人表；结束后清理，不连接个人库，不依赖 Docker。2026-10-10 W1 通过 41 项单元、28 项集成、静态与生产构建，浏览器 21 项交互和个人应用 19 项只读检查通过。测试需要 Node.js 20.9+，Windows x64 测试 PostgreSQL 构建脚本已在 `pnpm-workspace.yaml` 配置。

## 后续方向

求职训练 [开发计划](docs/JOB_SEEKER_DEVELOPMENT_PLAN.md) 已完成 W0–W7：首期学习闭环、项目模拟、真实复盘，以及 Windows 启动、完整备份恢复与可读导出。2026-10-12 W7 通过 58 项单元、84 项集成、静态与生产构建、个人库公开 CLI 独立恢复、真实冷启动 / 重复复用和 14 项个人 HTTP 检查，十六表全字段与四序列保留；证据见 [W7 交付](docs/JOB_SEEKER_W7_DELIVERY.md)。W8 仅按连续使用暴露的需求评估 JD / AI / 语音，本轮未进入。

2026-10-09 [答案质量检查](docs/ANSWER_QUALITY_AUDIT.md)发现短答篇幅不足、模板重复和例子偏题；2026-10-10 已完成 [670 题修订与导入](docs/ANSWER_QUALITY_REVISION.md)。后续按实际练习朗读调整，并补本人证据；全文 Markdown 长度和自动字符检查不能代替讲解质量或真实口头表达验收。

V2 可在 `users` 与 `user_question_progress.user_id` 基础上接入登录与云端同步。后续可按实际需要评估 AI 辅助反馈、更多训练路径与语音；当前版本没有引入 AI 服务。本期学习效率优化的实现和验收记录见 [交付说明](docs/LEARNING_EFFICIENCY_DELIVERY.md)。
