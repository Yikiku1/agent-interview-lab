import { getPracticeGaps } from "@/lib/practice-notes";
import { parseGapQuery, queryObject } from "@/lib/practice-notes-contract";
export async function GET(request: Request) {
  let query;
  try {
    query = parseGapQuery(queryObject(new URL(request.url).searchParams));
  } catch {
    return Response.json({ error: "卡点筛选参数无效" }, { status: 400 });
  }
  try {
    return Response.json({
      gaps: await getPracticeGaps(query.filters, query.kind, query.resolved),
    });
  } catch {
    return Response.json({ error: "读取卡点失败，请重试" }, { status: 500 });
  }
}
