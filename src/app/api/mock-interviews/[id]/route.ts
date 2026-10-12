import { z } from "zod";
import { mockActionPayload } from "@/lib/mock-interview-contract";
import { applyMockAction, getMockRound } from "@/lib/mock-interview";

type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  const parsed = z.uuid().safeParse((await context.params).id);
  if (!parsed.success)
    return Response.json({ error: "模拟轮次 ID 无效" }, { status: 400 });
  try {
    const round = await getMockRound(parsed.data);
    return Response.json(round ? { round } : { error: "模拟轮次不存在" }, {
      status: round ? 200 : 404,
    });
  } catch {
    return Response.json({ error: "暂时无法读取，请重试" }, { status: 500 });
  }
}
export async function PUT(request: Request, context: Context) {
  const id = z.uuid().safeParse((await context.params).id);
  if (!id.success)
    return Response.json({ error: "模拟轮次 ID 无效" }, { status: 400 });
  let parsed;
  try {
    parsed = mockActionPayload.safeParse(await request.json());
  } catch {
    return Response.json({ error: "请求格式无效" }, { status: 400 });
  }
  if (!parsed.success)
    return Response.json(
      { error: "回答最多 10000 字符，卡点说明最多 2000 字符；节点或时间无效" },
      { status: 400 },
    );
  try {
    const result = await applyMockAction(id.data, parsed.data);
    return Response.json(
      {
        round: result.round,
        ...(result.status === 409
          ? { error: "本轮已有更新，请核对服务器记录；本地编辑保留" }
          : result.status === 404
            ? { error: "模拟轮次不存在" }
            : {}),
      },
      { status: result.status },
    );
  } catch {
    return Response.json(
      { error: "保存暂未确认，回答已保留，请重试" },
      { status: 500 },
    );
  }
}
