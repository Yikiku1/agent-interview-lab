"use client";
import { useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Field, FieldLabel } from "@/components/ui/field";
import { mockCreatePayload, mockProjects } from "@/lib/mock-interview-contract";
import {
  parseNoteDraft,
  readNoteDraft,
  subscribeNotes,
  writeNoteDraft,
} from "@/lib/note-draft";

const key = "practice:note:mock:create:v1";
export function MockSetup({
  choices,
}: {
  choices: {
    id: number;
    question: string;
    project: "VendorGuard" | "发票实习";
    priority: string;
  }[];
}) {
  const router = useRouter();
  const raw = useSyncExternalStore(
    subscribeNotes,
    () => readNoteDraft(key),
    () => null,
  );
  const stored = parseNoteDraft(raw, (value) => mockCreatePayload.parse(value));
  const selected = stored ?? {
    project: "VendorGuard" as const,
    questionId: choices.find((row) => row.project === "VendorGuard")?.id ?? 0,
    requestId: "",
  };
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [message, setMessage] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const available = choices.filter((row) => row.project === selected.project);
  async function start() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    const payload = {
      ...selected,
      requestId: selected.requestId || crypto.randomUUID(),
    };
    writeNoteDraft(key, payload);
    let definiteFailure = false;
    try {
      const response = await fetch("/api/mock-interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) {
        definiteFailure = response.status < 500;
        setUncertain(response.status >= 500);
        if (response.status < 500)
          writeNoteDraft(key, { ...payload, requestId: crypto.randomUUID() });
        throw new Error(body.error ?? "创建失败");
      }
      writeNoteDraft(key, null);
      router.push(`/mock-interviews/${body.id}`);
    } catch (error) {
      setUncertain(!definiteFailure);
      setMessage(
        error instanceof Error ? error.message : "创建尚未确认，请重试同一轮",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className="panel panel-padding flex flex-col gap-5"
      aria-labelledby="mock-start-title"
    >
      <h2 id="mock-start-title" className="section-title">
        开始一轮项目模拟
      </h2>
      <Field>
        <FieldLabel htmlFor="mock-project">模拟项目</FieldLabel>
        <select
          id="mock-project"
          className="control"
          value={selected.project}
          disabled={busy || uncertain}
          onChange={(event) => {
            const project = event.target.value as typeof selected.project;
            writeNoteDraft(key, {
              project,
              questionId:
                choices.find((row) => row.project === project)?.id ?? 0,
              requestId: crypto.randomUUID(),
            });
          }}
        >
          {mockProjects.map((project) => (
            <option key={project}>{project}</option>
          ))}
        </select>
      </Field>
      <Field>
        <FieldLabel htmlFor="mock-question">主问题</FieldLabel>
        <select
          id="mock-question"
          className="control min-w-0 w-full"
          value={selected.questionId}
          disabled={busy || uncertain || !available.length}
          onChange={(event) =>
            writeNoteDraft(key, {
              ...selected,
              questionId: Number(event.target.value),
              requestId: crypto.randomUUID(),
            })
          }
        >
          <option value={0}>请选择主问题</option>
          {available.map((row) => (
            <option key={row.id} value={row.id}>
              {row.question}
            </option>
          ))}
        </select>
      </Field>
      <p className="text-sm leading-7 break-words">
        已选主问题：
        {available.find((row) => row.id === selected.questionId)?.question ??
          "请选择可用主问题"}
      </p>
      <p className="text-sm leading-7 text-muted-foreground">
        依次回答职责、主问题和三个已有追问。支持文字或口头简记、跳过、暂停和计时；结束后统一查看参考与补练建议。
      </p>
      {available.length ? null : (
        <p className="text-sm">该项目暂时没有可用的结构化主问题。</p>
      )}
      {message ? <Alert tone="warning">{message}</Alert> : null}
      <Button
        disabled={
          busy || !available.some((row) => row.id === selected.questionId)
        }
        onClick={start}
      >
        {busy ? "正在创建…" : message ? "重试创建本轮" : "开始项目模拟"}
      </Button>
    </section>
  );
}
