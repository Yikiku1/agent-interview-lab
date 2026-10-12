import { notFound } from "next/navigation";
import { z } from "zod";
import { getMockRound } from "@/lib/mock-interview";
import { MockSession } from "@/components/mock/mock-session";
import { MockSummary } from "@/components/mock/mock-summary";

export const dynamic = "force-dynamic";
export default async function MockRoundPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const round = await getMockRound(id.data);
  if (!round) notFound();
  return round.endedAt ? (
    <MockSummary round={round} />
  ) : (
    <MockSession initial={round} />
  );
}
