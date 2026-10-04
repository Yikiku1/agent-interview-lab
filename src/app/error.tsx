"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <h1 className="text-xl font-semibold">页面加载失败</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        请确认数据库已启动并完成初始化，然后重试。
      </p>
      <Button className="mt-6" onClick={reset}>
        重试
      </Button>
    </div>
  );
}
