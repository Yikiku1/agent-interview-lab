## 项目长期上下文

- 每次开始本项目任务，先阅读 [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)，再检查与任务相关的源码及实际状态；跨对话接手也遵循此入口。
- 每次任务收尾前，同步更新该文档中受影响的功能、开发进度、运行与数据状态、决策、开发约定、验证结果和未完成事项，并使用北京时间标注更新日期；无变化的内容保持准确，不添加虚构进度。
- 新验证写明范围、日期和结果；未重新验证的历史结果保留原日期。项目事实以源码和实际验证为准，长期记忆用于定位本文，不另外维护一份易过期的项目状态副本。
- 重大交付另存 `docs/`，在本文链接；`CLAUDE.md` 保持对本文件的兼容引用。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
