import { practiceObservationPayload } from "@/lib/learning-contract";
import { saveObservation } from "@/lib/practice-notes";

export async function POST(request: Request) {
  let parsed;
  try {
    parsed = practiceObservationPayload.safeParse(await request.json());
  } catch {
    return Response.json({ error: "请求格式无效" }, { status: 400 });
  }
  if (!parsed.success)
    return Response.json(
      { error: "请至少选择一个要点自查或卡点，说明最多 2000 字符" },
      { status: 400 },
    );
  try {
    const result = await saveObservation(parsed.data);
    return Response.json(
      {
        observation: result.observation,
        ...(result.status === 409
          ? { error: "同一保存请求内容已改变，请恢复编辑后保存" }
          : result.status === 404
            ? { error: "题目或关联的正式回答不存在" }
            : {}),
      },
      { status: result.status },
    );
  } catch {
    return Response.json(
      { error: "暂时无法保存，自查草稿已保留，请重试" },
      { status: 500 },
    );
  }
}
