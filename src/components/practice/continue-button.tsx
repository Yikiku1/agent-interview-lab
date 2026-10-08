"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resumeSessionUrl } from "@/lib/practice-session";

export function ContinueButton() {
  const router = useRouter();
  function continuePractice() {
    try {
      const url = resumeSessionUrl(localStorage.getItem("practice:last"));
      if (url) {
        router.push(url);
        return;
      }
    } catch {
      /* Ignore invalid local session data. */
    }
    router.push("/practice");
  }
  return (
    <Button variant="secondary" onClick={continuePractice}>
      继续练习
      <ArrowRight data-icon="inline-end" />
    </Button>
  );
}
