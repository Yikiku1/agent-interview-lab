import type { ReactNode } from "react";

export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="panel empty">
      <h2 className="section-title">{title}</h2>
      <p className="empty-description">{description}</p>
      {children ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}
