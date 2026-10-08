"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";

export default function ErrorPage({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="reading-column">
      <h1 className="page-title mb-6">页面暂时未能加载</h1>
      <Empty
        title="请稍后重试"
        description="可以重新加载当前页面，再继续练习。已保存的练习记录和浏览器草稿会保留。"
      >
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => retry()}>
            <RotateCcw data-icon="inline-start" />
            重新加载
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/">返回首页</Link>
          </Button>
        </div>
      </Empty>
    </div>
  );
}
