import { findReviewQuestionOptions } from "@/lib/interview-reviews";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const search = params.get("q") ?? "";
  if (
    [...params.keys()].some((key) => key !== "q") ||
    params.getAll("q").length > 1 ||
    search.length > 120
  )
    return Response.json(
      { error: "搜索词最多 120 字符，参数无效" },
      { status: 400 },
    );
  try {
    return Response.json({ choices: await findReviewQuestionOptions(search) });
  } catch {
    return Response.json({ error: "暂时无法搜索，请重试" }, { status: 500 });
  }
}
