# W1：简历入口、范围筛选、训练目标和短轮

交付日期：2026-10-10（北京时间）。对应 [开发计划](JOB_SEEKER_DEVELOPMENT_PLAN.md) 的 W1，遵循 [W0 契约](JOB_SEEKER_W0_CONTRACT.md)。此前 W0 与 670 题答案修订已在 `3756f01` 提交并推送，远端 `main` 的 SHA 一致。本次 W1 已实现、验证并启动于 `http://localhost:3000`，保留工作区供审查，未继续提交或推送。

2026-10-11 后续交付：[W2 简历答案分层](JOB_SEEKER_W2_DELIVERY.md)已完成；下文保留 W1 当次范围、运行和验证证据，当前状态见 [项目上下文](../PROJECT_CONTEXT.md)。

## 可用流程

首页提供“简历重点”“项目讲述”“基础补齐”三个入口，当前动态范围题数分别为 100、78、22；一点击进入 5 题推荐。题库和练习设置可组合预设、项目、P0/P1/P2、回答性质，以及原分类、难度、状态、题干搜索。VendorGuard + P0 当前为 37 题；数量来自查询，不写死在页面中。

范围识别使用 tags 和 subcategory，题干装饰不参与判断。列表、范围题数、选题和推荐候选共用 SQL 条件，并用内存契约逐题核对。非法、重复或冲突的新范围参数显示“范围条件无效”与修正入口；不会扩大成全部题库。

训练目标页支持通用核心、简历重点、项目讲述、基础补齐，项目与优先级，以及 5/10/20/40 分钟偏好档和可空面试日期。档位建议 3/5/10/20 题，只决定轮次规模。第一次打开页面不创建目标，未配置者继续原通用推荐。

目标推荐按范围内到期题、正式练过的薄弱题、未正式练过的路径题补齐。路径新题依次按 P0/P1/P2、VendorGuard/发票实习/综合/技术基础、稳定 ID 排序，去重并排除北京时间当天正式完成题。目标范围外的明确到期题单独提示，可打开独立复习列表；不会占用本轮推荐。

手动设置支持 3/5/10/20 题，不足时使用实际数量。已有有效 queue 优先恢复，目标改变不重选旧轮次。3/5 题复用 roundId、草稿隔离、attemptId、总结、提前结束、重试和成功响应丢失恢复。原通用 30 题核心路径和 10/20 题入口保留。

入口：

- [首页](http://localhost:3000)：三种求职入口和当前目标推荐。
- [训练目标](http://localhost:3000/learning-target)：主动保存目标。
- [简历题库](http://localhost:3000/questions?preset=resume_focus)。
- [VendorGuard P0](http://localhost:3000/questions?track=resume&project=VendorGuard&resumePriority=P0)。
- [简历 3 题](http://localhost:3000/practice/session?preset=resume_focus&mode=daily&size=3)。

## 实现与接口

| 入口                                                                 | 作用                                   |
| -------------------------------------------------------------------- | -------------------------------------- |
| `src/lib/question-filters.ts`、`learning-options.ts`                 | 共享解析、显示标签和 URL 序列化        |
| `src/lib/questions.ts`                                               | SQL 元数据条件、范围数量和原有选题查询 |
| `src/lib/learning-target.ts`、`src/app/api/learning-target/route.ts` | 只读目标查询与事务保存                 |
| `src/lib/daily-practice.ts`、`daily-practice-query.ts`               | 短轮、路径新题、范围外到期数量         |
| `src/app/learning-target/`、`learning-target-form.tsx`               | 目标配置、错误保留和同请求重试         |
| `src/app/practice/page.tsx`、`practice-setup.tsx`                    | 服务端解析 URL，客户端设置练习         |
| 首页、题库、练习 session、复习页                                     | 入口、共享范围、旧队列优先、范围外复习 |
| `learning-scope-fields.tsx`、`invalid-filters.tsx`                   | 共用范围控件与冲突修正                 |

`GET /api/learning-target` 返回 `{ target: null }` 或当前目标。`PUT` 严格校验 payload，在事务内锁用户行，旧目标 inactive、新目标插入；用户始终只有一个 active 目标。新请求返回 201，同 requestId 同配置返回 200，不同配置返回 409。旧 inactive 请求重试不会重新激活；写入失败回滚旧目标状态。临时失败保留表单和 requestId，保存后刷新服务端读取。

目标保存仅写 learning_targets，不修改四张原表，不产生正式事件。个人回答卡、观察、卡点接口及简历答案分层仍待 W2/W3 实施。W4 的正式覆盖统计也没有提前交付。

## 个人库迁移与保留

先停止应用写入，保存本次原四表全记录、Schema 和序列，在独立 PostgreSQL 实际恢复并迁移；验证正式提交重试、轮次恢复、目标保存不改练习后，才执行个人库增量迁移。已应用 `0001_job_seeker_foundation`，checksum 与原 SQL 一致，没有改写历史迁移。

个人库现在有十张表：原 users/questions/user_question_progress/review_events、五张首期业务表，以及迁移版本表。迁移和 19 项只读 HTTP 检查前后，四表所有字段与原序列一致；670 题、1 用户、13 进度、14 事件保留。五张新业务表为空，GET 目标返回 null，无默认目标、无个人验收事件。

备份：`.local/backups/job-seeker-w1-20261010/`，本机忽略，不进入 Git。

| 文件                     | 内容                                            |
| ------------------------ | ----------------------------------------------- |
| `records-before.json`    | 本次迁移前四表全部记录，保留时间戳精度          |
| `restore-records.sql`    | 原四表 Schema、记录、序列状态；用于空独立库恢复 |
| `sequences-before.json`  | 原序列 last_value/is_called                     |
| `rehearsal.json`         | 独立恢复、迁移、正式提交与目标保存验证          |
| `verification.json`      | 个人迁移、四表及序列保留结果                    |
| `http-verification.json` | 19 项个人应用只读检查与数据比对                 |

此备份保存升级前四表，不是未来新增个人卡等数据的十表备份工具；统一备份仍由 W7 交付。

## 验证结果

2026-10-10：41/41 单元测试、28/28 独立 PostgreSQL 集成测试、ESLint、TypeScript、Next.js 16.3.6 生产构建通过。全部本次改动通过 Prettier 和差异检查，六份交付及上下文文档的 70 个本地链接核对通过。新增 3 项单元和 7 项集成测试，覆盖组合条件、坏元数据、路径排序、当天排除、范围外到期、目标幂等/冲突/并发/回滚，以及短轮提交重试、恢复、空范围和停用题。

个人服务以新构建启动于 3000；本次启动 PID 17360，PostgreSQL 5432 本次核实 PID 24892。后续根据端口和进程命令核实，不直接信任旧 PID。日志 `.local/ui-app.stdout.log` / `.local/ui-app.stderr.log`，检查后 stderr 为空。

个人应用只读检查 19 项通过：主页、全题库、三种预设、VendorGuard P0、冲突条件、目标页面与 GET、3/5 题设置与队列、已有固定队列、原 daily 10 和 manual 20、复习、统计、范围外复习。均为 HTTP 200 且核对服务端内容；Next.js 流式跳转跟随页面 redirect 后核对 queue。这些不替代以下真实浏览器交互验收。

### 浏览器验收

验证流程：首页 → 简历 5 题 / 范围筛选 → 保存训练目标 → 3/5 题作答 → 失败重试、提前结束、刷新恢复与总结。

环境是 `http://localhost:3001` 的新生产构建和独立临时 PostgreSQL，使用 Playwright + 已安装 Chrome，桌面 1440×1000、模拟手机 375×812。Browser 插件及 browser skill 未列出，记录原因 `Browser plugin not available`；未安装新依赖。浏览器、临时服务和数据库已清理，写入验收没有接触个人库。

| 必要检查       | 结果与证据                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------- |
| 页面身份       | URL、标题为面试训练台，入口符合预期                                                         |
| 非空页面       | main 显示实际内容，三种预设题数 100/78/22                                                   |
| 框架错误覆盖层 | 未出现 Next.js error overlay                                                                |
| 控制台         | 意外 page error、warning/error 为 0；故障注入的 503/400/丢失响应网络错误均单独标记 expected |
| 截图           | 桌面首页与筛选结果、移动练习和目标表单四张；已检查筛选和移动练习布局                        |
| 交互           | 一点击进入 5 题；筛选/数量/队列一致；目标保存、短轮恢复及完整完成均通过                     |

21 项检查全部通过。3 题场景验证草稿切题/刷新、提前结束续练、503 保持 attemptId、成功响应丢失恢复且无重复事件、目标改变不重排队列、总结刷新。5 题场景验证 400 后恢复编辑并保留回答、完整完成准确计五个正式事件。还验证目标临时失败后同 requestId 重试、刷新后保留且练习记录不变、范围外到期入口、通用预设清空冲突字段、原 10/20 题以及移动端无横向溢出。

证据目录：`D:/CodexHome/visualizations/2026/10/10/agent-interview-w1/`。`qa.json` 保存逐项结果、环境、故障注入日志；`app.stdout.log` / `app.stderr.log` 保存独立服务日志。截图为 `desktop-home.png`、`desktop-filtered.png`、`mobile-practice.png`、`mobile-target.png`。

主要命令沿用仓库 Node 入口：单元 `node --import tsx --test tests/unit/*.test.ts`；集成 `node --conditions=react-server --import tsx --test tests/integration/*.test.ts`；ESLint、Next.js build/start、Prettier 和 `git diff --check`。临时浏览器脚本调用 Chromium launch、goto、按角色/标签操作、读取 URL 与页面文字、故障 route 拦截和 screenshot；收尾删除无用脚本。

本轮未新增 Safari、Firefox、实体手机、深色主题与专门键盘遍历验收。W2–W8 待实施；下一批次是 W2 简历答案分层。

### 截图

![VendorGuard P0 筛选结果](D:/CodexHome/visualizations/2026/10/10/agent-interview-w1/desktop-filtered.png)
![375 像素移动端练习设置](D:/CodexHome/visualizations/2026/10/10/agent-interview-w1/mobile-practice.png)
