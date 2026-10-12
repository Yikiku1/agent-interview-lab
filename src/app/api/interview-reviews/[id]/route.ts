import { z } from "zod";
import { reviewUpdatePayload } from "@/lib/interview-review-contract";
import {
  getInterviewReview,
  updateInterviewReview,
} from "@/lib/interview-reviews";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  const id = z.uuid().safeParse((await context.params).id);
  if (!id.success)
    return Response.json({ error: "复盘 ID 无效" }, { status: 400 });
  try {
    const review = await getInterviewReview(id.data);
    return Response.json(review ? { review } : { error: "复盘不存在" }, {
      status: review ? 200 : 404,
    });
  } catch {
    return Response.json({ error: "暂时无法读取，请重试" }, { status: 500 });
  }
}
export async function PUT(request: Request, context: Context) {
  const id = z.uuid().safeParse((await context.params).id);
  if (!id.success)
    return Response.json({ error: "复盘 ID 无效" }, { status: 400 });
  let parsed;
  try {
    parsed = reviewUpdatePayload.safeParse(await request.json());
  } catch {
    return Response.json({ error: "请求格式无效" }, { status: 400 });
  }
  if (!parsed.success)
    return Response.json(
      { error: "请核对日期、问题、版本和字段长度；最多保存 20 个问题" },
      { status: 400 },
    );
  try {
    const result = await updateInterviewReview(id.data, parsed.data);
    return Response.json(
      {
        review: result.review,
        ...(result.status === 409
          ? { error: "复盘已有更新，请核对服务器记录；本地编辑保留" }
          : result.status === 422
            ? { error: "请保留已保存问题的顺序，并核对新关联题是否可用" }
            : result.status === 404
              ? { error: "复盘不存在" }
              : {}),
      },
      { status: result.status },
    );
  } catch {
    return Response.json(
      { error: "保存尚未确认，请重试同一次保存" },
      { status: 500 },
    );
  }
}
