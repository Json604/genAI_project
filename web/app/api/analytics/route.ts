import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
export const runtime = "nodejs";
export async function GET() {
  const { data } = await supabase.from("searches").select("*").order("created_at", { ascending: false }).limit(2000);
  const rows = data ?? [];
  const searches = rows.filter((r) => r.search_type !== "click");
  const clicks = rows.filter((r) => r.search_type === "click");
  const zero = searches.filter((r) => r.num_results === 0);
  const total = searches.length || 1;
  const gaps = Object.entries(zero.reduce((m: any, r) => ((m[r.query] = (m[r.query] || 0) + 1), m), {}))
    .sort((a: any, b: any) => b[1] - a[1]).slice(0, 10);
  return NextResponse.json({
    total_searches: searches.length,
    zero_result_rate: +(zero.length / total).toFixed(3),
    abandonment_rate: +(1 - clicks.length / total).toFixed(3),
    ctr: +(clicks.length / total).toFixed(3),
    gaps,
  });
}
