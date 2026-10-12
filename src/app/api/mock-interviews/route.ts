import { mockCreatePayload } from "@/lib/mock-interview-contract";
import { createMockRound } from "@/lib/mock-interview";

export async function POST(request: Request) {
  let parsed;
  try {
    parsed = mockCreatePayload.safeParse(await request.json());
  } catch {
    return Response.json({ error: "请求格式无效" }, { status: 400 });
  }
  if (!parsed.success)
    return Response.json({ error: "项目或主问题参数无效" }, { status: 400 });
  try {
    const result = await createMockRound(parsed.data);
    return Response.json(
      {
        id: result.id,
        ...(result.status === 409
          ? { error: "创建请求已用于另一轮，请重新选择" }
          : result.status === 422
            ? { error: "主问题已停用或参考版本改变，请刷新重新选择" }
            : {}),
      },
      { status: result.status },
    );
  } catch {
    return Response.json(
      { error: "暂时无法创建，保留选择后重试" },
      { status: 500 },
    );
  }
}
