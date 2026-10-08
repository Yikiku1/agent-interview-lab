import Link from "next/link";
import { Progress } from "@/components/ui/progress";

export function CategoryProgress({
  categories,
  detailed = false,
}: {
  categories: {
    category: string;
    total: number;
    marked: number;
    mastered: number;
    rate: number;
  }[];
  detailed?: boolean;
}) {
  return (
    <div className="panel category-grid">
      {categories.map((item) => (
        <Link
          key={item.category}
          href={`/questions?category=${encodeURIComponent(item.category)}`}
          className="category-row"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="category-name">{item.category}</span>
            <span className="text-sm font-medium tabular-nums">
              {item.marked ? `${item.rate}%` : "—"}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <Progress value={item.rate} label={`${item.category}掌握率`} />
            </div>
            <span className="category-detail">
              {detailed ? `掌握 ${item.mastered} · ` : ""}已标记 {item.marked} /{" "}
              {item.total}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
