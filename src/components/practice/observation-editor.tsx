"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  gapKinds,
  practiceObservationPayload,
  type PracticeObservationPayload,
} from "@/lib/learning-contract";
import { gapLabels } from "@/lib/practice-notes-contract";
import {
  parseNoteDraft,
  readNoteDraft,
  subscribeNotes,
  writeNoteDraft,
} from "@/lib/note-draft";
import {
  getDraftSnapshot,
  parsePracticeDraft,
  subscribeDrafts,
} from "@/lib/practice-draft";
const draftSchema = z.object({
  pointChecks: z
    .array(
      z.object({
        position: z.number().int().min(0).max(2),
        pointTextSnapshot: z.string().min(1).max(2000),
        covered: z.boolean(),
        note: z.string().max(2000),
      }),
    )
    .max(3),
  gaps: z
    .array(z.object({ kind: z.enum(gapKinds), note: z.string().max(2000) }))
    .max(5),
  pending: practiceObservationPayload.nullable(),
});
type Draft = z.infer<typeof draftSchema>;
const empty: Draft = { pointChecks: [], gaps: [], pending: null };
const serverSnapshot = () => null;
export function ObservationEditor({
  questionId,
  points = [],
  context,
  reviewEventId,
  completionPending = false,
  practiceRoundId,
}: {
  questionId: number;
  points?: readonly string[];
  context: string;
  reviewEventId?: number;
  completionPending?: boolean;
  practiceRoundId?: string;
}) {
  const router = useRouter();
  const formalRaw = useSyncExternalStore(
    subscribeDrafts,
    () =>
      practiceRoundId
        ? getDraftSnapshot(questionId, practiceRoundId, false)
        : null,
    serverSnapshot,
  );
  const waitingForCompletion =
    completionPending ||
    Boolean(
      practiceRoundId &&
      parsePracticeDraft(formalRaw)?.submission &&
      !reviewEventId,
    );
  const key = `practice:note:observation:${context}:${questionId}`;
  const raw = useSyncExternalStore(
    subscribeNotes,
    () => readNoteDraft(key),
    serverSnapshot,
  );
  const draft =
    parseNoteDraft(raw, (value) => draftSchema.parse(value)) ?? empty;
  const pointPositions = [
    ...new Set([
      ...points.slice(0, 3).map((_, position) => position),
      ...draft.pointChecks.map((point) => point.position),
    ]),
  ].sort((a, b) => a - b);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [recoverable, setRecoverable] = useState(false);
  const inFlight = useRef(false);
  const locked = busy || Boolean(draft.pending);
  function persist(value: Draft) {
    if (!writeNoteDraft(key, value))
      setMessage("浏览器无法保存自查草稿，请保持页面打开。");
  }
  async function save(independent: boolean) {
    if (inFlight.current || waitingForCompletion) return;
    const parsed = practiceObservationPayload.safeParse(
      draft.pending ?? {
        requestId: crypto.randomUUID(),
        questionId,
        reviewEventId: independent ? null : (reviewEventId ?? null),
        pointChecks: draft.pointChecks,
        gaps: draft.gaps,
      },
    );
    if (!parsed.success) {
      setMessage("请至少选择一个要点自查或卡点。");
      return;
    }
    const payload: PracticeObservationPayload = parsed.data;
    persist({ ...draft, pending: payload });
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/practice-observations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });
      const body = await response.json();
      if (!response.ok) {
        setRecoverable([400, 404, 409, 422].includes(response.status));
        throw new Error(body.error ?? "保存失败");
      }
      writeNoteDraft(key, null);
      setMessage(
        payload.reviewEventId
          ? "自查与卡点已保存，已关联这次正式回答。"
          : "自查与卡点已独立保存。",
      );
      setRecoverable(false);
      if (!practiceRoundId) router.refresh();
    } catch (error) {
      setMessage(
        `${error instanceof Error ? error.message : "暂时无法保存"}。草稿已保留，请重试。`,
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="flex flex-col gap-4" aria-label="要点自查与卡点">
      <h2 className="section-title">要点自查与卡点</h2>
      <p className="text-sm leading-7 text-muted-foreground">
        这是本人对照检查。勾选要点后选择“已覆盖”或“还欠缺”，也可以只记卡点。
      </p>
      {pointPositions.map((position) => {
        const check = draft.pointChecks.find(
          (item) => item.position === position,
        );
        const point = check?.pointTextSnapshot ?? points[position];
        const id = `observation-${questionId}-${position}`;
        return (
          <div
            key={position}
            className="flex flex-col gap-2 rounded-md border border-border p-3"
          >
            <label className="flex items-start gap-3 text-sm leading-7">
              <input
                type="checkbox"
                className="mt-2"
                disabled={locked}
                checked={Boolean(check)}
                onChange={(event) =>
                  persist({
                    ...draft,
                    pointChecks: event.target.checked
                      ? [
                          ...draft.pointChecks,
                          {
                            position,
                            pointTextSnapshot: point,
                            covered: false,
                            note: "",
                          },
                        ]
                      : draft.pointChecks.filter(
                          (item) => item.position !== position,
                        ),
                  })
                }
              />
              {check?.pointTextSnapshot ?? point}
            </label>
            {check ? (
              <>
                <label htmlFor={`${id}-covered`} className="text-sm">
                  覆盖情况
                </label>
                <select
                  id={`${id}-covered`}
                  className="control"
                  disabled={locked}
                  value={String(check.covered)}
                  onChange={(event) =>
                    persist({
                      ...draft,
                      pointChecks: draft.pointChecks.map((item) =>
                        item.position === position
                          ? { ...item, covered: event.target.value === "true" }
                          : item,
                      ),
                    })
                  }
                >
                  <option value="false">还欠缺</option>
                  <option value="true">已覆盖</option>
                </select>
                <label htmlFor={`${id}-note`} className="text-sm">
                  要点说明（选填）
                </label>
                <textarea
                  id={`${id}-note`}
                  className="control practice-answer"
                  rows={2}
                  maxLength={2000}
                  disabled={locked}
                  value={check.note}
                  onChange={(event) =>
                    persist({
                      ...draft,
                      pointChecks: draft.pointChecks.map((item) =>
                        item.position === position
                          ? { ...item, note: event.target.value }
                          : item,
                      ),
                    })
                  }
                />
              </>
            ) : null}
          </div>
        );
      })}
      <fieldset className="min-w-0 flex flex-col gap-3">
        <legend className="mb-3 text-sm font-medium">卡点类型（可多选）</legend>
        {gapKinds.map((kind) => {
          const gap = draft.gaps.find((item) => item.kind === kind);
          return (
            <div key={kind} className="flex flex-col gap-2">
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  disabled={locked}
                  checked={Boolean(gap)}
                  onChange={(event) =>
                    persist({
                      ...draft,
                      gaps: event.target.checked
                        ? [...draft.gaps, { kind, note: "" }]
                        : draft.gaps.filter((item) => item.kind !== kind),
                    })
                  }
                />
                {gapLabels[kind]}
              </label>
              {gap ? (
                <>
                  <label
                    className="sr-only"
                    htmlFor={`gap-note-${questionId}-${kind}`}
                  >
                    {gapLabels[kind]}说明
                  </label>
                  <textarea
                    id={`gap-note-${questionId}-${kind}`}
                    className="control practice-answer"
                    placeholder="下次具体要补什么？"
                    rows={2}
                    maxLength={2000}
                    disabled={locked}
                    value={gap.note}
                    onChange={(event) =>
                      persist({
                        ...draft,
                        gaps: draft.gaps.map((item) =>
                          item.kind === kind
                            ? { ...item, note: event.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                </>
              ) : null}
            </div>
          );
        })}
      </fieldset>
      {waitingForCompletion ? (
        <p className="text-sm leading-7">
          正式回答正在等待确认。自查草稿保留，恢复完成记录后再保存关联。
        </p>
      ) : null}
      {draft.pending ? (
        <p className="text-sm leading-7">
          上次请求等待确认，重试将使用原内容
          {draft.pending.reviewEventId ? "与原正式回答" : "（独立记录）"}。
        </p>
      ) : null}
      <p role="status" className="text-sm leading-7">
        {message}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={busy || waitingForCompletion || recoverable}
          onClick={() => save(!reviewEventId)}
        >
          {busy
            ? "保存中…"
            : draft.pending
              ? "重试保存自查与卡点"
              : reviewEventId
                ? "保存并关联这次回答"
                : "独立保存自查与卡点"}
        </Button>
        {reviewEventId && !draft.pending ? (
          <Button
            variant="secondary"
            disabled={busy || waitingForCompletion}
            onClick={() => save(true)}
          >
            独立保存
          </Button>
        ) : null}
        {recoverable ? (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              persist({ ...draft, pending: null });
              setRecoverable(false);
              setMessage("已恢复编辑，请检查后重新保存。");
            }}
          >
            恢复编辑
          </Button>
        ) : null}
        <Link
          className="subtle-link min-h-11 flex items-center"
          href="/practice-gaps"
        >
          查看已保存卡点
        </Link>
      </div>
    </section>
  );
}
