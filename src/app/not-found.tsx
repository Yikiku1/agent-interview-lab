import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-xl font-semibold">没有找到这个页面或题目</h1>
      <Button className="mt-6" asChild>
        <Link href="/questions">返回题库</Link>
      </Button>
    </div>
  );
}
