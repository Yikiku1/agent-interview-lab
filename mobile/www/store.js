// Offline state is a single transaction. No desktop data is bundled or contacted.
export const STATE_VERSION = 1;
export const MAX_BACKUP_BYTES = 8 * 1024 * 1024;
export const emptyState = () => ({
  version: 1,
  progress: {},
  events: [],
  drafts: {},
  session: null,
  cards: {},
  gaps: [],
  target: null,
  mockRounds: [],
  interviewReviews: [],
});
const clone = (value) => JSON.parse(JSON.stringify(value));
const fail = (message) => {
  throw new Error(message);
};
const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const statuses = ["unknown", "fuzzy", "mastered"];
const validDate = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;
const date = (value) => validDate(value) || fail("日期必须为有效 ISO UTC 时间");
const id = (value) =>
  typeof value === "string" && value.length > 0 && value.length <= 200;
const status = (value) => statuses.includes(value) || fail("无效掌握状态");
export function scheduleReview(
  value,
  previousStage = 0,
  completedAt = new Date().toISOString(),
) {
  status(value);
  date(completedAt);
  const reviewStage =
    value === "mastered" ? Math.min(4, Math.max(0, previousStage) + 1) : 0;
  const days =
    value === "unknown"
      ? 1
      : value === "fuzzy"
        ? 3
        : [1, 3, 7, 14][reviewStage - 1];
  return {
    reviewStage,
    nextReviewAt: new Date(
      Date.parse(completedAt) + days * 86400000,
    ).toISOString(),
  };
}
function safeTree(value, depth = 0) {
  if (depth > 20) fail("数据嵌套过深");
  if (typeof value === "string" && value.length > 100000) fail("单字段过长");
  if (typeof value === "number" && !Number.isFinite(value)) fail("无效数字");
  if (Array.isArray(value)) {
    if (value.length > 50000) fail("记录过多");
    value.forEach((v) => safeTree(v, depth + 1));
  } else if (object(value))
    for (const [k, v] of Object.entries(value)) {
      if (["__proto__", "constructor", "prototype"].includes(k))
        fail("非法字段");
      if (k.endsWith("At") && v !== null) date(v);
      if (
        k === "interviewDate" &&
        v !== null &&
        (typeof v !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
          new Date(v + "T00:00:00.000Z").toISOString().slice(0, 10) !== v)
      )
        fail("面试日期无效");
      safeTree(v, depth + 1);
    }
}
/** @param {unknown} input @param {(number | {id:number})[]} questions */
export function validateState(input, questions = []) {
  if (!object(input) || input.version !== 1) fail("不支持的数据版本");
  const expected = Object.keys(emptyState());
  if (
    Object.keys(input).some((k) => !expected.includes(k)) ||
    expected.some((k) => !(k in input))
  )
    fail("数据结构不完整或含未知字段");
  safeTree(input);
  const known = new Set(
    questions.map((q) => (typeof q === "number" ? q : q.id)),
  );
  const qid = (value) =>
    (Number.isSafeInteger(value) && value > 0 && known.has(value)) ||
    fail("引用了不存在的题目");
  const refs = (value) => {
    if (Array.isArray(value)) value.forEach(refs);
    else if (object(value))
      for (const [k, v] of Object.entries(value)) {
        if (k === "questionId" && v !== null) qid(v);
        else refs(v);
      }
  };
  refs(input);
  for (const key of ["progress", "drafts", "cards"]) {
    if (!object(input[key])) fail("无效映射");
    for (const [k, v] of Object.entries(input[key])) {
      qid(Number(k));
      if (String(Number(k)) !== k) fail("无效题目键");
      if (key === "drafts" && typeof v !== "string") fail("草稿必须为文本");
      if (key !== "drafts" && !object(v)) fail("无效记录");
    }
  }
  const unique = (list, key) => {
    const seen = new Set();
    for (const row of list) {
      if (!object(row) || !id(row[key]) || seen.has(row[key]))
        fail("记录ID无效或重复");
      seen.add(row[key]);
    }
  };
  for (const key of ["events", "gaps", "mockRounds", "interviewReviews"]) {
    if (!Array.isArray(input[key])) fail("无效记录列表");
    unique(input[key], key === "events" ? "attemptId" : "id");
  }
  const events = new Map();
  for (const e of input.events) {
    qid(e.questionId);
    status(e.status);
    date(e.completedAt);
    if (typeof e.answer !== "string") fail("无效作答");
    events.set(e.attemptId, e);
  }
  for (const [key, p] of Object.entries(input.progress)) {
    status(p.status);
    if (
      !Number.isInteger(p.reviewStage) ||
      p.reviewStage < 0 ||
      p.reviewStage > 4 ||
      !Number.isInteger(p.practiceCount) ||
      p.practiceCount < 0
    )
      fail("无效练习进度");
    if (p.nextReviewAt !== null) date(p.nextReviewAt);
    if (p.lastCompletedAt !== null) date(p.lastCompletedAt);
    const history = input.events.filter((e) => e.questionId === Number(key));
    if (
      p.practiceCount !== history.length ||
      (p.reviewCount !== undefined && p.reviewCount !== p.practiceCount)
    )
      fail("进度与正式完成记录不匹配");
    let scheduled = { reviewStage: 0, nextReviewAt: null };
    for (const e of history)
      scheduled = scheduleReview(
        e.status,
        scheduled.reviewStage,
        e.completedAt,
      );
    if (
      p.reviewStage !== scheduled.reviewStage ||
      p.nextReviewAt !== scheduled.nextReviewAt ||
      p.lastCompletedAt !== (history.at(-1)?.completedAt ?? null) ||
      (p.lastReviewedAt !== undefined && p.lastReviewedAt !== p.lastCompletedAt)
    )
      fail("复习安排与完成记录不匹配");
  }
  for (const e of input.events)
    if (!input.progress[e.questionId]) fail("正式完成缺少进度");
  if (input.session !== null) {
    const s = input.session;
    if (
      !object(s) ||
      !id(s.id) ||
      !Array.isArray(s.queue) ||
      !s.queue.length ||
      s.queue.length > 1000 ||
      new Set(s.queue).size !== s.queue.length ||
      !Number.isInteger(s.index) ||
      s.index < 0 ||
      s.index > s.queue.length ||
      !object(s.completed)
    )
      fail("无效固定队列");
    s.queue.forEach(qid);
    for (const [k, attempt] of Object.entries(s.completed))
      if (
        !s.queue.includes(Number(k)) ||
        !events.has(attempt) ||
        events.get(attempt).questionId !== Number(k)
      )
        fail("队列完成记录不匹配");
  }
  const projects = ["", "VendorGuard", "发票实习", "综合", "技术基础"];
  const textFields = (row, keys) => {
    if (!object(row) || keys.some((k) => typeof row[k] !== "string"))
      fail("文本字段缺失或类型错误");
  };
  for (const card of Object.values(input.cards))
    for (const k of [
      "shortAnswer",
      "example",
      "contributionBoundary",
      "evidence",
    ])
      if (card[k] !== undefined && typeof card[k] !== "string")
        fail("个人卡字段必须为文本");
  for (const gap of input.gaps) {
    qid(gap.questionId);
    textFields(gap, ["note"]);
    if (
      !["concept", "expression", "evidence", "follow_up", "other"].includes(
        gap.kind,
      )
    )
      fail("无效卡点类型");
    if (gap.resolvedAt !== null) date(gap.resolvedAt);
  }
  if (input.target !== null) {
    const t = input.target;
    if (
      !object(t) ||
      ![
        "all",
        "general_core",
        "resume_focus",
        "project_story",
        "foundation_fill",
      ].includes(t.preset) ||
      ![3, 5, 10, 20].includes(t.dailySize)
    )
      fail("无效训练目标");
    if (t.project != null && !projects.includes(t.project))
      fail("无效目标项目");
    if (t.priority != null && !["", "P0", "P1", "P2"].includes(t.priority))
      fail("无效目标优先级");
    if (t.reviewDrafts !== undefined) {
      if (!object(t.reviewDrafts)) fail("无效复盘草稿");
      for (const draft of Object.values(t.reviewDrafts)) {
        textFields(draft, [
          "company",
          "prompt",
          "answer",
          "gap",
          "improvement",
        ]);
        if (draft.questionId !== null) qid(draft.questionId);
      }
    }
  }
  for (const r of input.mockRounds) {
    qid(r.questionId);
    date(r.createdAt);
    if (
      !projects.slice(1).includes(r.project) ||
      !Array.isArray(r.nodes) ||
      r.nodes.length !== 5
    )
      fail("无效五节点模拟");
    if (r.endedAt !== null) date(r.endedAt);
    if (
      !Number.isInteger(r.index) ||
      r.index < 0 ||
      r.index > 5 ||
      (r.endedAt === null && r.index === 5)
    )
      fail("无效模拟位置");
    for (const node of r.nodes) {
      textFields(node, ["prompt", "answer", "gapNote"]);
      if (!["pending", "answered", "skipped"].includes(node.state))
        fail("无效模拟节点状态");
    }
  }
  for (const r of input.interviewReviews) {
    textFields(r, ["company"]);
    date(r.createdAt);
    date(r.updatedAt);
    if (!Array.isArray(r.questions) || r.questions.length !== 1)
      fail("当前离线复盘必须包含一问");
    unique(r.questions, "id");
    for (const item of r.questions) {
      textFields(item, ["prompt", "answer", "gap", "improvement"]);
      if (item.questionId !== null) {
        qid(item.questionId);
        date(item.linkedAt);
      } else if (item.linkedAt !== null) fail("未关联题目不能包含关联时间");
      if (
        !Array.isArray(item.baselineEventIds) ||
        new Set(item.baselineEventIds).size !== item.baselineEventIds.length ||
        item.baselineEventIds.some(
          (a) =>
            !id(a) ||
            !events.has(a) ||
            events.get(a).questionId !== item.questionId,
        )
      )
        fail("无效补练基线");
    }
  }
  return clone(input);
}
/** @param {string} text @param {(number | {id:number})[]} questions */
export function parseBackup(text, questions) {
  if (
    typeof text !== "string" ||
    new TextEncoder().encode(text).length > MAX_BACKUP_BYTES
  )
    fail("备份超过8MB或格式错误");
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    fail("备份不是有效JSON");
  }
  if (
    !object(data) ||
    Object.keys(data).some(
      (k) => !["format", "version", "exportedAt", "state"].includes(k),
    ) ||
    data.format !== "agent-interview-lab-offline" ||
    data.version !== 1
  )
    fail("不是受支持的离线备份");
  date(data.exportedAt);
  return validateState(data.state, questions);
}
export function createStorage() {
  if (globalThis.OfflineNative)
    return {
      read: () => {
        const value = globalThis.OfflineNative.readState();
        return value === "__INTERVIEW_LAB_EMPTY_STATE_V1__" ? null : value;
      },
      write: (text) => {
        if (globalThis.OfflineNative.writeState(text) !== true)
          fail("设备保存失败");
      },
    };
  return {
    read: () => globalThis.localStorage.getItem("interview-offline-v1"),
    write: (text) =>
      globalThis.localStorage.setItem("interview-offline-v1", text),
  };
}
/** @param {{storage?: {read: () => string | null, write: (text:string) => void | boolean}, questions?: (number | {id:number})[]}} options */
export function createStore({
  storage = createStorage(),
  questions = [],
} = {}) {
  const raw = storage.read();
  if (raw !== null && (typeof raw !== "string" || raw.length === 0))
    fail("设备读取失败：存储值不是有效文本");
  let state =
    raw === null ? emptyState() : validateState(JSON.parse(raw), questions);
  const commit = (next) => {
    const checked = validateState(next, questions);
    const text = JSON.stringify(checked);
    const backup = JSON.stringify({
      format: "agent-interview-lab-offline",
      version: 1,
      exportedAt: new Date().toISOString(),
      state: checked,
    });
    if (new TextEncoder().encode(backup).length > MAX_BACKUP_BYTES)
      fail("本地数据超过8MB");
    if (storage.write(text) === false) fail("设备保存失败");
    state = checked;
    return clone(state);
  };
  const update = (fn) => {
    const next = clone(state);
    fn(next);
    return commit(next);
  };
  const upsert = (key, row) =>
    update((s) => {
      const index = s[key].findIndex((r) => r.id === row.id);
      if (index < 0) s[key].push(clone(row));
      else s[key][index] = clone(row);
    });
  return {
    getState: () => clone(state),
    complete({
      questionId,
      attemptId,
      status: value,
      answer = "",
      completedAt = new Date().toISOString(),
    }) {
      const existing = state.events.find((e) => e.attemptId === attemptId);
      if (existing) {
        if (
          existing.questionId !== questionId ||
          existing.status !== value ||
          existing.answer !== answer
        )
          fail("同一提交ID的内容冲突");
        return clone(existing);
      }
      const event = {
        questionId,
        attemptId,
        status: value,
        answer,
        completedAt,
      };
      update((s) => {
        const p = s.progress[questionId];
        s.events.push(event);
        s.progress[questionId] = {
          status: value,
          ...scheduleReview(value, p?.reviewStage || 0, completedAt),
          practiceCount: (p?.practiceCount || 0) + 1,
          reviewCount: (p?.practiceCount || 0) + 1,
          lastCompletedAt: completedAt,
          lastReviewedAt: completedAt,
        };
        delete s.drafts[questionId];
        if (s.session?.queue.includes(questionId))
          s.session.completed[questionId] = attemptId;
      });
      return clone(event);
    },
    setStatus: (questionId, value) =>
      update((s) => {
        status(value);
        s.progress[questionId] = {
          reviewStage: 0,
          nextReviewAt: null,
          practiceCount: 0,
          reviewCount: 0,
          lastCompletedAt: null,
          lastReviewedAt: null,
          ...s.progress[questionId],
          status: value,
        };
      }),
    saveDraft: (questionId, text) =>
      update((s) => {
        s.drafts[questionId] = text;
      }),
    saveSession: (session) =>
      update((s) => {
        if (session?.id !== s.session?.id) s.drafts = {};
        s.session = clone(session);
      }),
    saveCard: (questionId, fields) =>
      update((s) => {
        s.cards[questionId] = clone(fields);
      }),
    saveGap: (row) => upsert("gaps", row),
    deleteGap: (id) =>
      update((s) => {
        s.gaps = s.gaps.filter((r) => r.id !== id);
      }),
    saveTarget: (target) =>
      update((s) => {
        s.target = clone(target);
      }),
    saveMockRound: (row) => upsert("mockRounds", row),
    saveInterviewReview: (row) => upsert("interviewReviews", row),
    exportBackup: () =>
      JSON.stringify({
        format: "agent-interview-lab-offline",
        version: 1,
        exportedAt: new Date().toISOString(),
        state,
      }),
    importBackup: (text) => commit(parseBackup(text, questions)),
    stats(now = new Date().toISOString()) {
      date(now);
      const p = Object.values(state.progress);
      return {
        total: questions.length,
        practiced: p.filter((r) => r.practiceCount > 0).length,
        attempts: state.events.length,
        mastered: p.filter((r) => r.status === "mastered").length,
        due: p.filter((r) => r.nextReviewAt && r.nextReviewAt <= now).length,
        unknown: p.filter((r) => r.status === "unknown").length,
        fuzzy: p.filter((r) => r.status === "fuzzy").length,
      };
    },
  };
}
