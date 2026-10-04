# 面试训练台

面向 Agent 开发与 LLM 应用开发岗位的个人刷题工具。V1 聚焦连续刷题与掌握状态记录。

## 本地启动

需要 Node.js 20.9+、pnpm 和 Docker。项目默认连接本机 5432 端口的 PostgreSQL。

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:push
pnpm db:seed
pnpm dev
```

打开 `http://localhost:3000`。若 3000 端口已占用，Next.js 会使用下一个可用端口。

`DATABASE_URL` 是唯一必需的环境变量，格式为 `postgres://用户:密码@主机:端口/数据库`。默认示例适用于 `compose.yaml`。修改数据库连接信息时同步更新 `.env` 与 Compose 配置。

## 已实现

- 首页展示今日和累计练习次数、掌握状态及分类进度。
- 题库按题目文本、分类、难度、状态筛选并分页；详情页可阅读 Markdown 答案和修改状态。
- 顺序、随机、薄弱题刷题模式，答案先隐藏；支持键盘快捷键与继续刷题。
- 复习页按“不会”优先、“模糊”其次排序；统计页按已掌握 / 已标记计算分类掌握率。
- 500 道种子题目：Agent 120、LLM 应用工程 108、RAG 90、LLM 62、Python 50、后端 42、数据库 28。Python、后端和数据库题目围绕 AI 应用所需的服务端能力；题库不含前端分类。LLM 分类聚焦 token、上下文、模型选型、输出控制与评估，不考注意力公式、MoE、LoRA 训练等算法细节。
- 系统主题默认、手动明暗主题切换；移动端单列布局。

## 数据模型

- `users`：V1 使用固定 `default` 用户。网站无登录，部署到公网时所有访客共享这份练习记录；适合个人本地或私有部署。
- `questions`：题目、Markdown 答案、分类、子分类、难度、标签与时间戳。
- `user_question_progress`：每个用户每道题的最新状态、复习次数和最近复习时间。
- `review_events`：每次状态标记的事件，用于准确统计今日与累计练习次数。

Schema 位于 `src/db/schema.ts`。原有题目的题干和核心结论位于 `src/db/seed-data.ts`，逐题说明位于 `src/db/seed-notes.ts`，主题原理位于 `src/db/seed-context.ts`；新增岗位场景题位于 `src/db/expansion-*.ts`，落地案例位于 `src/db/answer-examples.ts`。答案按核心结论、原理、工程边界和案例组织。`pnpm db:seed` 可重复执行，按题目文本更新已有条目，保留仍在题库中的题目进度，并清理旧版前端与被替换的算法题目。导入时会校验总数、分类数量、题干唯一性和答案长度。

## 常用命令

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm db:push
pnpm db:seed
```

## 后续方向

V2 可在 `users` 与 `user_question_progress.user_id` 基础上接入登录与云端同步。后续可独立增加答案评价、智能推荐与模拟面试；当前版本没有引入 AI 服务或复杂基础设施。
