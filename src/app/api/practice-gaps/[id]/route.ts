import { positiveId, resolveGapPayload } from "@/lib/practice-notes-contract";
import { resolvePracticeGap } from "@/lib/practice-notes";
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  let id: number;
  let parsed;
  try {
    id = positiveId.parse((await context.params).id);
    parsed = resolveGapPayload.safeParse(await request.json());
  } catch {
    return Response.json({ error: "请求格式无效" }, { status: 400 });
  }
  if (!parsed.success)
    return Response.json({ error: "请明确设置是否解决" }, { status: 400 });
  try {
    const gap = await resolvePracticeGap(id, parsed.data.resolved);
    return gap
      ? Response.json({ gap })
      : Response.json({ error: "卡点不存在" }, { status: 404 });
  } catch {
    return Response.json({ error: "更新失败，请重试" }, { status: 500 });
  }
}
