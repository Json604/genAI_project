import { NextRequest, NextResponse } from "next/server";
import { jinaEmbed } from "@/lib/jina";
import { blend } from "@/lib/blend";
import { supabase } from "@/lib/supabase";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { image, query, alpha = 0.5 } = await req.json();
  const [imgVec, txtVec] = await jinaEmbed([{ image }, { text: query }]);
  const mixed = blend(imgVec, txtVec, alpha);
  const { data, error } = await supabase.rpc("match_products_combined", { query_embedding: mixed, match_count: 24 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from("searches").insert({ query, search_type: "combined", filters: { alpha }, num_results: data.length });
  return NextResponse.json({ results: data });
}
