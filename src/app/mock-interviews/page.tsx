import Link from "next/link";
import { MockSetup } from "@/components/mock/mock-setup";
import { Empty } from "@/components/ui/empty";
import { getMockChoices, listMockRounds } from "@/lib/mock-interview";

export const dynamic = "force-dynamic";
export default async function MockInterviewsPage() {
  const [choices, rounds] = await Promise.all([
    getMockChoices(),
    listMockRounds(),
  ]);
  return (
    <div className="reading-column page-stack">
      <div>
        <h1 className="page-title">项目模拟面试</h1>
        <p className="page-description">
          逐个回答职责、主问题与三个追问，结束后回看自己的表达和证据缺口。
        </p>
      </div>
      <MockSetup choices={choices} />
      <section aria-labelledby="mock-history-title">
        <h2 id="mock-history-title" className="section-title mb-4">
          最近 20 轮模拟
        </h2>
        {rounds.length ? (
          <ul className="panel">
            {rounds.map((round) => (
              <li
                key={round.id}
                className="border-b border-border last:border-0"
              >
                <Link
                  href={`/mock-interviews/${round.id}`}
                  className="block p-5 min-h-20"
                >
                  <p className="text-xs text-muted-foreground">
                    {round.project} ·{" "}
                    {round.createdAt.toLocaleString("zh-CN", {
                      timeZone: "Asia/Shanghai",
                    })}{" "}
                    · {round.endedAt ? "查看总结" : "继续本轮"}
                  </p>
                  <p className="text-sm leading-7 mt-2 break-words">
                    {round.question}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty
            title="还没有模拟记录"
            description="选择项目与主问题后，开始第一轮。"
          />
        )}
      </section>
    </div>
  );
}
