import { reviewCreatePayload } from "@/lib/interview-review-contract";
import { createInterviewReview } from "@/lib/interview-reviews";

export async function POST(request: Request) {
  let parsed;
  try {
    parsed = reviewCreatePayload.safeParse(await request.json());
  } catch {
    return Response.json({ error: "请求格式无效" }, { status: 400 });
  }
  if (!parsed.success)
    return Response.json(
      { error: "请填写真实日期及至少一个问题，检查字段长度与问题标识" },
      { status: 400 },
    );
  try {
    const result = await createInterviewReview(parsed.data);
    return Response.json(
      {
        id: result.id,
        ...(result.status === 409
          ? { error: "创建请求已有其他内容，请核对后重新保存" }
          : result.status === 422
            ? { error: "关联题不存在或已停用，请重新选择；面试原问题保留" }
            : {}),
      },
      { status: result.status },
    );
  } catch {
    return Response.json(
      { error: "保存尚未确认，复盘内容已保留，请重试" },
      { status: 500 },
    );
  }
}
