import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function FieldGroup({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("field-group", className)} {...props} />;
}
export function Field({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("field", className)} {...props} />;
}
export function FieldLabel({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("field-label", className)} {...props} />;
}
export function FieldDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("field-description", className)} {...props} />;
}
export function FieldSet({ className, ...props }: ComponentProps<"fieldset">) {
  return (
    <fieldset className={cn("form-section min-w-0", className)} {...props} />
  );
}
export function FieldLegend({ className, ...props }: ComponentProps<"legend">) {
  return <legend className={cn("field-legend", className)} {...props} />;
}
