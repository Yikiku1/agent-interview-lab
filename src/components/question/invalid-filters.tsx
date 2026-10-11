import Link from "next/link";
import { Empty } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";

export function InvalidFilters({ href = "/questions" }: { href?: string }) {
  return (
    <div className="reading-column">
      <Empty
        title="范围条件无效"
        description="预设与项目范围可能冲突，或参数重复、值不合法。请重置后重新选择。"
      >
        <Button asChild>
          <Link href={href}>重置范围条件</Link>
        </Button>
      </Empty>
    </div>
  );
}
