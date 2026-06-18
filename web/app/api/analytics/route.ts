import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

interface SearchEvent {
  query: string;
  search_type: string;
  num_results: number | null;
}

export async function GET() {
  const { data } = await supabase
    .from("searches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(2000);

  const rows = data ?? [];
  const searches = rows.filter((row: SearchEvent) => row.search_type !== "click");
  const clicks = rows.filter((row: SearchEvent) => row.search_type === "click");
  const zero = searches.filter((row: SearchEvent) => row.num_results === 0);
  const total = searches.length || 1;
  const gapCounts = zero.reduce<Record<string, number>>((counts, row: SearchEvent) => {
    counts[row.query] = (counts[row.query] ?? 0) + 1;
    return counts;
  }, {});
  const gaps = Object.entries(gapCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  return NextResponse.json({
    total_searches: searches.length,
    zero_result_rate: +(zero.length / total).toFixed(3),
    abandonment_rate: +(1 - clicks.length / total).toFixed(3),
    ctr: +(clicks.length / total).toFixed(3),
    gaps,
  });
}
