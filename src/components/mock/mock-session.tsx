"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Field, FieldLabel } from "@/components/ui/field";
import { Progress } from "@/components/ui/progress";
import {
  mockDraftKey,
  mockDraftSchema,
  mockNodeLabels,
  type MockActionPayload,
  type MockAnswerFields,
} from "@/lib/mock-interview-contract";
import { gapKinds } from "@/lib/learning-contract";
import { gapLabels } from "@/lib/practice-notes-contract";
import {
  parseNoteDraft,
  readNoteDraft,
  subscribeNotes,
  writeNoteDraft,
} from "@/lib/note-draft";
import type { MockRoundView } from "@/lib/mock-interview";
import type { z } from "zod";

export function MockSession({ initial }: { initial: MockRoundView }) {
  const [round, setRound] = useState(initial);
  const [notice, setNotice] = useState("");
  const [conflict, setConflict] = useState<{
    round: MockRoundView;
    answer: string;
  } | null>(null);
  const router = useRouter();
  if (round.endedAt)
    return (
      <div className="panel panel-padding">
        <p>本轮已结束，回答已保存。</p>
        <Button className="mt-4" onClick={() => router.refresh()}>
          查看本轮总结
        </Button>
      </div>
    );
  const node = round.nodes.find(
    (item) => item.position === round.currentPosition,
  )!;
  const completed = round.states.filter(
    (item) => item.state !== "pending",
  ).length;
  return (
    <div className="reading-column page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">{round.project} 项目模拟</h1>
          <p className="page-description">
            当前第 {node.position + 1} / 5 节点 · 之后还有 {4 - node.position}{" "}
            个节点
          </p>
        </div>
        <Link href="/mock-interviews" className="subtle-link">
          返回模拟列表
        </Link>
      </div>
      <Progress value={(completed / 5) * 100} label="模拟节点进度" />
      <ol
        aria-label="模拟节点顺序"
        className="flex flex-wrap gap-2 text-xs text-muted-foreground"
      >
        {round.states.map((item) => (
          <li
            key={item.position}
            className={
              item.position === node.position ? "font-medium text-accent" : ""
            }
          >
            {mockNodeLabels[item.position]} ·{" "}
            {item.state === "answered"
              ? "已答"
              : item.state === "skipped"
                ? "已跳过"
                : item.position === node.position
                  ? "当前"
                  : "待答"}
          </li>
        ))}
      </ol>
      {conflict ? (
        <Alert tone="warning">
          <p>本轮已在其他页面更新。本地回答保留在下方，请先核对。</p>
          <pre className="whitespace-pre-wrap break-words text-sm my-3">
            {conflict.answer || "口头作答，没有文字简记。"}
          </pre>
          <Button
            variant="secondary"
            onClick={() => {
              setRound(conflict.round);
              setConflict(null);
              if (conflict.round.endedAt) router.refresh();
            }}
          >
            已核对，继续服务器轮次
          </Button>
        </Alert>
      ) : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      <MockNodeEditor
        key={`${round.id}:${node.position}:${round.revision}`}
        round={round}
        node={node}
        blocked={!!conflict}
        onSaved={(next, action) => {
          setRound(next);
          setNotice(
            action === "draft"
              ? "草稿已保存，可以从模拟列表继续本轮。"
              : "上一节点已保存。",
          );
          if (next.endedAt) router.refresh();
        }}
        onConflict={(next, answer) => setConflict({ round: next, answer })}
      />
      <p className="text-xs leading-6 text-muted-foreground">
        参考在结束后统一展示。节点保存仅记录本次模拟；普通练习次数、掌握状态和复习安排分别保留。
      </p>
    </div>
  );
}

function MockNodeEditor({
  round,
  node,
  blocked,
  onSaved,
  onConflict,
}: {
  round: MockRoundView;
  node: MockRoundView["nodes"][number];
  blocked: boolean;
  onSaved: (round: MockRoundView, action: MockActionPayload["action"]) => void;
  onConflict: (round: MockRoundView, answer: string) => void;
}) {
  const key = mockDraftKey(round.id, node.position);
  const raw = useSyncExternalStore(
    subscribeNotes,
    () => readNoteDraft(key),
    () => null,
  );
  const storedDraft = parseNoteDraft(raw, (value) =>
    mockDraftSchema.parse(value),
  );
  // A storage event from another tab must not replace an in-progress local edit.
  const [localDraft, setLocalDraft] = useState<z.infer<
    typeof mockDraftSchema
  > | null>(null);
  const draft = localDraft ?? storedDraft;
  const fields: MockAnswerFields = draft ?? node;
  const fieldsRef = useRef(fields);
  useEffect(() => {
    fieldsRef.current = fields;
  }, [fields]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [ending, setEnding] = useState(false);
  useEffect(() => {
    document.getElementById("mock-node-title")?.focus();
  }, []);
  const stale =
    !!draft && draft.baseRevision !== round.revision && !draft.pending;
  const locked = busy || blocked || !!draft?.pending || stale;
  function persist(
    next: MockAnswerFields,
    pending: MockActionPayload | null = null,
    revision = round.revision,
  ) {
    const value = {
      version: 1 as const,
      baseRevision: revision,
      answer: next.answer,
      elapsedSeconds: next.elapsedSeconds,
      gaps: next.gaps,
      gapNote: next.gapNote,
      pending,
    };
    fieldsRef.current = value;
    setLocalDraft(value);
    if (!writeNoteDraft(key, value))
      setMessage("浏览器无法保存草稿，请保持本页打开并保存到服务器。");
  }
  useEffect(() => {
    if (!running || locked) return;
    let previous = performance.now();
    let remainder = 0;
    const timer = setInterval(() => {
      const now = performance.now();
      if (document.visibilityState === "visible") remainder += now - previous;
      previous = now;
      const added = Math.floor(remainder / 1000);
      if (!added) return;
      remainder %= 1000;
      const current = fieldsRef.current;
      const value = {
        version: 1 as const,
        baseRevision: round.revision,
        answer: current.answer,
        gaps: current.gaps,
        gapNote: current.gapNote,
        elapsedSeconds: Math.min(86400, current.elapsedSeconds + added),
        pending: null,
      };
      fieldsRef.current = value;
      setLocalDraft(value);
      if (!writeNoteDraft(key, value))
        setMessage("计时仅在本页保留，请保存到服务器。");
    }, 1000);
    return () => clearInterval(timer);
  }, [running, locked, key, round.revision]);
  async function save(action: MockActionPayload["action"]) {
    if (busyRef.current || blocked) return;
    busyRef.current = true;
    setBusy(true);
    setRunning(false);
    setMessage("");
    const current = fieldsRef.current;
    const payload = draft?.pending ?? {
      requestId: crypto.randomUUID(),
      expectedRevision: round.revision,
      position: node.position,
      action,
      answer: current.answer,
      elapsedSeconds: current.elapsedSeconds,
      gaps: current.gaps,
      gapNote: current.gapNote,
    };
    persist(current, payload, draft?.baseRevision ?? round.revision);
    try {
      const response = await fetch(`/api/mock-interviews/${round.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) {
        if (response.status === 409 && body.round) {
          persist(current);
          onConflict(body.round, current.answer);
        } else if (response.status < 500) persist(current);
        throw new Error(body.error ?? "保存失败");
      }
      writeNoteDraft(key, null);
      onSaved(body.round, payload.action);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "保存尚未确认，请重试；回答已保留。",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className="panel panel-padding flex flex-col gap-5"
      aria-labelledby="mock-node-title"
    >
      <div>
        <p className="text-xs text-muted-foreground">
          {mockNodeLabels[node.position]}
          {node.parentPosition !== null ? " · 承接本轮主问题" : ""}
        </p>
        <h2
          id="mock-node-title"
          tabIndex={-1}
          className="mt-3 text-xl leading-8 font-semibold break-words"
        >
          {node.prompt}
        </h2>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm tabular-nums" data-testid="mock-timer">
          已记录 {fields.elapsedSeconds} 秒
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={locked}
          onClick={() => setRunning(!running)}
        >
          {running ? "暂停计时" : "开始计时"}
        </Button>
        <span className="text-xs text-muted-foreground">
          仅累计本页可见时的作答时间
        </span>
      </div>
      <Field>
        <FieldLabel htmlFor="mock-answer">本节点回答 / 口头简记</FieldLabel>
        <textarea
          id="mock-answer"
          className="control min-h-48 resize-y"
          rows={7}
          maxLength={10000}
          value={fields.answer}
          disabled={locked}
          onChange={(event) =>
            persist({ ...fields, answer: event.target.value })
          }
        />
        <p className="text-xs text-muted-foreground">
          可口头作答并留空；只有明确保存并继续才记为已答。
        </p>
      </Field>
      <fieldset disabled={locked} className="flex flex-col gap-3">
        <legend className="text-sm font-medium mb-3">
          本人记录的卡点（可选）
        </legend>
        <div className="flex flex-wrap gap-4">
          {gapKinds.map((kind) => (
            <label
              key={kind}
              className="flex items-center gap-2 min-h-11 text-sm"
            >
              <input
                type="checkbox"
                checked={fields.gaps.includes(kind)}
                onChange={(event) =>
                  persist({
                    ...fields,
                    gaps: event.target.checked
                      ? [...fields.gaps, kind]
                      : fields.gaps.filter((value) => value !== kind),
                  })
                }
              />
              {gapLabels[kind]}
            </label>
          ))}
        </div>
        <Field>
          <FieldLabel htmlFor="mock-gap-note">卡点说明</FieldLabel>
          <textarea
            id="mock-gap-note"
            className="control"
            rows={2}
            maxLength={2000}
            value={fields.gapNote}
            onChange={(event) =>
              persist({ ...fields, gapNote: event.target.value })
            }
          />
        </Field>
      </fieldset>
      {stale ? (
        <Alert tone="warning">
          服务器草稿已有更新，本地编辑仍保留。
          <Button
            variant="secondary"
            className="mt-3"
            onClick={() =>
              persist({
                ...fields,
                elapsedSeconds: Math.max(
                  fields.elapsedSeconds,
                  node.elapsedSeconds,
                ),
              })
            }
          >
            保留本地编辑，采用当前版本
          </Button>
        </Alert>
      ) : null}
      {message ? <Alert tone="warning">{message}</Alert> : null}
      {draft?.pending ? (
        <Button
          disabled={busy || blocked}
          onClick={() => save(draft.pending!.action)}
        >
          {busy ? "正在确认…" : "重试同一次保存"}
        </Button>
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button disabled={locked} onClick={() => save("answer")}>
            保存并继续
          </Button>
          <Button
            variant="secondary"
            disabled={locked}
            onClick={() => save("skip")}
          >
            跳过本节点
          </Button>
          <Button
            variant="secondary"
            disabled={locked}
            onClick={() => save("draft")}
          >
            保存草稿并暂停
          </Button>
          <Button
            variant="ghost"
            disabled={locked}
            onClick={() => {
              setRunning(false);
              setEnding(true);
            }}
          >
            提前结束本轮
          </Button>
        </div>
      )}
      {ending ? (
        <Alert>
          <p>
            结束后查看统一参考；当前简记会保留为未答草稿，其余待答节点保留为未答。之后可以另开一轮。
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button disabled={locked} onClick={() => save("finish")}>
              确认结束并查看总结
            </Button>
            <Button
              variant="secondary"
              disabled={locked}
              onClick={() => setEnding(false)}
            >
              继续作答
            </Button>
          </div>
        </Alert>
      ) : null}
    </section>
  );
}
