"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
export function GapStateButton({
  id,
  resolved,
}: {
  id: number;
  resolved: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/practice-gaps/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved: !resolved }),
        signal: AbortSignal.timeout(15000),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "更新失败");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "更新失败，请重试");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <Button variant="secondary" disabled={busy} onClick={save}>
        {busy ? "保存中…" : resolved ? "重新打开" : "标为已解决"}
      </Button>
      {error ? (
        <p role="alert" className="mt-2 text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
