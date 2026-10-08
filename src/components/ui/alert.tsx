import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Alert({
  className,
  tone = "neutral",
  role = "status",
  ...props
}: ComponentProps<"div"> & {
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  return (
    <div
      role={role}
      aria-live={role === "alert" ? "assertive" : "polite"}
      aria-atomic="true"
      data-tone={tone}
      className={cn("feedback", className)}
      {...props}
    />
  );
}
