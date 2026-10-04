"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ContinueButton() {
  const router = useRouter();
  function continuePractice() {
    try {
      const saved = JSON.parse(
        localStorage.getItem("practice:last") ?? "null",
      ) as { url?: string; index?: number } | null;
      if (
        saved?.url?.startsWith("/practice/session?") &&
        Number.isInteger(saved.index)
      ) {
        const url = new URL(saved.url, window.location.origin);
        url.searchParams.set("index", String(saved.index));
        router.push(url.pathname + url.search);
        return;
      }
    } catch {
      /* Ignore invalid local session data. */
    }
    router.push("/practice");
  }
  return (
    <Button variant="secondary" onClick={continuePractice}>
      <ArrowRight className="size-4" />
      继续刷题
    </Button>
  );
}
