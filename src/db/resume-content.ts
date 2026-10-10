import type { SeedQuestion } from "./seed-data";
import type {
  ProjectScope,
  ResumeKind,
  ResumePriority,
} from "../lib/learning-contract";

export const resumeSource = {
  title: "刘宇文-AI-Agent开发-秋招简历-2027届-Classic-JD定向.pdf",
  snapshot:
    "用户于 2026-10-09 提供的两页简历；项目数字是简历记载的历史验证结果。",
  anchors: {
    overview: [
      1,
      "个人简介 / VendorGuard 项目介绍",
      "从 0 到 1 独立开发供应商材料审查 Agent，完成工具调用循环、Prompt 约束、制度 RAG 与认证工作台。",
    ],
    skills: [
      1,
      "专业技能",
      "SQLAlchemy、JWT、Alembic 为项目中简单使用；PostgreSQL、pgvector、LangGraph、MCP、混合检索与重排标为了解。",
    ],
    tools: [
      1,
      "Agent 核心实现 / 工具调用闭环",
      "材料读取、规则核对、制度检索、追问和报告提交 5 个工具；8 次模型请求、12 次工具尝试、120 秒总预算。",
    ],
    facts: [
      1,
      "Agent 核心实现 / 事实与引用约束",
      "身份、日期核对及规则计算交由程序；未经来源核对的事实不进入规则计算；引用来自本轮真实返回节点，拦截越权准入措辞。",
    ],
    rag: [
      1,
      "Agent 核心实现 / 制度 RAG",
      "章节及表格行分块、Embedding 缓存、现行版本过滤、本地向量缓存精确余弦 Top-5；保存版本、定位路径与原文。",
    ],
    ending: [
      1,
      "Agent 核心实现 / 追问与结束控制",
      "ask_user / submit_report 是唯一追问与结论出口；一次补充保留原文和独立来源，第二轮重新读取、核对和检索。",
    ],
    trace: [
      2,
      "工程交付 / 运行轨迹与工作台",
      "CLI 与认证单页工作台共用审查应用层；记录脱敏参数、执行结果、引用原文及 token 用量，支持一次补充与报告反馈。",
    ],
    prompt: [
      2,
      "工程交付 / Prompt 与输出约束",
      "系统提示词和工具说明明确追问条件、报告结构与引用要求；Pydantic 和程序校验处理参数错误、无效引用及越权结论。",
    ],
    failure: [
      2,
      "工程交付 / 失败重跑与记录",
      "扫描件在材料层拒绝且不调用模型；端点失败产生可重跑记录，重跑关联新记录保留旧证据；按用户隔离，单进程原子替换与按记录加锁。",
    ],
    tests: [
      2,
      "项目验证 / 自动化验证",
      "2026.09 验证记录：384 项单元测试、Ruff、格式及 mypy strict 通过；M4 收尾时 113 项集成测试通过。",
    ],
    evaluation: [
      2,
      "项目验证 / 检索评测",
      "固定 8 题：3 道正常题、2 道前提纠正题必需依据进入 Top-5，非现行版本命中 0；3 道无答案题仍需人工语义核对。",
    ],
    acceptance: [
      2,
      "项目验证 / 端到端验收",
      "真实模型与页面验收完整材料、缺项补充、依据不足、扫描件拒绝、端点失败、关联重跑 6 条路径。",
    ],
    internship: [
      2,
      "实习经历 / 职责范围",
      "2026.06-2026.08，跨境物流发票智能处理平台；负责文档识别、模型路由和字段校验模块。",
    ],
    extraction: [
      2,
      "实习经历 / 结构化抽取",
      "Python、Qwen/OpenAI 兼容 API 抽取表格、Word、PDF、图片；长文档分区识别、结果合并，保留分区定位信息。",
    ],
    routing: [
      2,
      "实习经历 / 文本与视觉路由",
      "Markdown 文本优先；扫描 PDF、表格塌缩、数据型批注、转换失败回退视觉模型。",
    ],
    validation: [
      2,
      "实习经历 / 抽取结果校验",
      "对照原始文档核对结构化字段，输出匹配、异常与未知等状态；无文本基线时明确跳过校验。",
    ],
    invoker: [
      2,
      "实习经历 / 调用层扩展",
      "扩展已有 ModelInvoker / Provider，统一文本与视觉入口，复用 JSON 校验、输入长度保护和重试，补充单元与集成测试。",
    ],
    codex: [
      1,
      "专业技能 / AI 辅助开发",
      "使用 Codex 拆解任务、实现、排查与补测试，结合 Git diff、pytest、Ruff/mypy 验证结果。",
    ],
  },
} as const;

export type ResumeEntry = {
  question: string;
  source: keyof typeof resumeSource.anchors;
  priority: ResumePriority;
  difficulty: SeedQuestion["difficulty"];
  kind: ResumeKind;
  oral: string;
  points: readonly [string, string, string];
  evidence: string;
  followUps: readonly [string, string, string];
  pitfall: string;
};

export type ResumeGroup = {
  category: SeedQuestion["category"];
  scope: ProjectScope;
  sources: readonly [label: string, url: string][];
  entries: readonly ResumeEntry[];
};

const boundaries = {
  简历实战:
    "按简历已写明的经历回答；具体代码、事故、耗时与个人贡献需用本人证据补充，示例场景不是新增履历事实。",
  基础关联:
    "这是由简历引出的知识追问；说明原理并联系项目，不能把参考设计直接说成项目已有实现。",
  扩展设计:
    "这是改进或假设题；先说明简历中的现状，再用“如果扩展，我会……”回答。",
};

export function resumeQuestionsFrom(
  groups: readonly ResumeGroup[],
): SeedQuestion[] {
  return groups.flatMap((group) =>
    group.entries.map((entry) => {
      const [page, section, claim] = resumeSource.anchors[entry.source];
      return {
        category: group.category,
        subcategory: `简历专项 · ${group.scope}`,
        difficulty: entry.difficulty,
        question: `【简历 ${entry.priority} · ${group.scope}】${entry.question}`,
        tags: [
          group.category,
          "简历专项",
          group.scope,
          entry.priority,
          entry.kind,
        ],
        answer: [
          "### 简历依据与能力边界",
          `来源：指定简历第 ${page} 页，${section}。\n\n> ${claim}\n\n${resumeSource.snapshot}\n\n${boundaries[entry.kind]}`,
          "### 60–90 秒回答思路",
          entry.oral,
          "### 深入拆解与回答要点",
          entry.points.map((point) => `- ${point}`).join("\n"),
          "### 场景与验证准备",
          entry.evidence,
          "### 连续追问",
          entry.followUps.map((question) => `- ${question}`).join("\n"),
          "### 易错点与表达边界",
          entry.pitfall,
          "### 自评标准",
          `- 不会：不能解释题目中的机制，或混淆简历事实与设想。\n- 模糊：能说出结论，但讲不清“${entry.followUps[0]}”或缺少可核对例子。\n- 掌握：能独立讲清三个回答要点，用上述场景说明判断过程，并承接三个追问；本人经历与扩展设计表述准确。`,
          "### 延伸资料",
          group.sources
            .map(([label, url]) => `- [${label}](${url})`)
            .join("\n"),
        ].join("\n\n"),
      };
    }),
  );
}
