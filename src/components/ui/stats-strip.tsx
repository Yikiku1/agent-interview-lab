import type { CSSProperties } from "react";

export type Metric = {
  label: string;
  value: number;
  unit?: string;
  status?: "mastered" | "fuzzy" | "unknown";
};
export function StatsStrip({ metrics }: { metrics: Metric[] }) {
  return (
    <dl
      className="panel stats-strip"
      style={{ "--stat-columns": metrics.length } as CSSProperties}
    >
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="stat-item"
          data-status={metric.status}
        >
          <dt>{metric.label}</dt>
          <dd>
            {metric.value}
            {metric.unit ? (
              <span className="stat-unit">{metric.unit}</span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
