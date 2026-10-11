# W2：简历答案分层

交付日期：2026-10-11（北京时间）。对应 [开发计划](JOB_SEEKER_DEVELOPMENT_PLAN.md) W2，在 W1 工作区基础上完成，W1/W2 均未继续提交或推送。个人应用的新生产构建运行于 `http://localhost:3000`；下一批次是 W3 个人回答卡、要点检查、卡点和补练，尚未开始。

2026-10-11 后续状态：W3 已完成，W1–W3 合并提交 `0e67163` 并推送、核对远端 `main`；首期范围统计与完整流程验收见 [W4 交付](JOB_SEEKER_W4_DELIVERY.md)。下文保留 W2 当次范围与验证。

## 已交付的阅读流程

100 道简历专项题使用同一个分层组件。练习默认只显示题目与回答框，主动展开参考后显示回答性质与边界、60–90 秒短答、三个回答要点。深入拆解与证据准备、简历依据、连续追问、易错点、自评标准和资料为六个可单独展开的部分；题库详情直接显示短答与要点，深层部分同样默认折叠。

“简历实战”“基础关联”“扩展设计”显示各自边界，扩展设计明确使用“如果扩展，我会……”表述。假设场景不会变成本人新增经历。现有短答、要点、场景、证据、来源和追问原文全部保留，本批次没有调整字数或新增个人主张。

切题重新隐藏整个参考，收起再展开会重置深层折叠。草稿、自评、提交状态、固定队列和总结不受展开行为影响。普通题维持 Markdown，核心题维持原核心分层。若数据库答案与源码版本不同、元数据不匹配或题目未收录，详情与练习都显示数据库 Markdown，避免遗漏本人后续补充。

可从 [简历题库](http://localhost:3000/questions?preset=resume_focus) 或 [简历 3 题短轮](http://localhost:3000/practice/session?preset=resume_focus&mode=daily&size=3) 使用；本机核实的三种题目样例为 [简历实战](http://localhost:3000/questions/1729)、[基础关联](http://localhost:3000/questions/1734)、[扩展设计](http://localhost:3000/questions/1740)。样例 ID 仅是本机记录，不作为选题逻辑。

## 内容与实现

`ResumeEntry` 仍是唯一编辑来源。`resume-content.ts` 从原字段构建可序列化的 `ResumeLearningEntry`，并由同一对象生成种子 Markdown；没有反向解析 Markdown。`resume-questions.ts` 在服务端按题目身份查找，核对分类、子分类、范围元数据和正文版本后返回对应结构。

| 入口                                                 | 本次变化                                                  |
| ---------------------------------------------------- | --------------------------------------------------------- |
| `src/db/resume-content.ts`                           | 轻量结构、统一题干生成、结构到原 Markdown 的生成          |
| `src/db/resume-questions.ts`                         | 服务端结构查询及版本/元数据不一致时回退                   |
| `src/components/question/resume-learning-answer.tsx` | 短答、要点、性质边界与六个原生 details 折叠               |
| `src/app/questions/[id]/page.tsx`                    | 详情使用相同分层组件                                      |
| `src/app/practice/session/page.tsx`                  | 仅传本轮结构化内容；已识别简历题不重复序列化完整 Markdown |
| `src/components/practice/practice-session.tsx`       | 参考区域接入分层，复用既有切题重置与提交恢复              |
| `tests/unit/resume-learning.test.ts`                 | 全量内容一致/可序列化，以及旧版本、坏身份与普通题回退     |

客户端只有结构类型引用，没有导入全量简历题库。样式复用既有核心分层、Markdown 和主题变量；原生 summary 支持键盘展开。W2 不改 Schema、迁移、题干身份、公共答案或个人记录，也不新增个人卡、观察或卡点接口。

## 验证

2026-10-11：43/43 单元测试、28/28 独立 PostgreSQL 集成测试、ESLint、TypeScript 和 Next.js 16.3.6 生产构建通过。全部工作区改动的 Prettier 与差异检查通过，本次五份文档的 66 个本地链接核对通过。新增两项单元契约检查覆盖全部 100 道结构化内容及失配回退，原有筛选、推荐、短轮、幂等、迁移和个人表保留回归通过。

本机数据库启动后只读核对：670 道启用题的答案与源码一致，100 道简历题均可映射结构；题干和身份未更新。个人应用 9 项 HTTP/服务端内容检查通过：首页、简历范围、三种性质的详情、目标页、练习设置、复习和统计。检查前后十张表的全记录与所有序列逐字段一致：1 用户、670 题、13 进度、14 历史事件，五张业务表为空，迁移版本记录一条。没有在个人库造测试记录、执行 seed 或迁移。

只读快照与结果在 `.local/backups/job-seeker-w2-20261011/records-before.json` 和 `verification.json`，本机忽略。这是本次十表与序列核对证据，不是完整 Schema 恢复包；可恢复的 W1 升级前备份保持在原目录，统一备份工具仍待 W7。

个人新构建运行于 3000（本次启动 PID 14348），持久 PostgreSQL 5432（本次核实 PID 17284）。实际启动读取原持久目录，无新建个人库。日志为 `.local/ui-app.stdout.log` / `.local/ui-app.stderr.log`，应用 stderr 为空；后续接手根据端口与进程命令核对，不直接复用旧 PID。

### 浏览器环境与必要检查

验证流程：简历题详情 → 3 题练习独立回答 → 展开短答/要点/证据 → 切题与刷新 → 保存失败重试/响应丢失恢复 → 总结续练。

使用独立 PostgreSQL 和新生产服务 `http://localhost:3001`，Playwright + 已安装 Chrome；Browser 插件及 browser skill 未列出，原因记录为 `Browser plugin not available`。未安装依赖。桌面 1440×1000、移动 375×812，浅色、深色、减少动画设置。临时浏览器、服务及数据库已经清理，所有故障注入和写入只在独立库。

| 必要检查   | 结果                                                                            |
| ---------- | ------------------------------------------------------------------------------- |
| 页面身份   | URL 和面试训练台标题正确，三类简历详情可用                                      |
| 非空页面   | 题目、回答框和实际短答/要点渲染，初始参考隐藏                                   |
| 框架覆盖层 | 无 Next.js 错误覆盖层                                                           |
| 控制台     | 意外 page error、warning/error 为 0；注入的 503 与响应丢失网络错误标记 expected |
| 截图       | 初始隐藏、桌面分层、移动浅色、移动深色证据共四张；已视觉核对后三张              |
| 交互       | 折叠、键盘、切题、草稿、自评、短轮失败恢复、总结与回退共 14 项检查通过          |

14 项覆盖：三种回答性质的详情与不写记录；初始全部隐藏；展开保留草稿/自评/练习记录；键盘打开六层并访问来源链接；收起重置；切题焦点、刷新草稿与固定队列；展开期间 503 后保持 attemptId 且只保存一次；成功响应丢失后刷新恢复且无重复事件；提前总结与续练；普通/核心展示兼容；修改数据库答案后两入口均保留正文；375 像素长代码只在容器内滚动；移动浅深主题与减少动画无横向溢出；控制台健康。

证据在 `D:/CodexHome/visualizations/2026/10/11/agent-interview-w2/`：`qa.json` 记录完整结果与故障注入，`build.log` / `db-test.log` 记录构建和集成结果，独立服务日志为 `app.stdout.log` / `app.stderr.log`。本轮未验证 Safari、Firefox 或实体手机，未做真人朗读计时；分层和字符范围不能代替口头表达验收。

主要检查使用仓库 Node 入口：`node --import tsx --test tests/unit/*.test.ts`、`node --conditions=react-server --import tsx --test tests/integration/*.test.ts`、ESLint、`tsc --noEmit`、Next.js build/start、Prettier 与 `git diff --check`。临时浏览器脚本使用 goto、角色/标签定位、summary 键盘 Enter、读取队列与草稿、route 故障注入和 screenshot；收尾删除无用脚本，保留成功证据。

### 截图

![桌面：短答、三个要点与折叠内容](D:/CodexHome/visualizations/2026/10/11/agent-interview-w2/desktop-layers.png)
![移动端浅色短答](D:/CodexHome/visualizations/2026/10/11/agent-interview-w2/mobile-layers.png)
![移动端深色证据展开](D:/CodexHome/visualizations/2026/10/11/agent-interview-w2/mobile-dark-evidence.png)
