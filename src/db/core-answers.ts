import {
  learningAnswer,
  type LearningEntry,
  type CoreLearningEntry,
} from "./learning-content";
import { corePath, type CoreQuestionKey } from "./core-path";

const sources: Record<string, LearningEntry["sources"]> = {
  Agent: [
    [
      "Anthropic：Building effective agents",
      "https://www.anthropic.com/engineering/building-effective-agents",
    ],
  ],
  LLM: [
    [
      "Hugging Face：LLM Course",
      "https://huggingface.co/learn/llm-course/chapter1/1",
    ],
    [
      "Transformers：Generation",
      "https://huggingface.co/docs/transformers/main/en/main_classes/text_generation",
    ],
  ],
  RAG: [
    [
      "LangChain：Retrieval",
      "https://docs.langchain.com/oss/python/langchain/retrieval",
    ],
    ["Qdrant：Search", "https://qdrant.tech/documentation/concepts/search/"],
  ],
  "LLM 应用工程": [
    [
      "Anthropic：Building effective agents",
      "https://www.anthropic.com/engineering/building-effective-agents",
    ],
  ],
  Python: [
    ["Python 官方教程", "https://docs.python.org/3/tutorial/"],
    [
      "asyncio：Coroutines and Tasks",
      "https://docs.python.org/3/library/asyncio-task.html",
    ],
  ],
  后端: [
    ["FastAPI：async / await", "https://fastapi.tiangolo.com/async/"],
    [
      "MDN：HTTP 请求方法",
      "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods",
    ],
    ["RFC 7519：JWT", "https://www.rfc-editor.org/rfc/rfc7519"],
  ],
  数据库: [
    [
      "PostgreSQL：Transactions",
      "https://www.postgresql.org/docs/current/tutorial-transactions.html",
    ],
    [
      "PostgreSQL：Joins",
      "https://www.postgresql.org/docs/current/tutorial-join.html",
    ],
    [
      "PostgreSQL：Using EXPLAIN",
      "https://www.postgresql.org/docs/current/using-explain.html",
    ],
  ],
};

const content: Record<
  CoreQuestionKey,
  Omit<CoreLearningEntry, "question" | "category" | "sources">
> = {
  "token-budget": {
    oral: "token 数由目标 tokenizer 决定，不是固定字符切分。常见词、术语、代码和符号会有不同切法，应以实际编码结果计算。",
    keyPoints: [
      "token 数由具体模型的 tokenizer 与词表决定。",
      "同字数的常见词、术语、代码和符号可能有不同切分。",
      "输入预算包含系统提示、历史、工具定义和检索证据，还要预留输出。",
      "用实际编码与供应商用量报告核对，换模型后重新验证。",
    ],
    explanation:
      "不同模型词表和消息封装不同，同一输入的 token 数可能变化。系统提示、历史、工具定义和检索证据都消耗输入预算，输出也要预留空间。字符比例只能粗估，不能用于精确截断或计费。",
    example:
      "对同字数的日常中文、技术术语和代码分别编码，比较 token 数。上线记录真实输入输出分布；若本地 tokenizer 没有计算服务端消息封装，以供应商实际报告核对计费。",
    pitfalls: [
      "把中文字符数乘固定比例用于精确截断，会漏算术语、消息封装和工具定义。",
    ],
    followUps: [
      "工具 schema 是否也消耗 token？",
      "换模型后为什么要重测截断规则？",
    ],
    projectPrompt:
      "从你做过的一次模型请求出发，说明哪些内容占用了预算、如何截断及如何核对实际用量。",
  },
  "long-context": {
    oral: "窗口限制能接受多少 token，不保证准确利用全部信息。长文仍可能淹没证据、混入旧版本，并增加成本和延迟。",
    keyPoints: [
      "上下文窗口表示输入容量，不保证所有证据都被准确利用。",
      "长文会增加噪声、版本冲突、成本和延迟。",
      "检索、重排与摘录要保留关键前提和例外条件。",
      "用关键证据不同位置、旧版冲突和数字样本验证理解效果。",
    ],
    explanation:
      "跨段比较、数字和例外条件需要单独评测。检索、重排或结构化摘录提高证据密度，但摘要也可能丢失限制条件。不能用“全部放得进去”代替正确理解的验证。",
    example:
      "把同一关键条款分别放在文档开头、中间和结尾，并加入旧版相反结论；比较整篇输入与精选证据的正确率、引用及成本。答错后先检查证据是否进入、被截断还是被误读。",
    pitfalls: [
      "文档放得下就认为模型一定理解，忽略证据位置和旧版冲突。",
      "摘要省了 token，但删除例外条款后仍当作完整证据。",
    ],
    followUps: ["怎样区分截断与证据误读？", "什么时候直接长文处理更合适？"],
    projectPrompt:
      "选一份实际处理过的长文，说明证据如何进入上下文，以及答错时如何定位截断或误读。",
  },
  temperature: {
    oral: "不一定。低温通常减少采样随机性，却可能稳定地产生同一个错误。正确性依赖能力、证据与验证，不能由参数保证。",
    keyPoints: [
      "低温减少采样随机性，不能保证事实或推理正确。",
      "稳定性与正确性需要分开评测。",
      "证据核对、结构及业务校验仍然必要。",
      "模型版本、供应商实现和参数支持影响可重复性。",
    ],
    explanation:
      "temperature 调整概率分布集中程度，影响多样性。它不替代字段校验和事实核对；即使为零，模型版本、供应商实现与计算条件也可能影响可重复性。参数支持以具体接口为准。",
    example:
      "固定提示和模型，对缺证据、数字和否定条件样本分别运行不同温度，统计正确率及变化。使用预先核实的真值，不能凭输出更肯定或某一次更流畅判断提高。",
    pitfalls: ["把 temperature=0 当作正确性或完全确定性的保证。"],
    followUps: [
      "稳定性和正确性分别怎样测？",
      "模型表达确定为什么仍需核对引用？",
    ],
    projectPrompt:
      "回顾你调过的生成参数，说明固定了哪些变量、如何判断输出更稳定以及是否真的更正确。",
  },
  "structured-output": {
    oral: "使用模型支持的结构化约束与简洁 schema，生成后解析并检查字段和业务语义。失败反馈具体错误，有限修正，连续失败应结束。",
    keyPoints: [
      "优先使用接口支持的结构化输出约束与简洁 schema。",
      "生成后解析并验证必填字段、类型和范围。",
      "结构合法后仍需检查权限、实体及跨字段业务语义。",
      "修正需反馈具体错误并设置次数上限，截断结果不能直接执行。",
    ],
    explanation:
      "提示要求 JSON 不保证可解析，JSON 模式也未必保证字段完整。复杂 schema 可拆阶段。结构合法仍需核对实体、权限、金额和跨字段规则，不能直接驱动写工具。",
    example:
      "```python\nfrom pydantic import BaseModel, Field\n\nclass Result(BaseModel):\n    amount: float = Field(ge=0)\n\nResult.model_validate_json('{\"amount\": 12}')\n```\n再测缺字段、负数与截断；货币使用精确类型并检查订单归属。",
    pitfalls: [
      "JSON 可解析就认为字段完整、业务合法并直接执行写操作。",
      "不断让模型修正却没有重试预算，错误时无法收敛。",
    ],
    followUps: ["格式校验与业务校验各负责什么？", "部分流式 JSON 应怎样处理？"],
    projectPrompt:
      "结合实际的抽取或工具参数流程，说明格式错误、业务错误与输出截断各如何处理。",
  },
  "model-selection": {
    oral: "榜单任务与业务分布可能不同，也不一定覆盖工具协议、格式、延迟和成本。应在真实任务样本上建立基线，再按约束选型。",
    keyPoints: [
      "公开榜单与业务任务、输入分布和约束可能不同。",
      "用真实样本建立固定提示、证据和参数的比较基线。",
      "同时比较严重错误、格式、工具协议、p95 与每任务成本。",
      "调参样本与最终评测分开，记录模型版本与结果。",
    ],
    explanation:
      "字段抽取、问答和代码修改有不同能力要求。比较时固定提示、证据及参数，记录严重错误、拒答、p95 和每任务成本。不能只拿一个顺利样本或模型自评作结论。",
    example:
      "准备正常、长文、缺证据和格式约束样本，对候选模型配对比较并记录版本、输入、输出与 token。调参样本和最终评测分开；便宜模型合格后再评估多模型路由收益。",
    pitfalls: ["凭一个顺利样本或榜单名次确定业务模型。"],
    followUps: [
      "如何避免评测样本泄漏到调参过程？",
      "费用降低但严重错误增加时怎样判断？",
    ],
    projectPrompt:
      "说明你实际比较过的模型或方案、样本来源与选择依据；若未比较过，先设计一组可复现的比较样本。",
  },
  "mutable-default": {
    oral: "默认参数在函数定义时求值，后续调用复用。修改默认列表会共享内容；用 None 表示未提供参数，在函数内新建列表。",
    keyPoints: [
      "默认参数在函数定义时求值，调用间复用同一个对象。",
      "修改默认列表或字典会把状态泄漏到后续调用。",
      "用 None 表示缺省，并在函数内新建对象。",
      "用 is None 保留显式传入空列表的含义，说明是否修改调用者对象。",
    ],
    explanation:
      "默认字典也有相同问题。显式传入列表时是否修改调用者对象，应由函数契约说明。不能用真假判断代替 is None，因为空列表也可能是调用者有意传入的合法值。",
    example:
      "```python\ndef collect(value, items=None):\n    if items is None:\n        items = []\n    items.append(value)\n    return items\n\nassert collect(1) == [1]\nassert collect(2) == [2]\n```\n再验证显式空列表的对象身份。",
    pitfalls: [
      "用 items or [] 替代 is None，会丢掉调用者显式传入的空列表身份。",
    ],
    followUps: [
      "items = items or [] 有什么问题？",
      "什么时候允许有意保存默认共享状态？",
    ],
    projectPrompt:
      "找一个你写过的收集或批处理函数，说明参数对象的所有权，并展示连续调用与显式空列表的验证。",
  },
  "coroutine-task": {
    oral: "调用异步函数创建协程对象，必须 await 或安排为 Task 才执行。创建协程不会自动发请求，也不会自动让多个调用并发。",
    keyPoints: [
      "调用 async def 创建协程对象，函数体尚未运行。",
      "await 或安排为 Task 后才执行。",
      "连续 await 两个独立操作仍可能串行；并发可用 TaskGroup。",
      "要管理异常、取消和生命周期，不能遗忘或重复等待同一协程。",
    ],
    explanation:
      "直接 await 先等待当前操作完成。独立工作并发执行可用 TaskGroup 或 Task，但要定义异常和取消策略。协程通常不能重复等待，创建后忘记等待会导致工作未执行及警告。",
    example:
      "```python\nimport asyncio\n\nasync def value():\n    return 7\n\nasync def main():\n    coroutine = value()\n    assert await coroutine == 7\n\nasyncio.run(main())\n```\n区分对象创建与函数体执行。",
    pitfalls: ["创建协程对象就认为请求已经发出或自动并发。"],
    followUps: [
      "await 两次为什么仍可能是串行？",
      "TaskGroup 中一个任务失败会怎样？",
    ],
    projectPrompt:
      "用你写过的异步调用解释协程何时开始、如何安排并发，以及其中一个任务失败时怎样收尾。",
  },
  "blocking-sleep": {
    oral: "time.sleep 阻塞当前线程；在事件循环线程调用会阻止其他协程推进。异步等待用 await asyncio.sleep，阻塞 I/O 可使用异步库或线程卸载。",
    keyPoints: [
      "time.sleep 在事件循环线程会阻塞其他协程。",
      "异步等待使用 await asyncio.sleep。",
      "阻塞 I/O 用异步库或合适的线程卸载。",
      "纯 Python CPU 任务需另选进程等方案，并通过并发测试定位瓶颈。",
    ],
    explanation:
      "async def 不会自动改造内部同步函数。同步驱动、文件操作和 CPU 计算需要分别处理；线程适合部分阻塞 I/O，纯 Python CPU 工作通常需要进程等方案。先定位瓶颈再选择。",
    example:
      "```python\nimport asyncio\n\nasync def wait():\n    await asyncio.sleep(0.1)\n\nasync def main():\n    await asyncio.gather(wait(), wait())\n\nasyncio.run(main())\n```\n并发等待约 0.1 秒，与同步阻塞版本对照。",
    pitfalls: [
      "把阻塞函数包进 async def 就认为不再阻塞。",
      "把线程卸载当作所有 CPU 密集任务的并行加速方法。",
    ],
    followUps: [
      "asyncio.to_thread 适合什么工作？",
      "为什么阻塞函数外包 async def 仍无效？",
    ],
    projectPrompt:
      "回顾一个异步服务的慢请求，说明如何识别阻塞点，并用并发耗时或 p95 证明修改有效。",
  },
  gil: {
    oral: "常规有 GIL 的 CPython 同一时刻只允许一个线程执行 Python 字节码。纯 Python CPU 任务通常用进程或释放 GIL 的扩展；I/O 等待仍可并发。",
    keyPoints: [
      "常规有 GIL 的 CPython 同时只有一个线程执行 Python 字节码。",
      "纯 Python CPU 工作通常用进程或释放 GIL 的扩展。",
      "I/O 等待仍可通过线程或协程并发。",
      "评估序列化、启动与内存成本，并区分原生库和 free-threaded 构建。",
    ],
    explanation:
      "并发与并行不同。评估进程启动、序列化和内存成本；不同 Python 实现、原生库和可选 free-threaded 构建需单独判断，不能把常规 CPython 结论套到全部环境。",
    example:
      "固定输入测试单线程、线程池与进程池执行纯 Python 计算，再测试网络等待。记录耗时和内存；原生库可能释放 GIL，还要检查其内部线程数，避免多进程各开大量线程。",
    pitfalls: [
      "把 GIL 的常规 CPython 结论套用到所有实现、原生库或 free-threaded 构建。",
    ],
    followUps: [
      "为什么线程池仍适合 I/O 服务？",
      "怎样识别计算发生在 Python 还是原生库？",
    ],
    projectPrompt:
      "选一次你做过的计算或 I/O 工作，说明瓶颈属于哪类、为何选择线程或进程，以及实际测量结果。",
  },
  "fastapi-blocking": {
    oral: "直接调用阻塞事件循环，影响同一进程其他请求。使用异步驱动，或按框架约定采用同步路由或线程卸载，并管理连接与超时。",
    keyPoints: [
      "async 路由直接调用同步驱动会阻塞事件循环。",
      "选择异步驱动、普通 def 路由或线程卸载。",
      "普通 def 的框架卸载不覆盖 async def 内的直接同步调用。",
      "一起考虑线程池、连接池、超时、取消及事务占用。",
    ],
    explanation:
      "FastAPI 通常把普通 def 路由和依赖放入线程池，但 async def 内直接调用的同步函数不会自动卸载。线程池与数据库连接池应一起考虑；长模型调用不要占用事务。",
    example:
      "```python\nimport asyncio\n\nasync def read():\n    return await asyncio.to_thread(blocking_read)\n```\n示例适用于合适的阻塞 I/O；实际先核对驱动在线程间的连接契约，再测试并发 p95、超时与取消。",
    pitfalls: ["认为 FastAPI 自动把 async 路由里的所有同步函数放到线程池。"],
    followUps: [
      "什么时候直接用 def 路由？",
      "线程池大而连接池小时会发生什么？",
    ],
    projectPrompt:
      "结合实际接口和数据库驱动，说明调用在哪个线程执行、连接如何管理，以及怎样验证并发请求不被阻塞。",
  },
  "idempotent-create": {
    oral: "使用稳定幂等键，服务端绑定请求参数和结果，通过唯一约束及事务保证同一动作只执行一次。相同键不同参数应拒绝，超时可查询原结果。",
    keyPoints: [
      "同一业务动作使用稳定幂等键，并绑定请求参数。",
      "通过唯一约束与事务原子占用键，避免先查后写的竞争。",
      "保存处理中状态与结果，相同键不同参数返回冲突。",
      "超时先查询原结果，外部支付需远端幂等协议。",
    ],
    explanation:
      "先查再插入不能独立防并发竞争，要原子占用键或处理唯一冲突。记录处理中与已完成状态。外部支付还需远端幂等协议，本地事务不能自动回滚外部动作。",
    example:
      "两个并发相同 key 和数据得到同一订单 ID；模拟提交成功后响应丢失，重试不新增订单；同 key 换金额应失败。保存参数哈希、结果与有效期，并规定处理中请求的返回语义。",
    pitfalls: [
      "先查不存在再插入就认为能防住并发重复创建。",
      "使用 PUT 或本地事务就认为外部副作用也自动幂等。",
    ],
    followUps: [
      "幂等键对应的请求仍在处理中怎么办？",
      "为什么使用 PUT 不自动保证业务幂等？",
    ],
    projectPrompt:
      "选一个你做过的创建或提交接口，解释幂等键来源，并说明如何测试并发、响应丢失与同键参数冲突。",
  },
  jwt: {
    oral: "签名验证内容未篡改且来自相应签发方。常见签名 JWT 的载荷不是加密；它不自动保证未过期、未撤销或拥有资源权限。",
    keyPoints: [
      "签名证明内容未篡改且来自对应签发方，普通载荷不加密。",
      "固定允许算法，并验证签名、exp、发行方和受众。",
      "设计密钥轮换与撤销，避免记录完整令牌。",
      "认证通过后仍需逐资源授权，不能直接相信未验证字段。",
    ],
    explanation:
      "固定允许算法，检查签名、exp、发行方及受众，设计密钥轮换和撤销。认证后的用户仍不能读别人的订单；不能相信未验证角色字段，也不应在普通载荷存敏感信息。",
    example:
      "修改有效令牌的 user_id 应导致验证失败，过期令牌应拒绝；合法用户访问他人订单也应失败。日志不要包含完整令牌，分别验证认证与业务授权，而不是只测登录成功。",
    pitfalls: [
      "JWT 签名有效就认为未过期、未撤销且可以访问任意资源。",
      "把敏感信息放进普通 JWT 载荷，以为签名会隐藏内容。",
    ],
    followUps: ["认证和授权各在哪一层完成？", "访问令牌与刷新令牌怎样分工？"],
    projectPrompt:
      "结合你实现过的认证流程，说明令牌验证和资源授权各在何处完成，以及过期、篡改和越权如何测试。",
  },
  "transfer-transaction": {
    oral: "扣款和入账放在同一事务中，任一步失败一起回滚。并发需行锁或条件更新以防透支；重复提交还要业务幂等。",
    keyPoints: [
      "扣款与入账在同一事务中执行，任一步失败一起回滚。",
      "并发使用行锁或条件更新，并保持一致锁定顺序。",
      "校验金额、余额、目标账户与受影响行数，使用精确金额类型。",
      "重复提交需要业务幂等，外部动作不受本地回滚保护。",
    ],
    explanation:
      "原子性不自动解决全部并发规则。校验金额、账户和余额，按一致顺序锁行，金额使用精确类型。UPDATE 零行不一定抛错，应用必须验证受影响行数；外部支付不受本地回滚保护。",
    example:
      "```sql\nBEGIN;\nUPDATE accounts SET balance = balance - 10\nWHERE id = 1 AND balance >= 10;\n-- 检查恰好更新一行，否则回滚\nUPDATE accounts SET balance = balance + 10 WHERE id = 2;\n-- 检查目标存在，最后提交\n```\n入账前注入失败，验证两边余额均未变。",
    pitfalls: [
      "认为事务原子性自动防止并发透支或重复转账。",
      "UPDATE 没抛异常就认为账户存在且更新成功。",
    ],
    followUps: [
      "普通先查余额为何防不了并发超支？",
      "目标账户不存在但 UPDATE 没报错怎么办？",
    ],
    projectPrompt:
      "用你实际做过的多步数据库写入说明事务边界，并设计中途失败、并发与零行更新的验证。",
  },
  "left-join": {
    oral: "无匹配时右表字段为 NULL，WHERE 普通等值条件会过滤这些行，结果可能像内连接。保留所有左行时，将适当右表条件放在 ON。",
    keyPoints: [
      "LEFT JOIN 无匹配时右表字段为 NULL。",
      "WHERE 的普通右表等值条件会过滤无匹配左行。",
      "ON 决定匹配哪些右行，WHERE 过滤连接后的结果。",
      "按业务意图保留未标记题，并检查一对多重复行与 IS NULL 的含义。",
    ],
    explanation:
      "ON 定义参与匹配的右表行，WHERE 过滤连接后的结果；写法取决于业务意图。题库按用户连接进度时，用户条件放 ON 能保留未标记题，不能机械移动全部条件。",
    example:
      "```sql\nSELECT q.id, p.status FROM questions q\nLEFT JOIN user_question_progress p\nON p.question_id = q.id AND p.user_id = 'default';\n```\n追加 WHERE p.status='mastered' 后只剩掌握题；查未标记则用 p.question_id IS NULL。",
    pitfalls: ["把所有右表条件机械移到 ON，忽略筛选已掌握题等业务意图。"],
    followUps: [
      "IS NULL 为什么与等值条件不同？",
      "一对多连接后计数为何可能变大？",
    ],
    projectPrompt:
      "找一条你实际写过的左连接，说明无匹配行是否应保留，并用未标记、多条右表记录验证行数。",
  },
  explain: {
    oral: "EXPLAIN 给出估计计划；EXPLAIN ANALYZE 实际执行并显示耗时、行数等信息。分析写语句要考虑副作用，必要时在事务中回滚。",
    keyPoints: [
      "EXPLAIN 显示估计计划，EXPLAIN ANALYZE 实际执行查询。",
      "分析扫描、连接、排序、loops 与估计和实际行数差异。",
      "cost 不是毫秒，结合 BUFFERS、统计与数据分布判断。",
      "写语句会产生副作用，回滚不能撤销全部外部动作。",
    ],
    explanation:
      "估计与实际行数差异可提示统计或选择性问题。观察扫描、连接、排序和 loops；cost 不是毫秒。结合 BUFFERS 与真实数据分布，避免把一次缓存命中当作长期性能。",
    example:
      "```sql\nEXPLAIN (ANALYZE, BUFFERS)\nSELECT id FROM questions WHERE category = 'Python';\n```\n比较小表和大表计划，解释已有索引仍可能顺序扫描。写语句可 BEGIN 后 ROLLBACK，但外部副作用未必可撤销。",
    pitfalls: [
      "把 cost 当作实际耗时，或一次缓存命中当作长期性能。",
      "直接对写语句运行 ANALYZE，却认为只是看计划。",
    ],
    followUps: [
      "估计与实际行数相差很大时查什么？",
      "为什么已有索引不一定被使用？",
    ],
    projectPrompt:
      "选一条你优化过或测过的查询，说明数据规模、计划依据，以及为什么索引或缓存改变了结果。",
  },
  "rag-boundary": {
    oral: "RAG 用检索资料补充可更新、私有或需要引用的知识。它不自动保证召回正确、资料有效、生成忠实或权限安全。",
    keyPoints: [
      "检索补充可更新、私有或需要引用的知识。",
      "解析、切块、索引、重排与生成分别可能失败。",
      "RAG 不保证召回、版本、生成忠实或权限正确。",
      "分别验证候选、最终上下文和答案，缺证据时明确拒答。",
    ],
    explanation:
      "解析、切块、索引、重排与生成任何环节都可能失败。检索不能创造不存在的事实；旧资料和冲突资料需要版本规则。模型拿到正确证据也可能误读数字、否定条件及例外。",
    example:
      "退款期限从七天变成十四天，更新文档和索引后应引用新版。再测旧版残留、无答案和跨租户请求，分别检查候选、最终上下文和答案。链接存在与引用支持结论是两种检查。",
    pitfalls: ["加了 RAG 就认为没有幻觉，或链接存在就代表引用支持结论。"],
    followUps: [
      "怎样区分召回错误和生成错误？",
      "为什么权限必须在证据进入模型前处理？",
    ],
    projectPrompt:
      "结合你做过的检索问答，说明一次知识更新怎样生效、证据如何核对，以及缺证据或权限请求如何处理。",
  },
  chunking: {
    oral: "大块易混入无关主题并浪费上下文，小块易丢失前提、定义和指代。应按文档结构切分，并用真实样本评测大小。",
    keyPoints: [
      "大块增加噪声与预算，小块可能丢掉前提和指代。",
      "按标题、条款、表格或代码结构选择边界。",
      "Overlap 与父子块补语境，也带来重复和开销。",
      "保留来源及版本，用跨段条件样本评测召回、正确率与成本。",
    ],
    explanation:
      "标题、条款、表格和代码需要不同边界。Overlap 和父子块可补上下文，但也产生重复与开销。每块保留版本、来源位置，召回后去重，确保关键条件没有截断。",
    example:
      "比较 200、500、1000 token 及标题切块，统计证据召回、答案正确率和成本。加入跨段条件：只召回“可以退款”却丢了“不含特价商品”，不能因相似度高就判合格。",
    pitfalls: [
      "相似度高就认为切块正确，却漏掉退款例外等限制条件。",
      "增加 overlap 就认为所有上下文缺失都被修复。",
    ],
    followUps: [
      "为什么 overlap 不能修复所有切块问题？",
      "父子块如何兼顾精确定位和完整语境？",
    ],
    projectPrompt:
      "选你实际处理的一种文档，说明切块边界与参数依据，并展示关键条件跨段时怎样验证。",
  },
  "embedding-migration": {
    oral: "通常不能。不同模型空间和维度可能不同，即使维度相同也不能假定距离可比较。查询与文档向量应使用匹配模型及配置。",
    keyPoints: [
      "不同 embedding 的空间和维度通常不兼容。",
      "查询与文档必须使用匹配模型及预处理。",
      "在独立索引重建，记录模型、维度、内容与索引版本。",
      "用固定样本和灰度验证后切换，保留回滚与缓存版本策略。",
    ],
    explanation:
      "记录模型、维度、预处理和内容版本，在独立索引重建向量。固定样本与灰度查询验证后切换，保留旧索引以回滚。缓存键包含索引与模型版本，原文没变也通常需要重新编码。",
    example:
      "```text\nindex_v1：模型 A 文档向量\nindex_v2：模型 B 文档向量\n模型 B 查询向量 → index_v2\n```\n比较召回、延迟和权限过滤，不能仅把旧 collection 的维度改成新值。",
    pitfalls: ["维度相同就混用新旧向量，或只修改 collection 维度而不重建。"],
    followUps: ["同维度为什么不代表同一空间？", "迁移期间新文档如何保持同步？"],
    projectPrompt:
      "说明你实际使用的向量模型和索引；若要替换，怎样保持新文档同步、验证召回并回滚。",
  },
  "hybrid-retrieval": {
    oral: "查询既包含语义改写，也有编号和专有名词。向量与关键词检索互补，融合可提高覆盖，但需要去重、过滤和实际评测。",
    keyPoints: [
      "关键词擅长编号和专名，向量擅长语义改写。",
      "两路分数尺度不同，可用 RRF 按排名融合再重排。",
      "融合结果需要去重及权限、版本过滤。",
      "按编号、自然语言与混合查询分层比较召回、正确率和 p95。",
    ],
    explanation:
      "两路原始分数尺度不同，不能随意相加，可采用 RRF 等按排名融合后重排。按编号、自然语言和混合查询分层比较，否则整体平均值可能掩盖精确查询退化。",
    example:
      "查询“INC-2048 数据库超时”，关键词找编号，向量找语义相关方案。融合后检查工单编号准确、去掉重复块；对比单路与融合的 recall@k、最终正确率和 p95。",
    pitfalls: ["把两路原始分数直接相加，或只看整体平均值掩盖编号查询退化。"],
    followUps: ["为什么提高召回数可能增加噪声？", "何时关键词检索已经足够？"],
    projectPrompt:
      "用你项目中的真实查询说明单路检索的不足，并设计编号与语义两类样本验证混合收益。",
  },
  "rag-evaluation": {
    oral: "检索检查关键证据是否进入候选与最终上下文；生成检查答案是否正确、忠于证据且引用有效。拆开才能定位应优化索引还是生成。",
    keyPoints: [
      "检索评估关键证据是否进入候选和最终上下文。",
      "生成评估答案正确、忠于证据与引用有效。",
      "分开记录召回、重排、截断及生成结果以定位故障。",
      "覆盖无答案、版本和权限边界，并核实真值、延迟与成本。",
    ],
    explanation:
      "证据没召回时，改生成提示无法补救；证据被截断也不是模型知识问题。还要评估版本一致性、权限、正确拒答、延迟与成本，重要真值需要人工核实。",
    example:
      "给每题标注有效证据 ID，记录召回、重排、上下文和答案。故意移除关键条款，期待无法回答；恢复证据后仍错误，再查数字、否定词及引用。不要只看检索相似度。",
    pitfalls: ["只看检索相似度或最终回答，就无法定位证据丢失在哪一环。"],
    followUps: [
      "召回高但答案正确率低应先查哪里？",
      "无答案样本和更新文档样本怎样维护？",
    ],
    projectPrompt:
      "回顾一个答错的真实样本，说明你怎样判断是检索、上下文还是生成问题，并提出可复现的回归用例。",
  },
  "ai-requirements": {
    oral: "明确用户、具体任务、输入、期望结果及成功标准，再确认权限、错误代价、延迟和预算，最后选择技术方案。",
    keyPoints: [
      "先明确用户、具体任务、输入与期望输出。",
      "定义可验证成功标准和允许失败的情况。",
      "确认权限、错误代价、延迟与预算约束。",
      "收集真实样本并建立简单基线后选择技术方案。",
    ],
    explanation:
      "宽泛角色无法指导实现和验收。把需求缩成真实业务闭环，定义允许失败的情况，先跑简单基线。没有证据表明收益前，复杂记忆或多 Agent 只会增加评估和维护工作。",
    example:
      "限定为“根据已授权退款制度回答并引用条款”，收集真实问题，再补无答案、版本冲突与权限边界。先写正确引用、拒答、p95 和成本验收方法，再实现首版。",
    pitfalls: [
      "从“AI 助手”直接跳到多 Agent 或记忆设计，却没有具体任务和验收样本。",
    ],
    followUps: [
      "任务需要行动还是只需要回答？",
      "业务方没有标准答案时怎样建立验收？",
    ],
    projectPrompt:
      "用你参与过的一项需求说明如何把宽泛目标缩成首个闭环，以及输入、输出与验收怎样约定。",
  },
  "agent-choice": {
    oral: "任务需要根据中间观察动态选择工具或路径，且结果可验证、边界可控时考虑 Agent。已知步骤先用固定流程建立基线。",
    keyPoints: [
      "中间观察决定下一步工具或路径时考虑 Agent。",
      "结果需可验证，权限、预算和停止条件需可控。",
      "已知步骤先用固定流程建立基线。",
      "比较动态方案的收益、耗时、成本和严重失败。",
    ],
    explanation:
      "动态能力带来状态、恢复、预算和评测工作，调用两次模型不说明必须自主决策。先证明固定流程在真实样本上的限制，再比较动态方案的收益和不确定行为。",
    example:
      "字段抽取用固定生成及校验；故障调查可动态查指标、日志和配置。为调查设置只读工具、步数上限和缺证据出口，比较成功率、耗时、token 与严重失败，保留确定性验收。",
    pitfalls: ["调用多次模型就认为必须做 Agent，没有证明固定流程的限制。"],
    followUps: ["最小 Agent 基线怎样设计？", "哪些步骤仍应交给程序确定执行？"],
    projectPrompt:
      "结合你真实做过的流程说明哪些步骤固定、哪些需要动态判断，并给出选择依据或可验证的比较设计。",
  },
  "qa-metrics": {
    oral: "定义事实正确、证据支持和正确拒答，再记录延迟和成本。满意度或生成字数不足以证明问答准确。",
    keyPoints: [
      "分别定义事实正确、证据支持及正确拒答。",
      "区分可回答与资料不足样本，核实有效证据。",
      "数字、否定条件、版本与错误严重度需明确检查。",
      "同时记录 p95 和每任务成本，重要真值由人工核实。",
    ],
    explanation:
      "核实问题与有效证据，区分可回答和资料不足样本。数字、否定条件及版本设关键检查，记录严重度。模型评分可以辅助，但重要真值及评分边界需人工确认。",
    example:
      "退款问答分别评分事实、引用和版本，无答案题期待说明不足。发布时在固定样本配对比较，并记录 p95 与每任务成本；不能只降低拒答率却增加编造。",
    pitfalls: ["把满意度、字数或更低拒答率当作准确性提升。"],
    followUps: [
      "正确引用与答案为什么要分开统计？",
      "怎样让评测覆盖真实输入分布？",
    ],
    projectPrompt:
      "从你做过的问答或抽取任务说明成功怎样判定、真值从哪里来，以及一次错误如何计分。",
  },
  "demo-production": {
    oral: "Demo 常只展示顺利路径。上线要验证真实输入、权限、异常、容量、成本、监测和恢复，尤其是具有副作用的动作。",
    keyPoints: [
      "Demo 顺利路径不能代表真实输入与异常表现。",
      "验证权限、容量、成本、监测和可恢复状态。",
      "记录可复现配置与版本，建立固定回归样本。",
      "覆盖超时、限流、断流和写入响应丢失，设置重试预算。",
    ],
    explanation:
      "生成效果只是交付的一部分。可复现配置、版本记录与固定评测帮助区分模型、资料和程序故障。失败不能无限重试，部分响应不能当完整成功；应明确哪些能力已经实际验证。",
    example:
      "加入缺字段、无答案、429、超时、断流和跨租户请求，测试并发 p95。工单写入再模拟远端成功但响应丢失，确认只创建一次，并核对故障后的可恢复状态。",
    pitfalls: ["只展示成功样本就声称已经上线可用，或把部分响应当完整成功。"],
    followUps: ["已实现和已验证如何区分？", "哪些线上指标能尽早发现退化？"],
    projectPrompt:
      "列出你实际验证过的异常和并发场景，说明仍有哪些未验证，并解释一个响应丢失后的恢复流程。",
  },
  "prompt-versioning": {
    oral: "prompt 影响生产行为，应版本化、可审查和可回滚，并绑定模型、参数与评测结果。个人笔记无法还原线上实际组合。",
    keyPoints: [
      "prompt、示例与工具 schema 影响生产行为，需版本化和审查。",
      "发布绑定模型、参数、工具和评测结果。",
      "运行记录保存实际版本及必要证据，避免敏感上下文泄漏。",
      "用固定样本比较，并可回滚完整配置组合。",
    ],
    explanation:
      "行为还受示例和工具 schema 影响。运行记录保存实际版本 ID，发布使用固定样本比较，避免同时改多个变量后误判收益；敏感完整上下文不必全部写入日志。",
    example:
      "退款提示存为版本文件，发布绑定 prompt-v3、模型与工具版本。故障请求记录组合及证据 ID；回滚恢复完整配置，并在正常、缺证据和例外条款样本验证。",
    pitfalls: [
      "只回滚 prompt 文本，却没有恢复模型、参数或工具版本。",
      "同时改多个变量后把小幅提升归因于某一条提示。",
    ],
    followUps: [
      "怎样确认 2% 提升不是随机波动？",
      "工具定义为什么应与提示一起版本化？",
    ],
    projectPrompt:
      "说明你实际维护过的提示或配置如何发布、记录和回滚，并设计一次改动前后的固定样本比较。",
  },
  "agent-definition": {
    oral: "模型根据目标和环境反馈动态选择工具或下一步，宿主执行、校验并保存状态时，应用具有 Agent 特征。界面是否为聊天框不决定它是否为 Agent。",
    keyPoints: [
      "Agent 根据目标与环境反馈动态选择工具或下一步。",
      "宿主执行、校验并保存状态，聊天界面不是判定依据。",
      "固定检索加生成适合步骤明确的任务。",
      "动态行动受权限、前置条件、预算和成功标准限制。",
    ],
    explanation:
      "固定检索加生成已能完成许多任务。动态能力适合路径无法全部预先规定的情况，但增加了预算、恢复和评估工作。模型计划是候选方案，实际行动受权限、前置条件和可验证成功标准限制。",
    example:
      "查询订单时，模型选择查询和核对工具，宿主验证订单归属，再生成申请草稿。验收检查草稿字段和工具轨迹；先测固定流程，再比较动态流程的成功率、耗时与成本。",
    pitfalls: ["把聊天界面或模型写出计划当作 Agent 已经执行行动。"],
    followUps: [
      "什么任务适合固定工作流？",
      "你项目里哪些决定由模型做，哪些由程序做？",
    ],
    projectPrompt:
      "画出你做过的一个流程，标明模型决策、程序执行和结果校验，说明为何采用固定或动态路径。",
  },
  "react-loop": {
    oral: "模型根据目标与观察决定下一步，Act 提出工具调用，Observe 是宿主执行后返回的真实结果。循环依靠新观察推进，由宿主控制预算和停止条件。",
    keyPoints: [
      "Reason 根据目标和已有观察选择下一步。",
      "Act 提出工具调用，宿主负责实际执行。",
      "Observe 来自真实结果，区分成功、无结果、错误和部分成功。",
      "宿主管理预算、停止条件和写操作执行 ID，防止空转。",
    ],
    explanation:
      "记录结构化行动及理由摘要即可，不必依赖展示完整思维过程。模型声称已调用工具不是有效观察。工具结果要区分成功、无结果、错误和部分成功，写操作还要保存副作用及执行 ID。",
    example:
      "```text\n目标：查最新退款条款\n行动：搜索当前版本文档\n观察：找到 v3 第 2 条\n行动：返回带引用的答案\n验收：版本、条款和结论一致\n```\n未找到条款时改查一次或报告缺证据。",
    pitfalls: ["把模型声称调用成功当作观察，或依赖完整思维过程作为执行证据。"],
    followUps: [
      "如何识别没有新观察的空转？",
      "怎样截断工具结果而保留关键证据？",
    ],
    projectPrompt:
      "用一次实际的工具流程解释行动与观察，说明无结果或重复观察时如何停止、恢复或改查。",
  },
  "tool-validation": {
    oral: "参数是候选输入。宿主先检查类型、范围，再检查资源归属、权限、前置条件和幂等规则，通过后才执行。Schema 合法不等于获得授权。",
    keyPoints: [
      "模型参数只作为候选输入，先验证类型与范围。",
      "宿主再检查资源归属、权限、前置条件及幂等。",
      "用户身份来自认证上下文，不能相信模型传入的 user_id。",
      "对路径、金额和收件人实施业务约束，拒绝不得绕过。",
    ],
    explanation:
      "order_id=42 可以是合法整数，却属于别人。用户身份来自认证上下文，不能相信模型传入的 user_id。对文件路径、金额和收件人还要执行业务约束，拒绝后不能让模型改写理由来绕过。",
    example:
      '```python\ndef read_order(user_id, order_id):\n    order = load_order(order_id)\n    if order.owner_id != user_id:\n        raise PermissionError("not allowed")\n    return order\n```\n测试正常访问、他人订单和非法 ID，确认拒绝时不泄露正文。',
    pitfalls: [
      "Schema 合法不等于资源访问已授权。",
      "让模型提供 user_id 或改写理由来绕过宿主的权限拒绝。",
    ],
    followUps: [
      "长任务恢复时是否要再次检查权限？",
      "格式错误、越权与可重试错误怎样区分？",
    ],
    projectPrompt:
      "结合你实现过的工具或 API，说明格式与授权各如何检查，并给出合法、越权与非法参数的验证。",
  },
  "agent-evaluation": {
    oral: "最终文本无法证明动作完成，也无法发现越权、重复副作用或过高成本。应检查环境终态、工具轨迹、关键字段及预算。",
    keyPoints: [
      "最终文本不能证明动作完成或没有重复副作用。",
      "检查环境终态、工具轨迹和关键字段。",
      "预先定义允许动作、预算与可重置环境。",
      "分别评估缺证据、拒绝与无法完成，比较成功率、p95 和成本。",
    ],
    explanation:
      "模型说“工单已创建”，但实际没有创建或创建两次，都不合格。环境要可重置，预期结果和允许动作事先定义；正确报告缺证据、等待授权和无法完成也应分别评估。",
    example:
      "核对工单数为 1、字段正确、没有访问其他项目。注入一次响应丢失和一次 403，检查重复创建和越权重试。与固定流程基线比较成功率、p95、token 成本及严重失败。",
    pitfalls: ["答案正确就判 Agent 成功，忽略越权轨迹、重复创建或高成本。"],
    followUps: ["怎样建立可重置的评测环境？", "答案正确但轨迹越权如何判定？"],
    projectPrompt:
      "为你做过的一个行动任务说明可核对终态是什么，并设计响应丢失、权限拒绝与重复副作用的评测。",
  },
  "tool-timeout": {
    oral: "先区分只读与写操作。只读通常可有限重试；写操作超时意味着结果未知，应凭幂等键或远端操作 ID 查询结果后再决定。",
    keyPoints: [
      "先区分只读与写操作，只读通常可有限重试。",
      "写操作超时代表结果未知，可能已成功提交。",
      "用稳定幂等键或远端操作 ID 查询原结果再决定。",
      "同键绑定参数，统一重试预算并保存恢复信息。",
    ],
    explanation:
      "超时可能发生在远端成功提交之后。盲目重试会重复创建订单或发送邮件，多层重试还放大流量。幂等键绑定任务、步骤及参数，所有重试消耗统一总预算，超限后保存恢复信息。",
    example:
      "```text\ncreate_order(key=task-1:step-2) → 响应丢失\nget_operation(key=task-1:step-2) → order-42 已创建\n保存 order-42，继续下一步\n```\n验收模拟远端成功但响应丢失，断言只创建一次。",
    pitfalls: ["写操作超时就换一个幂等键直接重试，可能重复创建或发送。"],
    followUps: [
      "相同幂等键但参数变化怎么办？",
      "远端没有结果查询接口时怎样处理？",
    ],
    projectPrompt:
      "说明你实际遇到或处理过的一次超时如何确认结果；若未遇到，设计成功响应丢失时只执行一次的测试。",
  },
};

export const coreLearningEntries: readonly CoreLearningEntry[] = corePath.map(
  ({ key, question, category }) => ({
    question,
    category,
    ...content[key],
    sources: sources[category],
  }),
);
const byQuestion = new Map(
  coreLearningEntries.map((entry) => [entry.question, entry]),
);
export function getCoreLearningEntry(question: string, category: string) {
  const entry = byQuestion.get(question);
  return entry?.category === category ? entry : undefined;
}
export const coreAnswers = Object.fromEntries(
  coreLearningEntries.map((entry) => [entry.question, learningAnswer(entry)]),
);
