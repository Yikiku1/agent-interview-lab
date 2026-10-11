import { NextResponse } from "next/server";
import { learningTargetPayload } from "@/lib/learning-contract";
import { getLearningTarget, saveLearningTarget } from "@/lib/learning-target";

export async function GET() {
  try {
    return NextResponse.json({ target: await getLearningTarget() });
  } catch {
    return NextResponse.json(
      { error: "读取目标失败，请稍后重试" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }
  const parsed = learningTargetPayload.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "目标配置无效，请检查预设、项目、优先级、时间和日期" },
      { status: 400 },
    );
  try {
    const result = await saveLearningTarget(parsed.data);
    if (result.status === 409)
      return NextResponse.json(
        { error: "同一保存请求的配置已改变，请重新保存" },
        { status: 409 },
      );
    return NextResponse.json(
      { target: result.target },
      { status: result.status },
    );
  } catch {
    return NextResponse.json(
      { error: "保存失败，请保留配置并重试" },
      { status: 500 },
    );
  }
}
