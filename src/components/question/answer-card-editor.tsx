"use client";
import { useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { personalAnswerCardPayload } from "@/lib/learning-contract";
import { z } from "zod";
import {
  parseNoteDraft,
  readNoteDraft,
  subscribeNotes,
  writeNoteDraft,
} from "@/lib/note-draft";

type Fields = {
  shortAnswer: string;
  example: string;
  contributionBoundary: string;
  evidence: string;
};
type Card = Fields & { revision: number };
function normalizeCard(
  card: { revision: number } & Partial<Record<keyof Fields, string | null>>,
): Card {
  return {
    revision: card.revision,
    shortAnswer: card.shortAnswer ?? "",
    example: card.example ?? "",
    contributionBoundary: card.contributionBoundary ?? "",
    evidence: card.evidence ?? "",
  };
}
const labels: Record<keyof Fields, string> = {
  shortAnswer: "我的短答",
  example: "真实例子",
  contributionBoundary: "我的贡献与边界",
  evidence: "可出示的证据",
};
const empty: Fields = {
  shortAnswer: "",
  example: "",
  contributionBoundary: "",
  evidence: "",
};
const serverSnapshot = () => null;
const cardDraftSchema = personalAnswerCardPayload.extend({
  shortAnswer: z.string().max(10000),
  example: z.string().max(10000),
  contributionBoundary: z.string().max(10000),
  evidence: z.string().max(10000),
});
export function AnswerCardEditor({
  questionId,
  initial,
  sourceAnswer,
}: {
  questionId: number;
  initial: Card | null;
  sourceAnswer?: string | null;
}) {
  const key = `practice:note:card:${questionId}`;
  const raw = useSyncExternalStore(
    subscribeNotes,
    () => readNoteDraft(key),
    serverSnapshot,
  );
  const [saved, setSaved] = useState(initial);
  const draft = parseNoteDraft(raw, (value) =>
    cardDraftSchema.parse(value),
  ) ?? {
    questionId,
    expectedRevision: saved?.revision ?? 0,
    ...empty,
    ...(saved
      ? {
          shortAnswer: saved.shortAnswer,
          example: saved.example,
          contributionBoundary: saved.contributionBoundary,
          evidence: saved.evidence,
        }
      : {}),
  };
  const [conflict, setConflict] = useState<Card | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const persist = (value: typeof draft) => {
    if (!writeNoteDraft(key, value))
      setMessage("浏览器无法保存草稿，请保持页面打开并保存到回答卡。");
  };
  async function save() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/answer-cards", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId,
          expectedRevision: draft.expectedRevision,
          ...Object.fromEntries(
            Object.keys(labels).map((field) => [
              field,
              draft[field as keyof Fields],
            ]),
          ),
        }),
        signal: AbortSignal.timeout(15000),
      });
      const body = await response.json();
      if (response.status === 409)
        setConflict(body.card ? normalizeCard(body.card) : null);
      if (!response.ok) throw new Error(body.error ?? "保存失败");
      setSaved(normalizeCard(body.card));
      setConflict(null);
      writeNoteDraft(key, null);
      setMessage("回答卡已保存。历史回答和练习次数保持原记录。");
    } catch (error) {
      setMessage(
        `${error instanceof Error ? error.message : "暂时无法保存"}。本地编辑已保留。`,
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className="panel panel-padding flex flex-col gap-5"
      aria-label="个人回答卡编辑"
    >
      <p className="text-sm leading-7 text-muted-foreground">
        只填写自己能讲清、能举证的经历。四项都可留空，每项最多 10000 字符。
      </p>
      {sourceAnswer ? (
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => persist({ ...draft, shortAnswer: sourceAnswer })}
        >
          把这次回答带入短答
        </Button>
      ) : null}
      {Object.entries(labels).map(([field, label]) => (
        <Field key={field}>
          <FieldLabel htmlFor={`card-${field}`}>{label}</FieldLabel>
          <textarea
            id={`card-${field}`}
            className="control practice-answer"
            rows={field === "shortAnswer" ? 6 : 3}
            maxLength={10000}
            disabled={busy}
            value={draft[field as keyof Fields]}
            onChange={(event) =>
              persist({ ...draft, [field]: event.target.value })
            }
          />
        </Field>
      ))}
      {conflict ? (
        <div
          className="rounded-lg border border-border p-4 flex flex-col gap-3"
          role="alert"
        >
          <p className="text-sm">
            服务端已有第 {conflict.revision}{" "}
            版。对照下方内容合并到上面的编辑框，再以新版本保存。
          </p>
          {Object.entries(labels).map(([field, label]) => (
            <details key={field}>
              <summary className="cursor-pointer text-sm">
                服务端：{label}
              </summary>
              <p className="whitespace-pre-wrap break-words text-sm leading-7">
                {conflict[field as keyof Fields] || "（空）"}
              </p>
            </details>
          ))}
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              persist({ ...draft, expectedRevision: conflict.revision });
              setConflict(null);
              setMessage(
                "已采用最新版本号，上方本地编辑保留；请确认合并内容后保存。",
              );
            }}
          >
            保留编辑，采用最新版本号
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => {
              persist({
                ...draft,
                expectedRevision: conflict.revision,
                shortAnswer: conflict.shortAnswer,
                example: conflict.example,
                contributionBoundary: conflict.contributionBoundary,
                evidence: conflict.evidence,
              });
              setConflict(null);
            }}
          >
            用服务端内容替换编辑
          </Button>
        </div>
      ) : null}
      <p role="status" className="text-sm leading-7">
        {message}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={busy || Boolean(conflict)} onClick={save}>
          {busy ? "保存中…" : "保存回答卡"}
        </Button>
        <span className="text-xs text-muted-foreground">
          当前基于第 {draft.expectedRevision} 版
        </span>
      </div>
    </section>
  );
}
