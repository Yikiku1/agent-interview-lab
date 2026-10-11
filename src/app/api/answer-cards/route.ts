import { personalAnswerCardPayload } from "@/lib/learning-contract";
import { getAnswerCard, saveAnswerCard } from "@/lib/practice-notes";
import { positiveId, queryObject } from "@/lib/practice-notes-contract";
import { getQuestion } from "@/lib/questions";

export async function GET(request: Request) {
  let questionId: number;
  try {
    const query = queryObject(new URL(request.url).searchParams);
    if (Object.keys(query).some((key) => key !== "questionId"))
      throw new Error();
    questionId = positiveId.parse(query.questionId);
  } catch {
    return Response.json({ error: "题目参数无效" }, { status: 400 });
  }
  try {
    if (!(await getQuestion(questionId, true)))
      return Response.json({ error: "题目不存在" }, { status: 404 });
    return Response.json({ card: await getAnswerCard(questionId) });
  } catch {
    return Response.json({ error: "读取回答卡失败，请重试" }, { status: 500 });
  }
}
export async function PUT(request: Request) {
  let parsed;
  try {
    parsed = personalAnswerCardPayload.safeParse(await request.json());
  } catch {
    return Response.json({ error: "请求格式无效" }, { status: 400 });
  }
  if (!parsed.success)
    return Response.json(
      { error: "回答卡内容无效，每个字段最多 10000 字符" },
      { status: 400 },
    );
  try {
    const result = await saveAnswerCard(parsed.data);
    return Response.json(
      {
        card: result.card,
        ...(result.status === 409
          ? { error: "回答卡已有新版本，请对照合并后保存" }
          : result.status === 404
            ? { error: "题目不存在" }
            : {}),
      },
      { status: result.status },
    );
  } catch {
    return Response.json(
      { error: "保存失败，编辑内容已保留，请重试" },
      { status: 500 },
    );
  }
}
