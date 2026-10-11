import { PracticeSetup } from "@/components/practice/practice-setup";
import { InvalidFilters } from "@/components/question/invalid-filters";
import { parseFilters } from "@/lib/questions";
import { roundSize } from "@/lib/practice-session";

export const dynamic = "force-dynamic";

export default async function PracticeSetupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  let filters;
  try {
    filters = parseFilters(params);
  } catch {
    return <InvalidFilters href="/practice" />;
  }
  return (
    <PracticeSetup
      filters={filters}
      size={roundSize(
        typeof params.size === "string" ? params.size : undefined,
      )}
    />
  );
}
