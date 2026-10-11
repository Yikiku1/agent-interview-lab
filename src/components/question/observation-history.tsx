import Link from "next/link";
import { gapLabels } from "@/lib/practice-notes-contract";
import type { PracticeObservationPayload } from "@/lib/learning-contract";
export function ObservationHistory({
  rows,
}: {
  rows: {
    id: string;
    questionId: number;
    reviewEventId: number | null;
    createdAt: Date;
    payload: PracticeObservationPayload;
  }[];
}) {
  return (
    <section className="flex flex-col gap-3" id="observations">
      <h2 className="section-title">已保存的自查</h2>
      {rows.length ? (
        rows.map((row) => (
          <article
            key={row.id}
            className="panel panel-padding flex flex-col gap-3"
          >
            <p className="text-xs text-muted-foreground">
              {row.createdAt.toLocaleString("zh-CN", {
                timeZone: "Asia/Shanghai",
                hour12: false,
              })}{" "}
              · 本人自查
            </p>
            {row.payload.pointChecks.map((point) => (
              <p
                key={point.position}
                className="whitespace-pre-wrap break-words text-sm leading-7"
              >
                {point.covered ? "已覆盖" : "还欠缺"}：{point.pointTextSnapshot}
                {point.note ? `\n说明：${point.note}` : ""}
              </p>
            ))}
            {row.payload.gaps.map((gap) => (
              <p
                key={gap.kind}
                className="whitespace-pre-wrap break-words text-sm leading-7"
              >
                当时卡点：{gapLabels[gap.kind]}
                {gap.note ? ` · ${gap.note}` : ""}
              </p>
            ))}
            {row.reviewEventId ? (
              <Link
                className="subtle-link"
                href={`/questions/${row.questionId}/history/${row.reviewEventId}`}
              >
                查看关联的正式回答
              </Link>
            ) : (
              <p className="text-xs text-muted-foreground">
                独立记录，未关联正式回答
              </p>
            )}
            <Link className="subtle-link" href="/practice-gaps?resolved=all">
              查看卡点当前状态
            </Link>
          </article>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">尚未保存自查或卡点。</p>
      )}
    </section>
  );
}
