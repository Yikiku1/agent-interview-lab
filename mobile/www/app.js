import { createStore } from "./store.js";

const app = document.querySelector("#app");
const statusLabels = { unknown: "不会", fuzzy: "模糊", mastered: "掌握" };
const difficultyLabels = { easy: "基础", medium: "进阶", hard: "挑战" };
const gapLabels = {
  concept: "概念不清",
  expression: "表达不顺",
  evidence: "缺少证据",
  follow_up: "追问卡住",
  other: "其他",
};
const presetLabels = {
  all: "全部题目",
  general_core: "通用核心",
  resume_focus: "简历重点",
  project_story: "项目讲述",
  foundation_fill: "基础补齐",
};
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const day = (value) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
const dateLabel = (value) =>
  value
    ? new Intl.DateTimeFormat("zh-CN", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(value))
    : "未安排";
const option = (value, label, current) =>
  `<option value="${esc(value)}" ${value === current ? "selected" : ""}>${esc(label)}</option>`;
const options = (items, current) =>
  Object.entries(items)
    .map(([v, l]) => option(v, l, current))
    .join("");
let questions,
  byId,
  store,
  listLimit = 30,
  filters = {
    search: "",
    category: "",
    preset: "all",
    status: "",
    project: "",
    priority: "",
  };
let chosenStatus = "fuzzy",
  revealed = false,
  lastQuestion = null,
  toastTimer;

function toast(message) {
  const element = document.querySelector("#toast");
  element.textContent = message;
  element.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    element.style.display = "none";
  }, 4500);
}
function action(fn) {
  try {
    return fn();
  } catch (error) {
    toast(`未保存：${error.message}`);
    return undefined;
  }
}
function navigate(route) {
  if (location.hash === `#${route}`) render();
  else location.hash = route;
}
const state = () => store.getState();
const qFor = (id) => byId.get(Number(id));
function inline(text) {
  return esc(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
      "$1 <small>（外部资料，需联网查看）</small>",
    );
}
// Escape before rendering. Source and imported user text can never create HTML.
function markdown(text) {
  let code = false,
    result = "",
    buffer = [],
    list = false;
  const closeList = () => {
    if (list) {
      result += "</ul>";
      list = false;
    }
  };
  for (const line of String(text || "").split("\n")) {
    if (line.trim().startsWith("```")) {
      closeList();
      if (code) {
        result += `<pre><code>${esc(buffer.join("\n"))}</code></pre>`;
        buffer = [];
      }
      code = !code;
      continue;
    }
    if (code) {
      buffer.push(line);
      continue;
    }
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      closeList();
      result += `<h3>${inline(heading[1])}</h3>`;
    } else if (/^[-*]\s/.test(line)) {
      if (!list) {
        result += "<ul>";
        list = true;
      }
      result += `<li>${inline(line.slice(2))}</li>`;
    } else {
      closeList();
      if (line.startsWith(">"))
        result += `<blockquote>${inline(line.slice(1))}</blockquote>`;
      else if (line.trim()) result += `<p>${inline(line)}</p>`;
    }
  }
  closeList();
  if (code) result += `<pre><code>${esc(buffer.join("\n"))}</code></pre>`;
  return result;
}
function matches(q, f) {
  return (
    (!f.search ||
      `${q.question} ${q.tags.join(" ")}`
        .toLowerCase()
        .includes(f.search.toLowerCase())) &&
    (!f.category || q.category === f.category) &&
    (!f.status ||
      state().progress[q.id]?.status === f.status ||
      (f.status === "new" && !state().progress[q.id]?.practiceCount)) &&
    (!f.project || q.project === f.project) &&
    (!f.priority || q.priority === f.priority) &&
    (!f.preset ||
      f.preset === "all" ||
      (f.preset === "general_core"
        ? q.core
        : f.preset === "resume_focus"
          ? !!q.resume
          : f.preset === "project_story"
            ? !!q.resume && q.project !== "技术基础"
            : q.project === "技术基础"))
  );
}
function scoped(f = state().target || { preset: "all" }) {
  return questions.filter((q) => matches(q, f));
}
function questionRow(q, extra = "") {
  const p = state().progress[q.id];
  return `<a class="question-row" href="#question/${q.id}"><span class="pill">${esc(q.category)}</span>${q.core ? '<span class="pill">核心</span>' : ""}${q.priority ? `<span class="pill">${q.priority}</span>` : ""}<h3>${esc(q.question)}</h3><p>${esc(q.subcategory)} · ${p ? statusLabels[p.status] : "未练"}${extra ? ` · ${esc(extra)}` : ""}</p></a>`;
}
function answerView(q) {
  if (!q.resume) return `<div class="answer">${markdown(q.answer)}</div>`;
  const r = q.resume;
  return `<div class="answer"><span class="pill">${esc(r.kind)}</span><p class="notice">${esc(r.boundary)}</p><h3>60–90 秒回答</h3><p>${esc(r.oral)}</p><h3>三个要点</h3><ul>${r.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>${[
    ["简历依据", r.basis],
    ["本人证据提示", r.evidence],
    ["常见追问", r.followUps.map((x) => "- " + x).join("\n")],
    ["容易踩的坑", r.pitfall],
    ["自查提示", r.selfAssessment],
    ["完整参考答案", q.answer],
  ]
    .map(([t, v]) => `<details><summary>${t}</summary>${markdown(v)}</details>`)
    .join("")}</div>`;
}
function home() {
  const s = state(),
    stats = store.stats(),
    target = s.target,
    today = day(now());
  const completedToday = s.events.filter(
    (e) => day(e.completedAt) === today,
  ).length;
  app.innerHTML = `<p class="eyebrow">每天一小轮，把会的讲清楚</p><h1>今天，练一点。</h1><p class="muted">题库与记录都在手机，断网也能继续。</p>
    <section class="panel hero"><div class="row"><h2>今日练习</h2><a href="#target">${target ? "调整目标" : "设置目标"} ›</a></div><p class="muted">${esc(presetLabels[target?.preset || "all"])}${target?.project ? " · " + esc(target.project) : ""} · 每轮 ${target?.dailySize || 5} 题</p>
    <div class="metrics"><div class="metric"><strong>${completedToday}</strong><span>今日完成次数</span></div><div class="metric"><strong>${stats.due}</strong><span>到期复习</span></div><div class="metric"><strong>${stats.practiced}</strong><span>正式练过 / 670</span></div></div>
    <div class="actions"><button class="primary" data-start="daily">开始今日练习</button>${s.session ? '<a class="button" href="#practice">继续上一轮</a>' : ""}</div></section>
    <div class="grid"><a class="panel" href="#questions" data-preset="resume_focus"><h2>简历重点</h2><small>100 题 · 分层答案</small></a><a class="panel" href="#questions" data-preset="general_core"><h2>通用核心</h2><small>30 题 · 基础路径</small></a></div>
    <section class="panel"><h2>把项目讲具体</h2><p class="muted">职责、主问题和三个追问，完成后再看参考。</p><a class="button" href="#mocks">项目模拟 ›</a></section>
    <section class="panel"><div class="row"><h2>学习足迹</h2><a href="#stats">查看统计 ›</a></div><progress max="670" value="${stats.practiced}"></progress><p class="muted">已覆盖 ${stats.practiced} 题 · ${stats.attempts} 次正式作答</p></section>`;
}
function listPage() {
  const rows = scoped(filters),
    cats = [...new Set(questions.map((q) => q.category))];
  app.innerHTML = `<h1>题库</h1><p class="muted">按方向找题，也可以从短轮开始。</p><section class="panel filters"><input id="search" type="search" placeholder="搜索题干或标签" aria-label="搜索题目" value="${esc(filters.search)}"><div class="grid"><select id="filter-preset" aria-label="学习范围">${options(presetLabels, filters.preset)}</select><select id="filter-category" aria-label="分类">${option("", "全部分类", filters.category)}${cats.map((c) => option(c, c, filters.category)).join("")}</select><select id="filter-status" aria-label="掌握状态">${options({ "": "全部状态", new: "未正式练过", ...statusLabels }, filters.status)}</select><select id="filter-project" aria-label="项目">${["", "VendorGuard", "发票实习", "综合", "技术基础"].map((c) => option(c, c || "全部项目", filters.project)).join("")}</select><select id="filter-priority" aria-label="简历优先级">${["", "P0", "P1", "P2"].map((c) => option(c, c || "全部优先级", filters.priority)).join("")}</select></div><p class="list-count">找到 ${rows.length} 题</p><div class="actions"><button data-list-start="sequential">顺序练 5 题</button><button data-list-start="random">随机练 5 题</button></div></section>
    <section class="panel">${
      rows.length
        ? rows
            .slice(0, listLimit)
            .map((q) => questionRow(q))
            .join("")
        : '<p class="empty">这个范围没有题目，试试调整筛选。</p>'
    }${rows.length > listLimit ? "<button data-more-list>再显示 30 题</button>" : ""}</section>`;
}
function cardForm(q) {
  const c = state().cards[q.id] || {};
  return `<form id="card-form" data-qid="${q.id}" class="compact">${[
    ["shortAnswer", "我的短答"],
    ["example", "我的例子"],
    ["contributionBoundary", "本人职责边界"],
    ["evidence", "证据与待确认"],
  ]
    .map(
      ([key, label]) =>
        `<label for="card-${key}">${label}</label><textarea id="card-${key}" name="${key}" maxlength="10000">${esc(c[key])}</textarea>`,
    )
    .join(
      "",
    )}<button class="primary" type="submit">保存个人卡</button><p class="muted">个人卡不计入正式练习。</p></form>`;
}
function gapForm(q) {
  return `<form id="gap-form" data-qid="${q.id}"><label for="gap-kind">卡在哪里</label><select id="gap-kind" name="kind">${options(gapLabels, "concept")}</select><label for="gap-note">下次要补什么</label><textarea id="gap-note" name="note" maxlength="2000"></textarea><button type="submit">保存卡点</button></form>`;
}
function detail(qid) {
  const q = qFor(qid);
  if (!q) {
    app.innerHTML = "<p>题目不存在。</p>";
    return;
  }
  const p = state().progress[q.id],
    events = state()
      .events.filter((e) => e.questionId === q.id)
      .reverse();
  app.innerHTML = `<a class="back" href="#questions">‹ 返回题库</a><div><span class="pill">${esc(q.category)}</span><span class="pill">${difficultyLabels[q.difficulty]}</span></div><h1>${esc(q.question)}</h1><p class="muted">${p ? statusLabels[p.status] + " · 正式练习 " + p.practiceCount + " 次" : "还没有正式练习"}</p><button class="primary" data-single="${q.id}">独立练这题</button><section class="panel">${answerView(q)}</section><section class="panel"><h2>个人回答卡</h2>${cardForm(q)}</section><section class="panel"><h2>记一个卡点</h2>${gapForm(q)}</section><section class="panel"><h2>正式作答历史</h2>${events.length ? events.map((e) => `<details><summary>${dateLabel(e.completedAt)} · ${statusLabels[e.status]}</summary><p class="history-answer">${esc(e.answer || "口头作答")}</p><button data-copy-answer="${esc(e.attemptId)}" data-qid="${q.id}">复制为个人短答</button></details>`).join("") : '<p class="muted">完成练习后，回答会出现在这里。</p>'}</section>`;
}
function createSession(mode = "daily", customRows = null, size = null) {
  const s = state(),
    target = s.target || {},
    count = size || target.dailySize || 5;
  if (
    s.session &&
    s.session.index < s.session.queue.length &&
    !confirm("开始新一轮会替换当前练习队列和未完成草稿，已保存回答保留。继续？")
  )
    return;
  let rows = customRows || scoped(),
    today = day(now());
  if (mode === "daily") {
    const done = new Set(
      s.events
        .filter((e) => day(e.completedAt) === today)
        .map((e) => e.questionId),
    );
    rows = rows.filter((q) => !done.has(q.id));
    const rank = (q) => {
      const p = s.progress[q.id];
      return p?.nextReviewAt && p.nextReviewAt <= now()
        ? 0
        : p?.practiceCount && p.status !== "mastered"
          ? 1
          : !p?.practiceCount && (q.core || q.resume)
            ? 2
            : 3;
    };
    // New general questions are only introduced by explicit manual practice.
    rows = rows
      .filter((q) => rank(q) < 3)
      .sort(
        (a, b) =>
          rank(a) - rank(b) ||
          (a.priority || "P3").localeCompare(b.priority || "P3") ||
          (a.coreOrder < 0 ? 999 : a.coreOrder) -
            (b.coreOrder < 0 ? 999 : b.coreOrder) ||
          a.id - b.id,
      );
  } else if (mode === "random") {
    rows = [...rows];
    for (let i = rows.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rows[i], rows[j]] = [rows[j], rows[i]];
    }
  }
  if (!rows.length) {
    toast("当前范围没有可练题目，可以在题库手动选题。");
    return;
  }
  store.saveSession({
    id: uid(),
    queue: rows.slice(0, count).map((q) => q.id),
    index: 0,
    completed: {},
    mode,
  });
  chosenStatus = "fuzzy";
  revealed = false;
  navigate("practice");
}
function practice() {
  const s = state(),
    session = s.session;
  if (!session) {
    app.innerHTML =
      '<h1>开始一轮练习</h1><p>每轮 5 题，支持口头作答。</p><button class="primary" data-start="daily">开始今日练习</button>';
    return;
  }
  if (session.index >= session.queue.length) {
    summary(session);
    return;
  }
  const q = qFor(session.queue[session.index]);
  if (lastQuestion !== `${session.id}/${q.id}`) {
    revealed = false;
    chosenStatus = s.progress[q.id]?.status || "fuzzy";
    lastQuestion = `${session.id}/${q.id}`;
  }
  const event = s.events.find((e) => e.attemptId === session.completed[q.id]);
  app.innerHTML = `<div class="row"><a class="back" href="#home">‹ 暂停，返回首页</a><span class="muted">${session.index + 1} / ${session.queue.length}</span></div><progress max="${session.queue.length}" value="${Object.keys(session.completed).length}"></progress><p class="subheading">${esc(q.category)} · ${esc(q.subcategory)}</p><h1>${esc(q.question)}</h1><section class="panel"><label for="practice-answer">先独立回答，也可以只口头作答</label><textarea id="practice-answer" maxlength="10000" ${event ? "readonly" : ""} placeholder="写下思路、例子或关键点…">${esc(event ? event.answer : s.drafts[q.id] || "")}</textarea><p class="muted" id="draft-status">${event ? "已保存正式回答" : "输入后自动保存在本轮草稿中"}</p><button data-reveal>${revealed ? "收起参考答案" : "查看参考答案"}</button>${revealed ? `<div class="answer">${answerView(q)}</div>` : ""}</section>
    <section class="panel"><h2>${event ? "本题已完成" : "自评掌握程度"}</h2>${
      event
        ? `<p>${statusLabels[event.status]} · ${dateLabel(event.completedAt)}</p>`
        : `<div class="actions">${Object.entries(statusLabels)
            .map(
              ([v, l]) =>
                `<button data-rating="${v}" class="${chosenStatus === v ? "selected" : ""}" aria-pressed="${chosenStatus === v}">${l}</button>`,
            )
            .join(
              "",
            )}</div><p class="muted">选择自评后，点“完成本题”才计入练习。</p>`
    }
    <div class="actions">${event ? '<button class="primary" data-next>下一题</button>' : '<button class="primary" data-complete>完成本题</button><button data-skip>先跳过</button>'}</div></section>
    ${revealed ? `<section class="panel"><h2>要点自查</h2>${(q.resume?.points || []).map((p, i) => `<label class="check"><input type="checkbox" data-point="${i}" ${session.pointChecks?.[q.id]?.includes(i) ? "checked" : ""}>${esc(p)}</label>`).join("") || '<p class="muted">对照参考，检查是否讲清原理与例子。</p>'}<details><summary>记录卡点</summary>${gapForm(q)}</details>${event ? `<details><summary>整理个人回答卡</summary>${cardForm(q)}</details>` : ""}</section>` : ""}
    <div class="actions"><button data-prev ${session.index === 0 ? "disabled" : ""}>上一题</button><button data-end>结束本轮</button></div>`;
}
function summary(session) {
  const done = session.queue.filter((id) => session.completed[id]);
  app.innerHTML = `<p class="eyebrow">一轮结束</p><h1>把今天练的，留下来。</h1><section class="panel hero"><h2>完成 ${done.length} / ${session.queue.length} 题</h2><p class="muted">已保存 ${done.length} 次正式回答，跳过的题不计入完成。</p><div class="actions"><a href="#home" class="button primary">回到今日</a><button data-retry-weak>再练薄弱题</button></div></section><section class="panel">${session.queue.map((id) => questionRow(qFor(id), session.completed[id] ? "本轮已完成" : "本轮未完成")).join("")}</section>${done.length < session.queue.length ? "<button data-resume-unfinished>继续未完成题目</button>" : ""}`;
}
function reviewPage() {
  const s = state(),
    rows = questions.filter(
      (q) =>
        s.progress[q.id]?.nextReviewAt &&
        s.progress[q.id].nextReviewAt <= now(),
    );
  app.innerHTML = `<h1>到期复习</h1><p class="muted">不会隔 1 天，模糊隔 3 天；连续掌握按 1 / 3 / 7 / 14 天复习。</p><section class="panel hero"><h2>${rows.length} 题等待复习</h2><button class="primary" data-due-start ${rows.length ? "" : "disabled"}>复习 5 题</button></section><section class="panel">${
    rows.length
      ? rows
          .slice(0, 60)
          .map((q) => questionRow(q, dateLabel(s.progress[q.id].nextReviewAt)))
          .join("")
      : '<p class="empty">今天没有到期题，去题库学一点新的吧。</p>'
  }</section><a class="button" href="#gaps">查看卡点补练</a>`;
}
function more() {
  app.innerHTML = `<h1>我的学习</h1><p class="muted">离线版 1.0 · 全部资料保存在这台手机</p><section class="panel">${[
    ["stats", "学习统计"],
    ["target", "训练目标"],
    ["gaps", "卡点与定向补练"],
    ["mocks", "项目模拟"],
    ["interviews", "真实面试复盘"],
    ["backup", "备份与恢复"],
  ]
    .map(
      ([r, l]) => `<a class="section-link" href="#${r}">${l}<span>›</span></a>`,
    )
    .join(
      "",
    )}</section><p class="notice">手机与电脑的记录各自保存。卸载前请导出备份；重新安装后可导入恢复。</p>`;
}
function targetPage() {
  const t = state().target || {
    preset: "all",
    project: "",
    priority: "",
    dailySize: 5,
  };
  app.innerHTML = `<a href="#more" class="back">‹ 我的学习</a><h1>训练目标</h1><form id="target-form" class="panel"><label for="target-preset">学习范围</label><select id="target-preset" name="preset">${options(presetLabels, t.preset)}</select><label for="target-project">项目</label><select id="target-project" name="project">${["", "VendorGuard", "发票实习", "综合", "技术基础"].map((c) => option(c, c || "不限项目", t.project)).join("")}</select><label for="target-priority">简历优先级</label><select id="target-priority" name="priority">${["", "P0", "P1", "P2"].map((c) => option(c, c || "不限优先级", t.priority)).join("")}</select><label for="target-size">每轮题数</label><select id="target-size" name="dailySize">${[3, 5, 10, 20].map((n) => option(String(n), `${n} 题`, String(t.dailySize))).join("")}</select><label for="target-date">面试日期（可选）</label><input id="target-date" type="date" name="interviewDate" value="${esc(t.interviewDate)}"><div class="actions"><button type="submit" class="primary">保存目标</button></div><p class="muted">只影响新一轮选题，已开始的队列会保留。</p></form>`;
}
function gapsPage() {
  const gaps = state().gaps;
  app.innerHTML = `<a href="#more" class="back">‹ 我的学习</a><h1>卡点补练</h1><p class="muted">把卡住的地方记下来，下次集中补齐。</p><button data-gap-start class="primary">补练未解决的 5 题</button><section class="panel">${
    gaps.length
      ? gaps
          .slice()
          .reverse()
          .map(
            (g) =>
              `<article class="question-row"><span class="pill">${gapLabels[g.kind] || "其他"}</span><span class="pill">${g.resolvedAt ? "已解决" : "待补齐"}</span><h3><a href="#question/${g.questionId}">${esc(qFor(g.questionId)?.question)}</a></h3><p>${esc(g.note)}</p><button data-gap-toggle="${esc(g.id)}">${g.resolvedAt ? "重新打开" : "标记解决"}</button></article>`,
          )
          .join("")
      : '<p class="empty">还没有卡点，可以在题目详情或练习中记录。</p>'
  }</section>`;
}
function statsPage() {
  const s = state(),
    stats = store.stats(),
    scope = scoped();
  app.innerHTML = `<a href="#more" class="back">‹ 我的学习</a><h1>学习统计</h1><div class="metrics"><div class="metric"><strong>${stats.practiced}</strong><span>正式练过</span></div><div class="metric"><strong>${stats.attempts}</strong><span>完成次数</span></div><div class="metric"><strong>${stats.mastered}</strong><span>当前自评掌握</span></div></div><section class="panel"><h2>当前目标覆盖</h2><p>${scope.filter((q) => s.progress[q.id]?.practiceCount).length} / ${scope.length} 题 · ${esc(presetLabels[s.target?.preset || "all"])}</p><progress max="${scope.length || 1}" value="${scope.filter((q) => s.progress[q.id]?.practiceCount).length}"></progress><p class="muted">正式覆盖只统计“完成本题”，自评与个人卡独立计算。</p></section><section class="panel"><h2>分类进度</h2>${[
    ...new Set(questions.map((q) => q.category)),
  ]
    .map((c) => {
      const rows = questions.filter((q) => q.category === c),
        n = rows.filter((q) => s.progress[q.id]?.practiceCount).length;
      return `<p class="row"><span>${esc(c)}</span><small>${n} / ${rows.length}</small></p><progress max="${rows.length}" value="${n}"></progress>`;
    })
    .join(
      "",
    )}</section><section class="panel"><h2>个人积累</h2><p>个人卡 ${Object.keys(s.cards).length} 张 · 未解决卡点 ${s.gaps.filter((g) => !g.resolvedAt).length} 条</p><p>项目模拟 ${s.mockRounds.filter((m) => m.endedAt).length} 轮 · 面试复盘 ${s.interviewReviews.length} 次</p></section>`;
}
function mocksPage(id) {
  const s = state(),
    round = s.mockRounds.find((r) => r.id === id);
  if (round) {
    const q = qFor(round.questionId);
    if (round.endedAt) {
      app.innerHTML = `<a class="back" href="#mocks">‹ 模拟列表</a><h1>模拟总结</h1><p>${esc(round.project)} · ${round.nodes.filter((n) => n.state === "answered").length} / 5 个节点已答</p>${round.nodes.map((n, i) => `<section class="panel"><small>节点 ${i + 1} · ${n.state === "answered" ? "已答" : n.state === "skipped" ? "跳过" : "未答"}</small><h2>${esc(n.prompt)}</h2><p class="history-answer">${esc(n.answer || "未填写文字")}</p>${n.gapNote ? `<p class="notice">卡点：${esc(n.gapNote)}</p>` : ""}</section>`).join("")}<section class="panel"><h2>参考与改进</h2>${answerView(q)}</section>`;
      return;
    }
    const n = round.nodes[round.index];
    app.innerHTML = `<div class="row"><a class="back" href="#mocks">‹ 暂停模拟</a><span class="muted">${round.index + 1} / 5</span></div><p class="subheading">${esc(round.project)} · 独立作答</p><h1>${esc(n.prompt)}</h1><section class="panel"><label for="mock-answer">我的回答（空白表示口头已答）</label><textarea id="mock-answer" maxlength="10000" data-round="${esc(id)}">${esc(n.answer)}</textarea><label for="mock-gap">本节点的卡点（可选）</label><textarea id="mock-gap" maxlength="2000" data-round="${esc(id)}">${esc(n.gapNote)}</textarea><div class="actions"><button data-mock-action="answer" data-id="${esc(id)}" class="primary">保存并继续</button><button data-mock-action="skip" data-id="${esc(id)}">跳过</button></div><button data-mock-action="finish" data-id="${esc(id)}">提前结束</button><p class="muted">回答自动保留。模拟不计入普通练习，结束后再展示参考。</p></section>`;
    return;
  }
  const candidates = questions.filter(
    (q) =>
      q.resume?.kind === "简历实战" &&
      ["VendorGuard", "发票实习"].includes(q.project),
  );
  app.innerHTML = `<a class="back" href="#more">‹ 我的学习</a><h1>项目模拟</h1><p class="muted">职责 → 主问题 → 三个追问，共五个节点。</p><form id="mock-form" class="panel"><label for="mock-question">选择主问题</label><select id="mock-question" name="questionId">${candidates.map((q) => option(String(q.id), q.question, "")).join("")}</select><div class="actions"><button class="primary" type="submit">开始模拟</button></div></form><section class="panel"><h2>我的模拟</h2>${
    s.mockRounds.length
      ? s.mockRounds
          .slice()
          .reverse()
          .map(
            (r) =>
              `<a class="question-row" href="#mocks/${esc(r.id)}"><h3>${esc(qFor(r.questionId)?.question)}</h3><p>${dateLabel(r.createdAt)} · ${r.endedAt ? "查看总结" : "继续模拟"}</p></a>`,
          )
          .join("")
      : '<p class="empty">还没有模拟记录。</p>'
  }</section>`;
}
function interviewsPage(id) {
  const s = state();
  if (id) {
    const review = s.interviewReviews.find((r) => r.id === id),
      item = review?.questions[0];
    app.innerHTML = `<a href="#interviews" class="back">‹ 面试复盘列表</a><h1>${review ? "编辑复盘" : "记录一次面试"}</h1><form id="interview-form" class="panel compact" data-id="${esc(review?.id || "")}"><label for="interview-company">公司 / 轮次（可选）</label><input id="interview-company" name="company" maxlength="200" value="${esc(review?.company)}"><label for="interview-prompt">面试官实际问了什么</label><textarea id="interview-prompt" name="prompt" maxlength="10000" required>${esc(item?.prompt)}</textarea><label for="interview-answer">当时怎么答的</label><textarea id="interview-answer" name="answer" maxlength="10000">${esc(item?.answer)}</textarea><label for="interview-gap">卡点与不足</label><textarea id="interview-gap" name="gap" maxlength="2000">${esc(item?.gap)}</textarea><label for="interview-improvement">下次准备怎么改</label><textarea id="interview-improvement" name="improvement" maxlength="10000">${esc(item?.improvement)}</textarea><label for="interview-question">关联题库题目（可选）</label><select id="interview-question" name="questionId">${option("", "暂不关联", String(item?.questionId || ""))}${questions.map((q) => option(String(q.id), q.question, String(item?.questionId || ""))).join("")}</select><div class="actions"><button class="primary" type="submit">保存复盘</button></div><small id="interview-draft-hint">未保存的编辑会自动保留在本机。</small></form>${item?.questionId ? `<section class="panel"><h2>关联补练</h2><p>关联后正式完成 ${s.events.filter((e) => e.questionId === item.questionId && !item.baselineEventIds.includes(e.attemptId) && e.completedAt >= item.linkedAt).length} 次</p><button data-single="${item.questionId}">练这道题</button></section>` : ""}`;
    restoreInterviewDraft(review?.id || "new");
    return;
  }
  app.innerHTML = `<a class="back" href="#more">‹ 我的学习</a><h1>真实面试复盘</h1><p class="muted">保留面试原话，找到下次可以改进的一点。</p><a class="button primary" href="#interviews/new">记录一次面试</a><section class="panel">${
    s.interviewReviews.length
      ? s.interviewReviews
          .slice()
          .reverse()
          .map(
            (r) =>
              `<a href="#interviews/${esc(r.id)}" class="question-row"><h3>${esc(r.questions[0]?.prompt)}</h3><p>${esc(r.company || "面试复盘")} · ${dateLabel(r.createdAt)}</p></a>`,
          )
          .join("")
      : '<p class="empty">还没有复盘。填一个真实问题就能保存。</p>'
  }</section>`;
}
// Keep unfinished review form fields in the same SQLite state/backup as drafts.
function restoreInterviewDraft(id) {
  const draft = state().target?.reviewDrafts?.[id];
  if (!draft) return;
  const form = document.querySelector("#interview-form");
  for (const [key, value] of Object.entries(draft))
    if (form.elements.namedItem(key))
      form.elements.namedItem(key).value = value ?? "";
}
function backupPage() {
  app.innerHTML = `<a href="#more" class="back">‹ 我的学习</a><h1>备份与恢复</h1><section class="panel hero"><h2>把学习记录留一份</h2><p class="muted">包含正式回答、草稿、个人卡、卡点、目标、模拟与复盘。题库已随 App 提供。</p><button class="primary" id="export-backup">导出完整备份</button></section><section class="panel"><h2>从备份恢复</h2><p class="muted">恢复会替换这台手机的学习记录，建议先导出当前备份。</p>${window.OfflineNative ? '<button id="import-backup">选择备份文件</button>' : '<input type="file" id="import-file" accept="application/json,.json" aria-label="选择备份文件">'}<p class="muted">只接受此离线版导出的 JSON 备份，电脑 PostgreSQL 备份不能直接导入。</p></section><p class="notice">请把备份保存到 App 之外的位置。卸载应用会清除手机里的记录；更新时使用相同签名安装包可保留数据。</p>`;
}
window.onNativeFileResult = (message) => toast(message);
window.onNativeImport = (text) =>
  action(() => {
    if (!confirm("确认用备份替换手机当前记录？此操作不会自动合并。")) return;
    store.importBackup(text);
    render();
    toast("恢复完成");
  });
function importText(text) {
  window.onNativeImport(text);
}
function render() {
  const [path, id] = location.hash.slice(1).split("/");
  const route = path || "home";
  document
    .querySelectorAll("nav a")
    .forEach((a) =>
      a.classList.toggle(
        "active",
        a.hash ===
          `#${["home", "questions", "review"].includes(route) ? route : "more"}`,
      ),
    );
  switch (route) {
    case "questions":
      listPage();
      break;
    case "question":
      detail(id);
      break;
    case "practice":
      practice();
      break;
    case "review":
      reviewPage();
      break;
    case "more":
      more();
      break;
    case "target":
      targetPage();
      break;
    case "gaps":
      gapsPage();
      break;
    case "stats":
      statsPage();
      break;
    case "mocks":
      mocksPage(id);
      break;
    case "interviews":
      interviewsPage(id);
      break;
    case "backup":
      backupPage();
      break;
    default:
      home();
  }
}
app.addEventListener("click", (event) =>
  action(() => {
    const el = event.target.closest("button,a");
    if (!el) return;
    if (el.dataset.preset) {
      filters = {
        search: "",
        category: "",
        preset: el.dataset.preset,
        status: "",
        project: "",
        priority: "",
      };
      listLimit = 30;
    }
    if (el.hasAttribute("data-start")) createSession(el.dataset.start);
    if (el.hasAttribute("data-list-start"))
      createSession(el.dataset.listStart, scoped(filters), 5);
    if (el.hasAttribute("data-single"))
      createSession("sequential", [qFor(el.dataset.single)], 1);
    if (el.hasAttribute("data-more-list")) {
      listLimit += 30;
      listPage();
    }
    if (el.hasAttribute("data-reveal")) {
      revealed = !revealed;
      practice();
    }
    if (el.dataset.rating) {
      chosenStatus = el.dataset.rating;
      app.querySelectorAll("[data-rating]").forEach((b) => {
        b.classList.toggle("selected", b.dataset.rating === chosenStatus);
        b.setAttribute(
          "aria-pressed",
          String(b.dataset.rating === chosenStatus),
        );
      });
    }
    if (el.hasAttribute("data-complete")) {
      const s = state(),
        q = s.session.queue[s.session.index],
        answer = document.querySelector("#practice-answer").value;
      store.complete({
        questionId: q,
        attemptId: uid(),
        status: chosenStatus,
        answer,
      });
      practice();
      toast("已保存回答并安排复习");
    }
    if (
      ["data-next", "data-skip", "data-prev", "data-end"].some((k) =>
        el.hasAttribute(k),
      )
    ) {
      const session = state().session;
      session.index = el.hasAttribute("data-end")
        ? session.queue.length
        : session.index + (el.hasAttribute("data-prev") ? -1 : 1);
      store.saveSession(session);
      render();
      window.scrollTo(0, 0);
    }
    if (el.hasAttribute("data-resume-unfinished")) {
      const session = state().session;
      session.index = session.queue.findIndex((id) => !session.completed[id]);
      store.saveSession(session);
      render();
    }
    if (el.hasAttribute("data-retry-weak")) {
      const s = state();
      createSession(
        "sequential",
        s.session.queue
          .filter((id) => s.progress[id]?.status !== "mastered")
          .map(qFor),
        20,
      );
    }
    if (el.hasAttribute("data-due-start")) {
      const s = state();
      createSession(
        "sequential",
        questions
          .filter(
            (q) =>
              s.progress[q.id]?.nextReviewAt &&
              s.progress[q.id].nextReviewAt <= now(),
          )
          .sort((a, b) =>
            s.progress[a.id].nextReviewAt.localeCompare(
              s.progress[b.id].nextReviewAt,
            ),
          ),
        5,
      );
    }
    if (el.hasAttribute("data-gap-start"))
      createSession(
        "sequential",
        [
          ...new Set(
            state()
              .gaps.filter((g) => !g.resolvedAt)
              .map((g) => g.questionId),
          ),
        ].map(qFor),
        5,
      );
    if (el.dataset.gapToggle) {
      const g = state().gaps.find((g) => g.id === el.dataset.gapToggle);
      store.saveGap({ ...g, resolvedAt: g.resolvedAt ? null : now() });
      render();
    }
    if (el.dataset.copyAnswer) {
      const e = state().events.find(
          (e) => e.attemptId === el.dataset.copyAnswer,
        ),
        card = state().cards[e.questionId] || {};
      store.saveCard(e.questionId, { ...card, shortAnswer: e.answer });
      render();
      toast("已复制到个人短答");
    }
    if (el.dataset.mockAction) {
      const r = state().mockRounds.find((r) => r.id === el.dataset.id);
      if (el.dataset.mockAction === "finish") {
        if (!confirm("结束后不能继续本轮，确认结束？")) return;
        r.endedAt = now();
      } else {
        r.nodes[r.index].state =
          el.dataset.mockAction === "answer" ? "answered" : "skipped";
        r.index++;
        if (r.index === r.nodes.length) r.endedAt = now();
      }
      store.saveMockRound(r);
      render();
      window.scrollTo(0, 0);
    }
    if (el.id === "export-backup") {
      const text = store.exportBackup();
      if (window.OfflineNative) {
        window.OfflineNative.exportBackup(text);
      } else {
        const url = URL.createObjectURL(
            new Blob([text], { type: "application/json" }),
          ),
          a = document.createElement("a");
        a.href = url;
        a.download = `interview-offline-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    }
    if (el.id === "import-backup") window.OfflineNative.importBackup();
  }),
);
app.addEventListener("input", (event) => {
  const el = event.target;
  if (el.id === "search") {
    const pos = el.selectionStart;
    filters.search = el.value;
    listLimit = 30;
    listPage();
    const input = document.querySelector("#search");
    input.focus();
    input.setSelectionRange(pos, pos);
    return;
  }
  if (el.id === "practice-answer")
    action(() => {
      const s = state();
      store.saveDraft(s.session.queue[s.session.index], el.value);
      document.querySelector("#draft-status").textContent = "草稿已保存在本机";
    });
  if (el.id === "mock-answer" || el.id === "mock-gap")
    action(() => {
      const r = state().mockRounds.find((r) => r.id === el.dataset.round);
      r.nodes[r.index][el.id === "mock-answer" ? "answer" : "gapNote"] =
        el.value;
      store.saveMockRound(r);
    });
  if (el.closest("#interview-form"))
    action(() => {
      const form = el.closest("form"),
        id = form.dataset.id || "new",
        s = state(),
        fields = Object.fromEntries(new FormData(form));
      fields.questionId = fields.questionId ? Number(fields.questionId) : null;
      store.saveTarget({
        ...s.target,
        preset: s.target?.preset || "all",
        dailySize: s.target?.dailySize || 5,
        reviewDrafts: { ...s.target?.reviewDrafts, [id]: fields },
      });
      document.querySelector("#interview-draft-hint").textContent =
        "编辑草稿已保存在本机";
    });
});
app.addEventListener("change", (event) =>
  action(() => {
    const el = event.target;
    if (el.id.startsWith("filter-")) {
      filters[el.id.slice(7)] = el.value;
      listLimit = 30;
      listPage();
    }
    if (el.hasAttribute("data-point")) {
      const s = state(),
        session = s.session,
        q = session.queue[session.index],
        points = new Set(session.pointChecks?.[q] || []);
      if (el.checked) points.add(Number(el.dataset.point));
      else points.delete(Number(el.dataset.point));
      session.pointChecks = { ...session.pointChecks, [q]: [...points] };
      store.saveSession(session);
    }
    if (el.id === "import-file" && el.files[0]) {
      if (el.files[0].size > 8 * 1024 * 1024)
        throw new Error("备份文件超过 8MB");
      el.files[0]
        .text()
        .then(importText)
        .catch((e) => toast(e.message));
    }
  }),
);
app.addEventListener("submit", (event) => {
  event.preventDefault();
  action(() => {
    const form = event.target,
      fields = Object.fromEntries(new FormData(form));
    if (form.id === "card-form") {
      store.saveCard(Number(form.dataset.qid), fields);
      toast("个人卡已保存");
    }
    if (form.id === "gap-form") {
      store.saveGap({
        id: uid(),
        questionId: Number(form.dataset.qid),
        ...fields,
        createdAt: now(),
        resolvedAt: null,
      });
      form.reset();
      toast("卡点已保存");
    }
    if (form.id === "target-form") {
      if (
        fields.preset === "general_core" &&
        (fields.project || fields.priority)
      )
        throw new Error("通用核心不附带项目或简历优先级，请清空这两个条件");
      if (fields.preset === "project_story" && fields.project === "技术基础")
        throw new Error("项目讲述不包含技术基础");
      if (
        fields.preset === "foundation_fill" &&
        fields.project &&
        fields.project !== "技术基础"
      )
        throw new Error("基础补齐只包含技术基础");
      store.saveTarget({
        ...state().target,
        ...fields,
        dailySize: Number(fields.dailySize),
        interviewDate: fields.interviewDate || null,
      });
      toast("目标已保存");
      navigate("home");
    }
    if (form.id === "mock-form") {
      const q = qFor(fields.questionId),
        r = {
          id: uid(),
          questionId: q.id,
          project: q.project,
          createdAt: now(),
          endedAt: null,
          index: 0,
          nodes: [
            `请介绍你在${q.project}中的职责、亲自实现的部分，以及贡献边界。`,
            q.question,
            ...q.resume.followUps,
          ].map((prompt) => ({
            prompt,
            answer: "",
            state: "pending",
            gapNote: "",
          })),
        };
      store.saveMockRound(r);
      navigate(`mocks/${r.id}`);
    }
    if (form.id === "interview-form") {
      const s = state(),
        old = s.interviewReviews.find((r) => r.id === form.dataset.id),
        questionId = fields.questionId ? Number(fields.questionId) : null,
        prev = old?.questions[0],
        same = prev?.questionId === questionId;
      store.saveInterviewReview({
        id: old?.id || uid(),
        company: fields.company,
        createdAt: old?.createdAt || now(),
        updatedAt: now(),
        questions: [
          {
            id: prev?.id || uid(),
            prompt: fields.prompt,
            answer: fields.answer,
            gap: fields.gap,
            improvement: fields.improvement,
            questionId,
            linkedAt: questionId ? (same ? prev.linkedAt : now()) : null,
            baselineEventIds: questionId
              ? same
                ? prev.baselineEventIds
                : s.events
                    .filter((e) => e.questionId === questionId)
                    .map((e) => e.attemptId)
              : [],
          },
        ],
      });
      const t = state().target;
      if (t?.reviewDrafts) {
        delete t.reviewDrafts[old?.id || "new"];
        store.saveTarget(t);
      }
      toast("面试复盘已保存");
      navigate("interviews");
    }
  });
});
document.querySelector("#theme").addEventListener("click", () => {
  document.documentElement.classList.toggle("dark");
  try {
    localStorage.setItem(
      "offline-theme",
      document.documentElement.classList.contains("dark") ? "dark" : "light",
    );
  } catch {
    /* Theme persistence is optional. */
  }
});
try {
  if (
    localStorage.getItem("offline-theme") === "dark" ||
    (!localStorage.getItem("offline-theme") &&
      matchMedia("(prefers-color-scheme: dark)").matches)
  )
    document.documentElement.classList.add("dark");
} catch {
  /* Keep default theme. */
}
window.addEventListener("hashchange", () => {
  action(render);
  window.scrollTo(0, 0);
});
try {
  const response = await fetch("./questions.json");
  if (!response.ok) throw new Error("本地题库文件缺失");
  questions = await response.json();
  byId = new Map(questions.map((q) => [q.id, q]));
  store = createStore({ questions });
  render();
} catch (error) {
  app.innerHTML = `<h1>暂时无法打开</h1><p>${esc(error.message)}</p><p>请保留应用数据，重启后再试。不要通过卸载清除学习记录。</p>`;
}
