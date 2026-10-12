"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
export function QuestionLinkPicker({
  rowId,
  questionId,
  label,
  disabled,
  onSelect,
}: {
  rowId: string;
  questionId: number | null;
  label: string;
  disabled: boolean;
  onSelect: (id: number | null, label: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [choices, setChoices] = useState<
    { id: number; question: string; category: string }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const generation = useRef(0);
  async function search() {
    const version = ++generation.current;
    setBusy(true);
    setMessage("");
    setChoices([]);
    try {
      const response = await fetch(
        `/api/interview-review-question-options?q=${encodeURIComponent(query)}`,
      );
      const body = await response.json();
      if (version !== generation.current) return;
      if (!response.ok) throw new Error(body.error ?? "搜索失败");
      setChoices(body.choices);
      if (!body.choices.length)
        setMessage("没有匹配的启用题；可以先保留面试原问题，不必关联。");
    } catch (error) {
      if (version === generation.current)
        setMessage(error instanceof Error ? error.message : "暂时无法搜索");
    } finally {
      if (version === generation.current) setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-7 break-words">
        {questionId === null
          ? "尚未关联题库"
          : `已关联：${label || `题目 #${questionId}`}`}
      </p>
      <Field>
        <FieldLabel htmlFor={`review-search-${rowId}`}>
          搜索关联题（可选）
        </FieldLabel>
        <div className="flex flex-wrap gap-3">
          <input
            id={`review-search-${rowId}`}
            className="control min-w-0 flex-1 basis-48"
            maxLength={120}
            value={query}
            disabled={disabled}
            onChange={(event) => {
              generation.current++;
              setBusy(false);
              setChoices([]);
              setMessage("");
              setQuery(event.target.value);
            }}
          />
          <Button
            variant="secondary"
            disabled={disabled || busy || !query.trim()}
            onClick={search}
          >
            {busy ? "搜索中…" : "搜索题库"}
          </Button>
          {questionId !== null ? (
            <Button
              variant="ghost"
              disabled={disabled}
              onClick={() => onSelect(null, "")}
            >
              取消关联
            </Button>
          ) : null}
        </div>
      </Field>
      {message ? (
        <p role="status" className="text-xs leading-6 text-muted-foreground">
          {message}
        </p>
      ) : null}
      {choices.length ? (
        <ul className="border border-border rounded-md divide-y divide-border">
          {choices.map((choice) => (
            <li key={choice.id} className="p-3 flex flex-col gap-2">
              <p className="text-sm leading-7 break-words">{choice.question}</p>
              <Button
                size="sm"
                variant="secondary"
                disabled={disabled}
                onClick={() => {
                  onSelect(choice.id, choice.question);
                  setChoices([]);
                }}
              >
                关联该题
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
