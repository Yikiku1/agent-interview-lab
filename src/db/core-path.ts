// Lightweight identity and order; full learning content stays on the server.
export const coreCategoryOrder = [
  "LLM",
  "Python",
  "后端",
  "数据库",
  "RAG",
  "LLM 应用工程",
  "Agent",
] as const;
export const corePath = [
  {
    key: "token-budget",
    question: "为什么同样的中文字符数可能消耗不同 token 数？",
    category: "LLM",
  },
  {
    key: "long-context",
    question: "上下文窗口变大为何不保证长文理解更好？",
    category: "LLM",
  },
  {
    key: "temperature",
    question: "temperature 调低后输出一定正确吗？",
    category: "LLM",
  },
  {
    key: "structured-output",
    question: "如何减少模型输出不符合 JSON 结构的情况？",
    category: "LLM",
  },
  {
    key: "model-selection",
    question: "为什么只看公开榜单不能决定模型选型？",
    category: "LLM",
  },
  {
    key: "mutable-default",
    question: "为什么不建议把可变列表作为函数默认参数？",
    category: "Python",
  },
  {
    key: "coroutine-task",
    question: "`async def` 调用后为什么不立即执行函数体？",
    category: "Python",
  },
  {
    key: "blocking-sleep",
    question: "异步接口里直接调用 `time.sleep` 会怎样？",
    category: "Python",
  },
  {
    key: "gil",
    question: "Python 的 GIL 会如何影响 CPU 密集型服务？",
    category: "Python",
  },
  {
    key: "fastapi-blocking",
    question: "FastAPI 的 `async` 路由里调用同步数据库驱动会怎样？",
    category: "后端",
  },
  {
    key: "idempotent-create",
    question: "如何设计可安全重试的创建订单接口？",
    category: "后端",
  },
  {
    key: "jwt",
    question: "JWT 签名能保护哪些内容，不能保护哪些？",
    category: "后端",
  },
  {
    key: "transfer-transaction",
    question: "一次转账怎样保证余额扣减与增加同时成功？",
    category: "数据库",
  },
  {
    key: "left-join",
    question: "`LEFT JOIN` 后在 `WHERE` 中过滤右表字段会怎样？",
    category: "数据库",
  },
  {
    key: "explain",
    question: "`EXPLAIN ANALYZE` 与 `EXPLAIN` 有何差别？",
    category: "数据库",
  },
  {
    key: "rag-boundary",
    question: "RAG 解决了 LLM 应用中的哪些问题，又不能解决什么？",
    category: "RAG",
  },
  {
    key: "chunking",
    question: "Chunk 太大或太小分别会造成什么问题？",
    category: "RAG",
  },
  {
    key: "embedding-migration",
    question: "更换 embedding 模型时，旧向量能与新向量混用吗？",
    category: "RAG",
  },
  {
    key: "hybrid-retrieval",
    question: "为什么企业知识库常用混合检索？",
    category: "RAG",
  },
  {
    key: "rag-evaluation",
    question: "RAG 评估为什么应拆成检索和生成两部分？",
    category: "RAG",
  },
  {
    key: "ai-requirements",
    question: "业务方说“想做一个 AI 助手”，工程师先问什么？",
    category: "LLM 应用工程",
  },
  {
    key: "agent-choice",
    question: "什么时候应把 LLM 流程做成 Agent？",
    category: "LLM 应用工程",
  },
  {
    key: "qa-metrics",
    question: "如何给问答产品定义成功指标？",
    category: "LLM 应用工程",
  },
  {
    key: "demo-production",
    question: "一个应用 Demo 看起来很好，为什么仍可能不能上线？",
    category: "LLM 应用工程",
  },
  {
    key: "prompt-versioning",
    question: "为什么 prompt 不能只存在某位开发者的笔记里？",
    category: "LLM 应用工程",
  },
  {
    key: "agent-definition",
    question: "一个 LLM 应用何时算 Agent，而不只是聊天机器人？",
    category: "Agent",
  },
  {
    key: "react-loop",
    question: "ReAct 循环中的 Reason、Act、Observe 各负责什么？",
    category: "Agent",
  },
  {
    key: "tool-validation",
    question: "模型返回工具调用参数后，服务端为什么仍要校验？",
    category: "Agent",
  },
  {
    key: "agent-evaluation",
    question: "评估 Agent 不能只看最终回答，为什么？",
    category: "Agent",
  },
  {
    key: "tool-timeout",
    question: "工具调用超时后，Agent 可以直接重试吗？",
    category: "Agent",
  },
] as const;
export type CoreQuestionKey = (typeof corePath)[number]["key"];
