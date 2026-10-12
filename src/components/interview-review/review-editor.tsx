"use client";
import { useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Field, FieldLabel } from "@/components/ui/field";
import { QuestionLinkPicker } from "./question-link-picker";
import { gapKinds } from "@/lib/learning-contract";
import { gapLabels } from "@/lib/practice-notes-contract";
import {
  mergeReviewFields,
  reviewCreatePayload,
  reviewDraftKey,
  reviewDraftSchema,
  reviewUpdatePayload,
  type ReviewDraft,
  type ReviewFields,
} from "@/lib/interview-review-contract";
import {
  parseNoteDraft,
  readNoteDraft,
  subscribeNotes,
  writeNoteDraft,
} from "@/lib/note-draft";
import type { InterviewReviewView } from "@/lib/interview-reviews";

function blankQuestion(id: string): ReviewFields["questions"][number] {
  return {
    id,
    prompt: "",
    answerSummary: "",
    gaps: [],
    gapNote: "",
    improvement: "",
    questionId: null,
  };
}
function savedFields(review: InterviewReviewView): ReviewFields {
  return {
    interviewDate: review.interviewDate,
    name: review.name,
    note: review.note,
    questions: review.questions.map(
      ({
        id,
        prompt,
        answerSummary,
        gaps,
        gapNote,
        improvement,
        questionId,
      }) => ({
        id,
        prompt,
        answerSummary,
        gaps,
        gapNote,
        improvement,
        questionId,
      }),
    ),
  };
}
function savedLabels(review: InterviewReviewView) {
  return Object.fromEntries(
    review.questions.map((row) => [row.id, row.questionSnapshot ?? ""]),
  );
}
export function InterviewReviewEditor({
  initial,
  defaultDate,
  firstQuestionId,
}: {
  initial: InterviewReviewView | null;
  defaultDate: string;
  firstQuestionId: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const key = reviewDraftKey(initial?.id);
  const raw = useSyncExternalStore(
    subscribeNotes,
    () => readNoteDraft(key),
    () => null,
  );
  const stored = parseNoteDraft(raw, (value) => reviewDraftSchema.parse(value));
  const [local, setLocal] = useState<ReviewDraft | null>(null);
  const current = local ??
    stored ?? {
      version: 1 as const,
      baseRevision: saved?.revision ?? null,
      fields: saved
        ? savedFields(saved)
        : {
            interviewDate: defaultDate,
            name: "",
            note: "",
            questions: [blankQuestion(firstQuestionId)],
          },
      labels: saved ? savedLabels(saved) : {},
      pending: null,
    };
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [conflict, setConflict] = useState<InterviewReviewView | null>(null);
  const stale =
    saved && current.baseRevision !== saved.revision && !current.pending;
  const latest = conflict ?? (stale ? saved : null);
  const disabled = busy || !!current.pending || !!latest;
  const savedIds = new Set(saved?.questions.map((row) => row.id) ?? []);
  function persist(next: ReviewDraft) {
    setLocal(next);
    if (!writeNoteDraft(key, next))
      setMessage("浏览器无法保存草稿，最新编辑仅在本页保留，请保存到服务器。");
  }
  function changeFields(fields: ReviewFields) {
    setNotice("");
    persist({ ...current, fields });
  }
  function changeQuestion(
    id: string,
    patch: Partial<ReviewFields["questions"][number]>,
  ) {
    changeFields({
      ...current.fields,
      questions: current.fields.questions.map((row) =>
        row.id === id ? { ...row, ...patch } : row,
      ),
    });
  }
  function resolve(useLocal: boolean) {
    if (!latest) return;
    const fields = useLocal
      ? mergeReviewFields(savedFields(latest), current.fields)
      : savedFields(latest);
    if (fields.questions.length > 20) {
      setMessage(
        "合并后超过 20 个问题，编辑仍保留；请先移除尚未保存的新问题再合并。",
      );
      return;
    }
    persist({
      version: 1,
      baseRevision: latest.revision,
      fields,
      labels: useLocal
        ? { ...savedLabels(latest), ...current.labels }
        : savedLabels(latest),
      pending: null,
    });
    setSaved(latest);
    setConflict(null);
    setMessage("");
    setNotice("已采用当前版本，请核对后保存。");
  }
  async function save() {
    if (lock.current || latest) return;
    const candidate = current.pending ?? {
      ...current.fields,
      requestId: crypto.randomUUID(),
      ...(saved ? { expectedRevision: current.baseRevision } : {}),
    };
    const parsed = saved
      ? reviewUpdatePayload.safeParse(candidate)
      : reviewCreatePayload.safeParse(candidate);
    if (!parsed.success) {
      setMessage(
        "请填写有效面试日期和每个实际问题；名称最多 200 字符，回答与改进各 10000 字符，最多 20 个问题。",
      );
      return;
    }
    lock.current = true;
    setBusy(true);
    setMessage("");
    setNotice("");
    const pending = parsed.data;
    persist({ ...current, pending });
    try {
      const response = await fetch(
        saved ? `/api/interview-reviews/${saved.id}` : "/api/interview-reviews",
        {
          method: saved ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pending),
        },
      );
      const body = await response.json();
      if (!response.ok) {
        if (response.status < 500) persist({ ...current, pending: null });
        if (response.status === 409 && body.review) setConflict(body.review);
        throw new Error(body.error ?? "保存失败");
      }
      writeNoteDraft(key, null);
      setLocal(null);
      if (saved) {
        setSaved(body.review);
        setNotice("复盘已保存。补练状态只依据关联后新增的正式回答。");
        router.refresh();
      } else router.push(`/interview-reviews/${body.id}`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "保存尚未确认，内容已保留，请重试同一次保存。",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-5" aria-label="面试复盘编辑">
      {latest ? (
        <Alert tone="warning">
          <p>
            服务器复盘已有更新，本地编辑保留。合并会采用本地同一问题的内容，并保留服务器新增问题。
          </p>
          <details className="mt-3">
            <summary className="cursor-pointer min-h-11">
              核对服务器版本
            </summary>
            <p className="text-sm leading-7 whitespace-pre-wrap break-words">
              {latest.interviewDate} · {latest.name || "未命名面试"}
              {"\n"}
              {latest.note}
            </p>
            {latest.questions.map((row) => (
              <div
                className="mt-3 text-sm leading-7 whitespace-pre-wrap break-words"
                key={row.id}
              >
                <p>{row.prompt}</p>
                <p>回答：{row.answerSummary || "未填写"}</p>
                <p>
                  卡点：{row.gaps.map((kind) => gapLabels[kind]).join("、")}{" "}
                  {row.gapNote}
                </p>
                <p>改进：{row.improvement || "未填写"}</p>
                <p>关联：{row.questionSnapshot || "未关联"}</p>
              </div>
            ))}
          </details>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => resolve(true)}>
              合并本地编辑与最新记录
            </Button>
            <Button variant="ghost" onClick={() => resolve(false)}>
              采用服务器记录，放弃本地编辑
            </Button>
          </div>
        </Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="review-date">面试日期</FieldLabel>
          <input
            id="review-date"
            type="date"
            className="control"
            value={current.fields.interviewDate}
            disabled={disabled}
            onChange={(event) =>
              changeFields({
                ...current.fields,
                interviewDate: event.target.value,
              })
            }
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="review-name">岗位 / 面试名称（可选）</FieldLabel>
          <input
            id="review-name"
            className="control"
            maxLength={200}
            value={current.fields.name}
            disabled={disabled}
            onChange={(event) =>
              changeFields({ ...current.fields, name: event.target.value })
            }
          />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="review-note">本次面试备注（可选）</FieldLabel>
        <textarea
          id="review-note"
          rows={2}
          className="control"
          maxLength={4000}
          value={current.fields.note}
          disabled={disabled}
          onChange={(event) =>
            changeFields({ ...current.fields, note: event.target.value })
          }
        />
      </Field>
      {current.fields.questions.map((row, index) => (
        <fieldset
          key={row.id}
          disabled={disabled}
          className="panel panel-padding flex flex-col gap-4"
          aria-label={`编辑面试问题 ${index + 1}`}
        >
          <legend className="text-sm font-medium px-2">
            实际问题 {index + 1}
          </legend>
          <Field>
            <FieldLabel htmlFor={`review-prompt-${row.id}`}>
              面试官实际问题
            </FieldLabel>
            <textarea
              id={`review-prompt-${row.id}`}
              rows={3}
              className="control"
              maxLength={10000}
              value={row.prompt}
              onChange={(event) =>
                changeQuestion(row.id, { prompt: event.target.value })
              }
            />
            <p className="text-xs leading-6 text-muted-foreground">
              保留当时原话，关联题库不会替换这里的文字。
            </p>
          </Field>
          <Field>
            <FieldLabel htmlFor={`review-answer-${row.id}`}>
              当时的回答摘要（可选）
            </FieldLabel>
            <textarea
              id={`review-answer-${row.id}`}
              rows={3}
              className="control"
              maxLength={10000}
              value={row.answerSummary}
              onChange={(event) =>
                changeQuestion(row.id, { answerSummary: event.target.value })
              }
            />
          </Field>
          <div>
            <p className="text-sm font-medium mb-3">本人卡点（可选）</p>
            <div className="flex flex-wrap gap-4">
              {gapKinds.map((kind) => (
                <label
                  key={kind}
                  className="min-h-11 flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={row.gaps.includes(kind)}
                    onChange={(event) =>
                      changeQuestion(row.id, {
                        gaps: event.target.checked
                          ? [...row.gaps, kind]
                          : row.gaps.filter((value) => value !== kind),
                      })
                    }
                  />
                  {gapLabels[kind]}
                </label>
              ))}
            </div>
          </div>
          <Field>
            <FieldLabel htmlFor={`review-gap-${row.id}`}>
              卡点说明（可选）
            </FieldLabel>
            <textarea
              id={`review-gap-${row.id}`}
              rows={2}
              className="control"
              maxLength={2000}
              value={row.gapNote}
              onChange={(event) =>
                changeQuestion(row.id, { gapNote: event.target.value })
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`review-improvement-${row.id}`}>
              下一次改进（可选）
            </FieldLabel>
            <textarea
              id={`review-improvement-${row.id}`}
              rows={3}
              className="control"
              maxLength={10000}
              value={row.improvement}
              onChange={(event) =>
                changeQuestion(row.id, { improvement: event.target.value })
              }
            />
          </Field>
          <QuestionLinkPicker
            rowId={row.id}
            questionId={row.questionId}
            label={current.labels[row.id] ?? ""}
            disabled={disabled}
            onSelect={(questionId, label) =>
              persist({
                ...current,
                fields: {
                  ...current.fields,
                  questions: current.fields.questions.map((question) =>
                    question.id === row.id
                      ? { ...question, questionId }
                      : question,
                  ),
                },
                labels: { ...current.labels, [row.id]: label },
              })
            }
          />
          {!savedIds.has(row.id) && current.fields.questions.length > 1 ? (
            <Button
              variant="ghost"
              onClick={() =>
                changeFields({
                  ...current.fields,
                  questions: current.fields.questions.filter(
                    (question) => question.id !== row.id,
                  ),
                })
              }
            >
              移除此未保存问题
            </Button>
          ) : null}
        </fieldset>
      ))}
      <Button
        variant="secondary"
        disabled={disabled || current.fields.questions.length >= 20}
        onClick={() =>
          changeFields({
            ...current.fields,
            questions: [
              ...current.fields.questions,
              blankQuestion(crypto.randomUUID()),
            ],
          })
        }
      >
        添加一个实际问题
      </Button>
      <p className="text-xs leading-6 text-muted-foreground">
        最多 20
        个问题。已保存问题保留顺序；卡点留在当次复盘，需要长期跟进时可在题目详情主动记录。
      </p>
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {message ? <Alert tone="warning">{message}</Alert> : null}
      <Button disabled={busy || !!latest} onClick={save}>
        {busy
          ? "正在保存…"
          : current.pending
            ? "重试同一次保存"
            : saved
              ? "保存复盘修改"
              : "保存面试复盘"}
      </Button>
    </div>
  );
}
